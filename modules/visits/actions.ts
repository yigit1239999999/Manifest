"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { action, parse, type FormState } from "@/lib/action";
import { visitSchema } from "./schema";
import { archiveVisit, createVisit, updateVisit } from "./service";

export const createVisitAction = action(
  "visit.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(visitSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const visit = await createVisit(parsed.data, ctx);
    revalidatePath("/visits");
    revalidatePath(`/pets/${visit.petId}`);
    revalidatePath(`/clients/${visit.clientId}`);
    revalidatePath("/");
    redirect(`/visits/${visit.id}`);
  },
);

export const updateVisitAction = action(
  "visit.update",
  async (
    ctx,
    id: string,
    _prev: FormState,
    formData: FormData,
  ): Promise<FormState> => {
    const parsed = parse(visitSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const visit = await updateVisit(id, parsed.data, ctx);
    revalidatePath("/visits");
    revalidatePath(`/visits/${id}`);
    revalidatePath(`/pets/${visit.petId}`);
    revalidatePath(`/clients/${visit.clientId}`);
    redirect(`/visits/${id}`);
  },
);

export const archiveVisitAction = action(
  "visit.archive",
  async (ctx, id: string): Promise<void> => {
    const { petId } = await archiveVisit(id, ctx);
    revalidatePath("/visits");
    revalidatePath(`/pets/${petId}`);
    revalidatePath("/");
    redirect(`/pets/${petId}`);
  },
);
