"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { action, parse, type FormState } from "@/lib/action";
import { petSchema } from "./schema";
import {
  archivePet,
  createPet,
  markPetDeceased,
  restorePet,
  updatePet,
} from "./service";

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
    revalidatePath(`/pets/${id}`);
    revalidatePath(`/clients/${ownerId}`);
    revalidatePath("/");
    // No redirect: archiving is a state change on a record that still
    // exists, and its own page is the one place that says so and offers
    // the way back. Being thrown to the list instead hides the notice and
    // the "Restore" beside it, so a reversible action reads as a removal —
    // which is the thing backlog 39 was about (TEAM.md #25). The three
    // archive actions used to land in three different places; they now
    // all stay put (TEAM.md #18).
  },
);

export const restorePetAction = action(
  "pet.restore",
  async (ctx, id: string): Promise<void> => {
    const { ownerId } = await restorePet(id, ctx);
    revalidatePath("/pets");
    revalidatePath(`/pets/${id}`);
    revalidatePath(`/clients/${ownerId}`);
    revalidatePath("/");
  },
);

export const markDeceasedAction = action(
  "pet.mark_deceased",
  async (ctx, id: string, deceasedAt: Date): Promise<void> => {
    await markPetDeceased(id, deceasedAt, ctx);
    revalidatePath(`/pets/${id}`);
  },
);
