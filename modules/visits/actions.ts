"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { action, parse, type FormState } from "@/lib/action";
import { AppError, validationFailed } from "@/lib/errors";
import { intakeFrom, namedErrors, onScreen } from "./intake-fields";
import { visitIntakeSchema, visitSchema } from "./schema";
import {
  archiveVisit,
  createVisitWithIntake,
  restoreVisit,
  updateVisit,
} from "./service";

export const createVisitIntakeAction = action(
  "visit.createWithIntake",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = visitIntakeSchema(await getLocale()).safeParse(
      intakeFrom(formData),
    );
    if (!parsed.success) {
      return { fieldErrors: namedErrors(parsed.error) };
    }

    // The service's complaints, renamed to the boxes they are about.
    // Here rather than in `action()`: the wrapper serves nineteen
    // forms and this map is one form's vocabulary. Here rather than in
    // the service: it answers three screens and must not learn the
    // field names of any of them.
    const made = await createVisitWithIntake(parsed.data, ctx).catch(
      (error: unknown) => {
        if (
          error instanceof AppError &&
          error.code === "VALIDATION_FAILED" &&
          error.details?.fieldErrors
        ) {
          throw validationFailed(
            onScreen(error.details.fieldErrors as Record<string, string[]>),
          );
        }
        throw error;
      },
    );
    revalidatePath("/visits");
    revalidatePath("/pets");
    revalidatePath("/clients");
    revalidatePath("/");
    // What was born with this visit, so its page can say so once.
    //
    // A flag and not the words: "Limon" and "Ayşe" are the page's own,
    // read from the database, and a name in an address is a name that
    // can be edited by whoever holds the link. It is also not a
    // question the page could answer for itself -- nothing on the
    // record says whether the animal was made a minute ago or last
    // year, and guessing from timestamps would report a save that
    // never happened whenever two things are created in one second.
    //
    // Absent when nothing was made, which is the ordinary case: a
    // visit written against an animal already on file lands on a page
    // with no sentence, because there is nothing to say that the page
    // does not already say.
    const created = parsed.data.newPet
      ? parsed.data.newPet.owner
        ? "?created=animal,owner"
        : "?created=animal"
      : "";
    redirect(`/visits/${made.id}${created}`);
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
