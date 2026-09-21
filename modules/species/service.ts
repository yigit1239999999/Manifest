import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import { SPECIES } from "@/modules/pets/schema";

const SPECIES_SET: ReadonlySet<string> = new Set(SPECIES);

/**
 * Saves which built-in species the clinic wants in its pet form. Merged into
 * `Clinic.settings` so other settings survive untouched.
 */
export async function setEnabledSpecies(keys: string[], ctx: ActionContext) {
  requirePermission(ctx.userRole, "settings.manage");

  const enabled = SPECIES.filter((s) => keys.includes(s));
  const unknown = keys.filter((k) => !SPECIES_SET.has(k));
  if (unknown.length > 0)
    throw validationFailed({ species: ["error.validation.speciesUnknown"] });
  if (enabled.length === 0)
    throw validationFailed({ species: ["error.validation.speciesNoneEnabled"] });

  const clinic = await prisma.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: { settings: true },
  });
  if (!clinic) throw notFound("clinic", ctx.clinicId);

  const current =
    clinic.settings && typeof clinic.settings === "object" && !Array.isArray(clinic.settings)
      ? (clinic.settings as Record<string, unknown>)
      : {};

  await prisma.clinic.update({
    where: { id: ctx.clinicId },
    data: { settings: { ...current, enabledSpecies: enabled } },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Clinic",
    entityId: ctx.clinicId,
    changes: { enabledSpecies: enabled },
  });
  return enabled;
}

/** Deletes a clinic-defined species — only when no pet references it. */
export async function deleteCustomSpecies(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "settings.manage");

  const existing = await prisma.customSpecies.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, name: true, _count: { select: { pets: true } } },
  });
  if (!existing) throw notFound("species", id);
  if (existing._count.pets > 0)
    throw validationFailed({ species: ["error.validation.speciesInUse"] });

  await prisma.customSpecies.delete({ where: { id } });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "DELETE",
    entityType: "CustomSpecies",
    entityId: id,
    metadata: { name: existing.name },
  });
}
