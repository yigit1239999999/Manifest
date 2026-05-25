"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { action, parse, type FormState } from "@/lib/action";
import { petSchema } from "./schema";
import { archivePet, createPet, updatePet, markPetDeceased } from "./service";

export const createPetAction = action(
  "pet.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(petSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const pet = await createPet(parsed.data, ctx);
    revalidatePath("/pets");
    revalidatePath(`/clients/${pet.ownerId}`);
    revalidatePath("/");
    redirect(`/pets/${pet.id}`);
  },
);

export const updatePetAction = action(
  "pet.update",
  async (
    ctx,
    id: string,
    _prev: FormState,
    formData: FormData,
  ): Promise<FormState> => {
    const parsed = parse(petSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const pet = await updatePet(id, parsed.data, ctx);
    revalidatePath("/pets");
    revalidatePath(`/pets/${id}`);
    revalidatePath(`/clients/${pet.ownerId}`);
    redirect(`/pets/${id}`);
  },
);

export const archivePetAction = action(
  "pet.archive",
  async (ctx, id: string): Promise<void> => {
    const { ownerId } = await archivePet(id, ctx);
    revalidatePath("/pets");
    revalidatePath(`/clients/${ownerId}`);
    revalidatePath("/");
    redirect("/pets");
  },
);

export const markDeceasedAction = action(
  "pet.mark_deceased",
  async (ctx, id: string, deceasedAt: Date): Promise<void> => {
    await markPetDeceased(id, deceasedAt, ctx);
    revalidatePath(`/pets/${id}`);
  },
);
