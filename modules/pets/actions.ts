"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { action, parse, type FormState } from "@/lib/action";
import { deceasedSchema, petSchema } from "./schema";
import { quickSearchPets } from "./queries";
import { PAGE_SIZES } from "@/lib/pagination";
import { ownerLabel, petRowCaption, petRowLabel } from "@/lib/pet-label";
import { getFormatContext } from "@/lib/format-context";
import { relativeTime } from "@/lib/format";
import { getTranslations } from "next-intl/server";
import { safeNext, withCreated } from "@/lib/next-param";
import { requireSession } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import {
  archivePet,
  createPet,
  markPetDeceased,
  restorePet,
  unmarkPetDeceased,
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
    // Same errand as `createClientAction`, one link further up: the
    // animal the visit form was waiting for.
    const next = safeNext(formData.get("next")?.toString());
    if (next) redirect(withCreated(next, "pet", pet.id));
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

    const t = await getTranslations("pet.ownerChange");
    const pet = await updatePet(id, parsed.data, ctx, {
      confirmed: Boolean(formData.get("confirmOwnerChange")),
      describe: (names) => t("note", names),
    });
    revalidatePath("/pets");
    revalidatePath(`/pets/${id}`);
    revalidatePath(`/clients/${pet.ownerId}`);
    redirect(`/pets/${id}`);
  },
);

export const archivePetAction = action(
  "pet.archive",
  async (ctx, id: string): Promise<void> => {
    await archivePet(id, ctx);
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
    await restorePet(id, ctx);
  },
);

export const markDeceasedAction = action(
  "pet.mark_deceased",
  async (ctx, id: string, formData: FormData): Promise<FormState> => {
    const parsed = parse(deceasedSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
    await markPetDeceased(id, parsed.data, ctx);
    // No revalidatePath: the dialog reloads the page (see ConfirmDialog's
    // `reloadAfter`), and a value-returning action must not race it.
    return { success: true };
  },
);

export const unmarkDeceasedAction = action(
  "pet.unmark_deceased",
  async (ctx, id: string): Promise<FormState> => {
    await unmarkPetDeceased(id, ctx);
    return { success: true };
  },
);

/**
 * Animals matching what someone has typed into a picker. See
 * `searchClientsAction` for the shape and the reasoning.
 *
 * The owner's name is part of the label, and here it earns its place: a
 * search spans owners by definition, and two animals called Karabaş are
 * indistinguishable without it.
 */
export async function searchPetsAction(
  term: string,
  /**
   * Passed by a form that has already chosen the client, so the search
   * answers within that choice. Omitted, the search spans the clinic --
   * which is right for a form where the animal is the first question.
   */
  ownerId?: string,
): Promise<{
  /** See `searchClientsAction` for why this is a pair and not an array. */
  options: {
    value: string;
    label: string;
    /**
     * The owner, alongside the label rather than only inside it.
     *
     * A picker that narrows another one — pick the animal, the client
     * fills itself in — needs the owner as data it can set, and a
     * controlled client picker needs the owner's *name* to display what
     * it was given. Parsing them back out of the label would make the
     * separator between them load-bearing.
     */
    ownerId: string;
    ownerLabel: string;
  }[];
  hasMore: boolean;
}> {
  return searchPets(term, ownerId, false);
}

/**
 * `searchPetsAction` without the animals that have died, for the booking
 * form: its server refuses them (`createAppointment`), so offering one
 * walks reception into a dead end (pm booked Fındık).
 */
export async function searchBookablePetsAction(term: string, ownerId?: string) {
  return searchPets(term, ownerId, true);
}

async function searchPets(term: string, ownerId: string | undefined, excludeDeceased: boolean) {
  const session = await requireSession();
  requirePermission(session.user.role ?? "", "pets.read");
  const [{ items, hasMore }, fmt, tSpecies] = await Promise.all([
    quickSearchPets(
      session.user.clinicId,
      term,
      PAGE_SIZES.SEARCH_RESULTS,
      ownerId,
      excludeDeceased,
    ),
    getFormatContext(),
    getTranslations("enum.species"),
  ]);
  return {
    options: items.map((p) => ({
      value: p.id,
      // Two lines, because this is the row somebody CHOOSES from: see
      // `petRowLabel`. `petLabel` is still what one-line places use.
      label: petRowLabel(
        p.name,
        p.customSpecies?.name ?? tSpecies(p.species),
      ),
      caption: petRowCaption(
        ownerLabel(p.owner),
        p.lastVisitAt ? relativeTime(fmt, p.lastVisitAt) : null,
      ),
      ownerId: p.ownerId,
      ownerLabel: ownerLabel(p.owner),
    })),
    hasMore,
  };
}
