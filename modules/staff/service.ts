import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { conflict, notFound } from "@/lib/errors";
import { redact, withAudited, writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { StaffInput } from "./schema";

/** The only role that carries `users.manage` (see lib/permissions.ts). */
const ADMIN_ROLE = "ADMIN";

export async function createStaff(input: StaffInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "users.manage");

  // Emails are globally unique across clinics (sign-in identifier), so the
  // check can't be scoped to the tenant.
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) throw conflict("error.conflict.emailInUse");

  const { password, ...rest } = input;
  const passwordHash = await bcrypt.hash(password, 10);

  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "CREATE",
      entityType: "User",
      changes: redact(rest),
    },
    (tx) =>
      tx.user.create({
        data: { ...rest, passwordHash, clinicId: ctx.clinicId },
        select: { id: true },
      }),
  );
}

export async function setStaffActive(
  id: string,
  active: boolean,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "users.manage");

  const existing = await prisma.user.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, role: true },
  });
  if (!existing) throw notFound("user", id);

  // Deactivating the last administrator locks the clinic out of its own
  // staff, settings and permissions, and nobody left inside can undo it —
  // the way back is a hand-written database update. The page hides the
  // button, but a hidden button is not a rule.
  //
  // Serializable so two admins deactivating each other at the same moment
  // cannot both pass a count taken before the other's write, which would
  // leave the clinic with none.
  await prisma.$transaction(
    async (tx) => {
      if (!active && existing.role === ADMIN_ROLE) {
        const otherAdmins = await tx.user.count({
          where: {
            clinicId: ctx.clinicId,
            role: ADMIN_ROLE,
            active: true,
            id: { not: id },
          },
        });
        if (otherAdmins === 0) throw conflict("error.conflict.lastAdmin");
      }

      await tx.user.update({
        where: { id },
        data: { active },
        select: { id: true },
      });

      await writeAudit(
        {
          clinicId: ctx.clinicId,
          actorId: ctx.userId,
          action: active ? "RESTORE" : "ARCHIVE",
          entityType: "User",
          entityId: id,
        },
        tx,
      );
    },
    { isolationLevel: "Serializable" },
  );
}
