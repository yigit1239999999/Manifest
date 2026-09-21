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

/**
 * Closes the dashboard's first-step card, or puts it back.
 *
 * The card names the one link of the mandatory chain that is missing,
 * and it goes away on its own as soon as that link exists -- so a
 * clinic doing the work never needs this. The clinic that does is the
 * one being asked for something it has decided not to do yet, and a
 * prompt with no way out is read once, ignored twice, and then stops
 * being read: the card would spend exactly the attention it exists to
 * collect.
 *
 * Reversible on purpose. "I do not want this today" is a much smaller
 * statement than "never show me this again", and a click that quietly
 * made the larger one would be a trap -- the same reason
 * `setVaccinationDueDismissed` clears its stamp instead of hiding the
 * row for good.
 *
 * PERMISSION: `clients.write`, which is the floor of the chain the card
 * talks about, and it follows the dismiss precedent -- you may close
 * what you could have done. It leaves a technician out, who has neither
 * `clients.write` nor `pets.write`, sees the card's waiting sentence
 * rather than its button, and would otherwise be deciding for the whole
 * clinic about a prompt they cannot act on. Asked of pm rather than
 * settled here; a different answer is this one line and its test.
 */
export async function setFirstStepHidden(hidden: boolean, ctx: ActionContext) {
  requirePermission(ctx.userRole, "clients.write");

  const clinic = await prisma.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: { firstStepHiddenAt: true },
  });
  if (!clinic) throw notFound("clinic", ctx.clinicId);

  const hiddenAt = hidden ? new Date() : null;
  // Nothing to say and nothing to audit: closing a closed card is what
  // a double click is, not a decision.
  if (Boolean(clinic.firstStepHiddenAt) === hidden) {
    return { firstStepHiddenAt: clinic.firstStepHiddenAt };
  }

  await prisma.clinic.update({
    where: { id: ctx.clinicId },
    data: { firstStepHiddenAt: hiddenAt },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Clinic",
    entityId: ctx.clinicId,
    changes: { firstStepHidden: hidden },
  });
  return { firstStepHiddenAt: hiddenAt };
}
