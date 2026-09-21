"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { action, parse, type FormState } from "@/lib/action";
import { visitSchema } from "./schema";
import {
  archiveVisit,
  createVisit,
  restoreVisit,
  updateVisit,
} from "./service";

export const createVisitAction = action(
  "visit.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(visitSchema(await getLocale()), formData);
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
    const parsed = parse(visitSchema(await getLocale()), formData);
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
    revalidatePath(`/visits/${id}`);
    revalidatePath(`/pets/${petId}`);
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

export const restoreVisitAction = action(
  "visit.restore",
  async (ctx, id: string): Promise<void> => {
    const { petId } = await restoreVisit(id, ctx);
    revalidatePath("/visits");
    revalidatePath(`/visits/${id}`);
    revalidatePath(`/pets/${petId}`);
    revalidatePath("/");
  },
);
