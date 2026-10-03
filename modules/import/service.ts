// Spreadsheet import: read the file, show what would happen, then do it.
//
// The file is sent again for every step and read again on the server
// every time. Nothing the browser computed is trusted -- not the rows, not
// the clinic, not the counts -- and the import re-runs the very analysis
// the preview showed, then refuses if the result is no longer what the
// clinic approved. "What you saw is what got written" is checked, not
// assumed.

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { fold } from "@/lib/search";
import type { ActionContext } from "@/lib/action";
import type { Prisma } from "@/generated/prisma/client";
import { autoMap, missingRequired, sanitizeMapping, type ColumnMapping } from "./fields";
import {
  analyzeRows,
  contactKeys,
  type Analysis,
  type AnalyzeOptions,
  type ExistingData,
} from "./analyze";
import { readImportFile, importError } from "./parse";
import { nameKey, readEmail, readPhone } from "./normalize";

/**
 * Who may import. `settings.manage` because bringing a whole practice in
 * is a clinic-level decision, taken once, by whoever runs the clinic; the
 * two write permissions because that is what the import actually does,
 * and a role must never be able to do in bulk what it cannot do by hand.
 */
export function requireImport(role: string | undefined) {
  requirePermission(role, "settings.manage");
  requirePermission(role, "clients.write");
  requirePermission(role, "pets.write");
}

/** A cuid-shaped id, so imported rows cannot be told apart by their keys. */
export function newId(): string {
  const random = BigInt(`0x${randomBytes(10).toString("hex")}`).toString(36).padStart(16, "0");
  return `c${Date.now().toString(36)}${random}`.slice(0, 25);
}

const SAMPLE_VALUES = 3;

export async function inspectImport(file: File | null, ctx: ActionContext) {
  requireImport(ctx.userRole);
  const sheet = await readImportFile(file);
  const samples = sheet.headers.map((_, column) => {
    const seen = new Set<string>();
    for (const row of sheet.rows) {
      const v = row[column];
      if (v && !seen.has(v)) seen.add(v);
      if (seen.size >= SAMPLE_VALUES) break;
    }
    return [...seen];
  });
  return {
    fileName: sheet.fileName,
    sheetName: sheet.sheetName,
    headers: sheet.headers,
    samples,
    rows: sheet.rows.filter((r) => r.some((c) => c !== "")).length,
    mapping: autoMap(sheet.headers),
  };
}

export function sanitizeOptions(raw: unknown): AnalyzeOptions {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const dateOrder = o.dateOrder === "DMY" || o.dateOrder === "MDY" ? o.dateOrder : null;
  const speciesChoices: Record<string, string> = {};
  if (o.speciesChoices && typeof o.speciesChoices === "object") {
    for (const [k, v] of Object.entries(o.speciesChoices as Record<string, unknown>).slice(0, 500)) {
      if (typeof v === "string" && k.length <= 120 && v.length <= 60) speciesChoices[k] = v;
    }
  }
  return { dateOrder, speciesChoices };
}

/**
 * The clinic's records the file could collide with.
 *
 * Clients are read in full (five short columns each) rather than filtered
 * in SQL, because phones are stored as people typed them and "0532 123 45
 * 67" and "+905321234567" only meet after `normalizePhone`. That is
 * linear in the clinic's client count; an import is a one-off and runs
 * when the clinic is at its smallest, so this is the right trade today.
 * The day a large clinic imports, the fix is a normalized phone column
 * with an index, not a cleverer query here.
 */
async function loadExisting(
  clinicId: string,
  rows: string[][],
  mapping: ColumnMapping,
): Promise<ExistingData> {
  const keys = contactKeys(rows, mapping);
  const [clients, customSpecies] = await Promise.all([
    prisma.client.findMany({
      where: { clinicId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        secondaryPhone: true,
        email: true,
        archivedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customSpecies.findMany({
      where: { clinicId },
      select: { id: true, name: true },
    }),
  ]);

  const phones = new Set(keys.phones);
  const emails = new Set(keys.emails);
  const names = new Set(keys.names);
  const candidates = clients
    .filter((c) => {
      if (!c.archivedAt && names.has(nameKey(c.firstName, c.lastName))) return true;
      const p = [c.phone, c.secondaryPhone].map((x) => readPhone(x ?? ""));
      const e = readEmail(c.email ?? "");
      return (
        p.some((x) => x.kind === "ok" && phones.has(x.key)) ||
        (e.kind === "ok" && emails.has(e.key))
      );
    })
    .map((c) => c.id);

  const pets =
    candidates.length > 0 || keys.chips.length > 0
      ? await prisma.pet.findMany({
          where: {
            clinicId,
            OR: [
              ...(candidates.length > 0 ? [{ ownerId: { in: candidates } }] : []),
              ...(keys.chips.length > 0 ? [{ microchipId: { in: keys.chips } }] : []),
            ],
          },
          select: { ownerId: true, name: true, microchipId: true },
        })
      : [];

  return {
    clients: clients.map(({ archivedAt, ...c }) => ({ ...c, archived: archivedAt !== null })),
    pets,
    customSpecies,
  };
}

async function analyzeFile(
  file: File | null,
  rawMapping: unknown,
  rawOptions: unknown,
  ctx: ActionContext,
) {
  requireImport(ctx.userRole);
  const sheet = await readImportFile(file);
  const mapping = sanitizeMapping(rawMapping, sheet.headers.length);
  const missing = missingRequired(mapping);
  if (missing.length > 0) throw importError("mappingIncomplete");
  const options = sanitizeOptions(rawOptions);
  const existing = await loadExisting(ctx.clinicId, sheet.rows, mapping);
  const analysis = analyzeRows(sheet.rows, mapping, existing, options, sheet.firstLine);
  return { sheet, mapping, options, analysis };
}

export async function previewImport(
  file: File | null,
  rawMapping: unknown,
  rawOptions: unknown,
  ctx: ActionContext,
) {
  const { sheet, analysis } = await analyzeFile(file, rawMapping, rawOptions, ctx);
  // The original cells of the rows that will be left out, so the report
  // the clinic downloads is their own row back with the reason beside it.
  const skipped = new Set(
    analysis.rows.filter((r) => r.status === "error" || r.status === "duplicate").map((r) => r.line),
  );
  const cells: Record<number, string[]> = {};
  sheet.rows.forEach((row, i) => {
    const line = sheet.firstLine + i;
    if (skipped.has(line)) cells[line] = row;
  });
  return { headers: sheet.headers, analysis, skippedCells: cells };
}

export interface ExpectedCounts {
  pets: number;
  newClients: number;
  existingClients: number;
  vaccinations: number;
}

const CHUNK = 500;

async function createInChunks<T>(
  items: T[],
  write: (chunk: T[]) => Promise<unknown>,
) {
  for (let i = 0; i < items.length; i += CHUNK) await write(items.slice(i, i + CHUNK));
}

const birthDay = (d: string) => new Date(`${d}T00:00:00Z`);
// Noon, not midnight: a vaccination is shown in the clinic's own zone,
// and midday UTC is the same calendar day everywhere from UTC-11 to +11.
const clinicalDay = (d: string) => new Date(`${d}T12:00:00Z`);

export async function commitImport(
  file: File | null,
  rawMapping: unknown,
  rawOptions: unknown,
  expected: Partial<ExpectedCounts> | null,
  ctx: ActionContext,
) {
  const { sheet, analysis } = await analyzeFile(file, rawMapping, rawOptions, ctx);
  const c = analysis.counts;
  if (
    !expected ||
    expected.pets !== c.pets ||
    expected.newClients !== c.newClients ||
    expected.existingClients !== c.existingClients ||
    expected.vaccinations !== c.vaccinations
  )
    throw importError("changedSincePreview");
  if (c.pets === 0) throw importError("nothingToImport");

  const importId = newId();
  const result = await writePlan(analysis, importId, sheet.fileName, ctx);
  return { importId, ...result };
}

/** Exported for tests: the write half, given an analysis already made. */
export async function writePlan(
  analysis: Analysis,
  importId: string,
  fileName: string,
  ctx: ActionContext,
) {
  const { clinicId, userId } = ctx;
  const audit = (entityType: string, entityId: string): Prisma.AuditLogCreateManyInput => ({
    clinicId,
    actorId: userId,
    action: "CREATE",
    entityType,
    entityId,
    metadata: { importId },
  });

  return prisma.$transaction(
    async (tx) => {
      // Species the clinic agreed to add, created once each. Read first by
      // the folded key, so "Papağan" in the file meets "papagan" added by
      // hand yesterday instead of becoming its twin.
      const speciesIds = new Map<string, string>();
      const newSpecies = new Map<string, string>();
      for (const row of analysis.rows) {
        const sp = row.pet?.species;
        if (sp?.kind === "new" && !newSpecies.has(fold(sp.name))) newSpecies.set(fold(sp.name), sp.name);
      }
      const createdSpecies: string[] = [];
      for (const [key, name] of newSpecies) {
        const found = await tx.customSpecies.findFirst({
          where: { clinicId, nameKey: key },
          select: { id: true },
        });
        if (found) speciesIds.set(key, found.id);
        else {
          const created = await tx.customSpecies.create({
            data: { clinicId, name },
            select: { id: true },
          });
          speciesIds.set(key, created.id);
          createdSpecies.push(created.id);
        }
      }

      const clientIds = new Map<string, string>();
      const newClients: Prisma.ClientCreateManyInput[] = [];
      for (const owner of analysis.owners) {
        if (owner.existing) {
          clientIds.set(owner.id, owner.existing.id);
          continue;
        }
        const id = newId();
        clientIds.set(owner.id, id);
        newClients.push({
          id,
          clinicId,
          firstName: owner.firstName,
          lastName: owner.lastName,
          phone: owner.phone,
          secondaryPhone: owner.secondaryPhone,
          email: owner.email,
          address: owner.address,
          city: owner.city,
          notes: owner.notes,
          // Consent is not something a spreadsheet can carry: a column
          // saying "yes" records what somebody once typed, not what the
          // client agreed to. Null and not false, because the schema
          // keeps the two apart (`prisma/schema.prisma`, Client): false
          // is a refusal, and nobody refused. Either way nothing is sent
          // until the clinic asks -- sending requires `true`.
          notificationsOptIn: null,
        });
      }

      const pets: Prisma.PetCreateManyInput[] = [];
      const vaccinations: Prisma.VaccinationCreateManyInput[] = [];
      for (const row of analysis.rows) {
        if (!row.pet || !row.ownerId) continue;
        const ownerId = clientIds.get(row.ownerId);
        if (!ownerId) continue;
        const p = row.pet;
        const id = newId();
        pets.push({
          id,
          clinicId,
          ownerId,
          name: p.name,
          species: p.species.kind === "builtIn" ? p.species.species : "OTHER",
          customSpeciesId:
            p.species.kind === "custom"
              ? p.species.id
              : p.species.kind === "new"
                ? speciesIds.get(fold(p.species.name))
                : null,
          breed: p.breed,
          sex: p.sex,
          neutered: p.neutered,
          birthDate: p.birthDate ? birthDay(p.birthDate) : null,
          color: p.color,
          microchipId: p.microchipId,
          weightKg: p.weightKg,
          notes: p.notes,
        });
        if (row.vaccine) {
          vaccinations.push({
            id: newId(),
            clinicId,
            petId: id,
            name: row.vaccine.name,
            administeredAt: clinicalDay(row.vaccine.date),
            nextDueAt: row.vaccine.nextDue ? clinicalDay(row.vaccine.nextDue) : null,
          });
        }
      }

      await createInChunks(newClients, (data) => tx.client.createMany({ data }));
      await createInChunks(pets, (data) => tx.pet.createMany({ data }));
      await createInChunks(vaccinations, (data) => tx.vaccination.createMany({ data }));

      // One row per record, as if each had been added by hand, so a
      // client's own history starts where it really started; and one for
      // the import itself, which is what the audit page lists.
      const rows = [
        ...createdSpecies.map((id) => audit("CustomSpecies", id)),
        ...newClients.map((c) => audit("Client", c.id!)),
        ...pets.map((p) => audit("Pet", p.id!)),
        ...vaccinations.map((v) => audit("Vaccination", v.id!)),
      ];
      await createInChunks(rows, (data) => tx.auditLog.createMany({ data }));

      const summary = {
        pets: pets.length,
        newClients: newClients.length,
        existingClients: analysis.counts.existingClients,
        vaccinations: vaccinations.length,
        newSpecies: createdSpecies.length,
        skipped: analysis.counts.skipped,
      };
      await writeAudit(
        {
          clinicId,
          actorId: userId,
          action: "CREATE",
          entityType: "Import",
          entityId: importId,
          metadata: { fileName, rows: analysis.counts.rows, ...summary },
        },
        tx,
      );
      return summary;
    },
    // A few thousand rows in bulk inserts is well under a second locally,
    // but the default 15 s is a pooled-connection budget for a single
    // form, and this is the one write in the product sized by a file.
    { timeout: 60_000, maxWait: 10_000 },
  );
}

/**
 * Hides the dashboard's "bring your data over" card for the whole clinic.
 *
 * Stored on the clinic, not in a cookie: the card is about the clinic's
 * records, and a dismissal that came back on every new browser or every
 * colleague's login is the nagging it was dismissed to stop. The way back
 * in stays under Settings, which is what the confirmation says.
 */
export async function dismissImportPrompt(ctx: ActionContext) {
  requirePermission(ctx.userRole, "settings.manage");
  const clinic = await prisma.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: { settings: true },
  });
  const current =
    clinic?.settings && typeof clinic.settings === "object" && !Array.isArray(clinic.settings)
      ? (clinic.settings as Record<string, unknown>)
      : {};
  await prisma.clinic.update({
    where: { id: ctx.clinicId },
    data: { settings: { ...current, importPromptDismissedAt: new Date().toISOString() } },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Clinic",
    entityId: ctx.clinicId,
    changes: { importPromptDismissed: true },
  });
}
