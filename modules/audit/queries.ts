import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";
import { ownerLabel } from "@/lib/pet-label";

export interface ListAuditArgs {
  clinicId: string;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  /** Inclusive start and exclusive end, already in the clinic's zone. */
  from?: Date | null;
  to?: Date | null;
  take?: number;
}

export async function listAuditEntries({
  clinicId,
  entityType,
  entityId,
  actorId,
  from,
  to,
  take = PAGE_SIZES.LIST,
}: ListAuditArgs) {
  return prisma.auditLog.findMany({
    where: {
      clinicId,
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(actorId ? { actorId } : {}),
      // `audit_logs_clinicId_createdAt_idx` serves the range.
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { id: true, name: true } } },
  });
}

export type AuditEntityName = { label: string; currency?: string };

/**
 * What each row is ABOUT, by name: "Boncuk", "Ayşe Yılmaz", "#2026-0004".
 *
 * One query per record type on the page, never one per row: the ids are
 * grouped by type and each group is a single `in` lookup, clinic-scoped.
 * A record that has since been deleted has no name and the row says only
 * what kind it was -- the audit outlives what it describes.
 */
export async function auditEntityNames(
  clinicId: string,
  entries: ReadonlyArray<{ entityType: string; entityId: string }>,
): Promise<Map<string, AuditEntityName>> {
  const ids = (type: string) => [...new Set(entries.filter((e) => e.entityType === type).map((e) => e.entityId))];
  const [clients, pets, invoices, visits, appointments] = await Promise.all([
    ids("Client").length
      ? prisma.client.findMany({ where: { clinicId, id: { in: ids("Client") } }, select: { id: true, firstName: true, lastName: true } })
      : [],
    ids("Pet").length
      ? prisma.pet.findMany({ where: { clinicId, id: { in: ids("Pet") } }, select: { id: true, name: true } })
      : [],
    ids("Invoice").length
      ? prisma.invoice.findMany({
          where: { clinicId, id: { in: ids("Invoice") } },
          select: { id: true, number: true, currency: true },
        })
      : [],
    ids("Visit").length
      ? prisma.visit.findMany({ where: { clinicId, id: { in: ids("Visit") } }, select: { id: true, pet: { select: { name: true } } } })
      : [],
    ids("Appointment").length
      ? prisma.appointment.findMany({
          where: { clinicId, id: { in: ids("Appointment") } },
          select: { id: true, pet: { select: { name: true } } },
        })
      : [],
  ]);
  const out = new Map<string, AuditEntityName>();
  for (const c of clients) out.set(`Client:${c.id}`, { label: ownerLabel(c) });
  for (const p of pets) out.set(`Pet:${p.id}`, { label: p.name });
  for (const i of invoices) out.set(`Invoice:${i.id}`, { label: `#${i.number}`, currency: i.currency });
  for (const v of visits) out.set(`Visit:${v.id}`, { label: v.pet.name });
  for (const a of appointments) out.set(`Appointment:${a.id}`, { label: a.pet.name });
  return out;
}
