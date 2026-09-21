"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { action, parse, type FormState } from "@/lib/action";
import { intakeFrom, namedErrors } from "./intake-fields";
import { visitIntakeSchema, visitSchema } from "./schema";
import {
  archiveVisit,
  createVisit,
  createVisitWithIntake,
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

export const createVisitIntakeAction = action(
  "visit.createWithIntake",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = visitIntakeSchema(await getLocale()).safeParse(
      intakeFrom(formData),
    );
    if (!parsed.success) {
      return { fieldErrors: namedErrors(parsed.error) };
    }

    const made = await createVisitWithIntake(parsed.data, ctx);
    revalidatePath("/visits");
    revalidatePath("/pets");
    revalidatePath("/clients");
    revalidatePath("/");
    redirect(`/visits/${made.id}`);
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
    await archiveVisit(id, ctx);
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
    await restoreVisit(id, ctx);
  },
);
