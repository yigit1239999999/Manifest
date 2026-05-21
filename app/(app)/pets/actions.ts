"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { petSchema, toFieldErrors, type FormState } from "@/lib/validations";

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function createPet(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = petSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const owner = await prisma.owner.findFirst({
    where: { id: data.ownerId, clinicId: session.user.clinicId },
    select: { id: true },
  });
  if (!owner) {
    return { fieldErrors: { ownerId: ["Choose a valid client"] } };
  }

  const pet = await prisma.pet.create({
    data: {
      clinicId: session.user.clinicId,
      ownerId: data.ownerId,
      name: data.name,
      species: data.species,
      sex: data.sex,
      breed: emptyToNull(data.breed),
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      color: emptyToNull(data.color),
      weightKg: data.weightKg ? Number(data.weightKg) : null,
      microchipId: emptyToNull(data.microchipId),
      notes: emptyToNull(data.notes),
    },
  });

  revalidatePath("/pets");
  revalidatePath("/");
  revalidatePath(`/clients/${data.ownerId}`);
  redirect(`/pets/${pet.id}`);
}

export async function updatePet(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = petSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const existing = await prisma.pet.findFirst({
    where: { id, clinicId: session.user.clinicId },
    select: { id: true, ownerId: true },
  });
  if (!existing) {
    return { error: "This pet could not be found." };
  }

  const owner = await prisma.owner.findFirst({
    where: { id: data.ownerId, clinicId: session.user.clinicId },
    select: { id: true },
  });
  if (!owner) {
    return { fieldErrors: { ownerId: ["Choose a valid client"] } };
  }

  await prisma.pet.update({
    where: { id },
    data: {
      ownerId: data.ownerId,
      name: data.name,
      species: data.species,
      sex: data.sex,
      breed: emptyToNull(data.breed),
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      color: emptyToNull(data.color),
      weightKg: data.weightKg ? Number(data.weightKg) : null,
      microchipId: emptyToNull(data.microchipId),
      notes: emptyToNull(data.notes),
    },
  });

  revalidatePath("/pets");
  revalidatePath(`/pets/${id}`);
  revalidatePath(`/clients/${data.ownerId}`);
  revalidatePath(`/clients/${existing.ownerId}`);
  redirect(`/pets/${id}`);
}

export async function deletePet(id: string): Promise<void> {
  const session = await requireSession();
  const existing = await prisma.pet.findFirst({
    where: { id, clinicId: session.user.clinicId },
    select: { id: true, ownerId: true },
  });
  if (existing) {
    await prisma.pet.delete({ where: { id } });
    revalidatePath(`/clients/${existing.ownerId}`);
  }

  revalidatePath("/pets");
  revalidatePath("/");
  redirect("/pets");
}
