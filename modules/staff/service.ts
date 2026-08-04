import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { conflict, notFound } from "@/lib/errors";
import { redact, withAudited } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { StaffInput } from "./schema";

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
    select: { id: true },
  });
  if (!existing) throw notFound("user", id);

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: active ? "RESTORE" : "ARCHIVE",
      entityType: "User",
      entityId: id,
    },
    (tx) =>
      tx.user.update({
        where: { id },
        data: { active },
        select: { id: true },
      }),
  );
}
