import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { ClinicSettingsInput } from "./schema";

/**
 * The clinic's display currency.
 *
 * Only what is issued from now on is affected: every invoice carries the
 * currency it was issued in (`Invoice.currency`), so past invoices keep
 * reading as they always did. The change is audited because its
 * consequences are financial and, until this column existed, the only way
 * to know what an old invoice was priced in was to know when the setting
 * was last touched.
 */
export async function setClinicCurrency(
  input: ClinicSettingsInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "settings.manage");

  const clinic = await prisma.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: { currency: true },
  });
  if (!clinic) throw notFound("clinic", ctx.clinicId);
  if (clinic.currency === input.currency) return { currency: clinic.currency };

  await prisma.clinic.update({
    where: { id: ctx.clinicId },
    data: { currency: input.currency },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Clinic",
    entityId: ctx.clinicId,
    changes: { currency: { from: clinic.currency, to: input.currency } },
  });
  return { currency: input.currency };
}
