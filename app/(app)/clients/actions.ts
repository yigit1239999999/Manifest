"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { ownerSchema, toFieldErrors, type FormState } from "@/lib/validations";

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function createOwner(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = ownerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const owner = await prisma.owner.create({
    data: {
      clinicId: session.user.clinicId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: emptyToNull(data.email),
      phone: emptyToNull(data.phone),
      address: emptyToNull(data.address),
      notes: emptyToNull(data.notes),
    },
  });

  revalidatePath("/clients");
  revalidatePath("/");
  redirect(`/clients/${owner.id}`);
}

export async function updateOwner(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = ownerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const existing = await prisma.owner.findFirst({
    where: { id, clinicId: session.user.clinicId },
    select: { id: true },
  });
  if (!existing) {
    return { error: "This client could not be found." };
  }

  await prisma.owner.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: emptyToNull(data.email),
      phone: emptyToNull(data.phone),
      address: emptyToNull(data.address),
      notes: emptyToNull(data.notes),
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteOwner(id: string): Promise<void> {
  const session = await requireSession();
  const existing = await prisma.owner.findFirst({
    where: { id, clinicId: session.user.clinicId },
    select: { id: true },
  });
  if (existing) {
    await prisma.owner.delete({ where: { id } });
  }

  revalidatePath("/clients");
  revalidatePath("/");
  redirect("/clients");
}
