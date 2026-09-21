"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { action, parse, type FormState } from "@/lib/action";
import { petSchema } from "./schema";
import { quickSearchPets } from "./queries";
import { PAGE_SIZES } from "@/lib/pagination";
import { requireSession } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
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
  async (ctx, id: string, deceasedAt: Date): Promise<void> => {
    await markPetDeceased(id, deceasedAt, ctx);
    revalidatePath(`/pets/${id}`);
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
): Promise<
  {
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
  }[]
> {
  const session = await requireSession();
  requirePermission(session.user.role ?? "", "pets.read");
  const rows = await quickSearchPets(
    session.user.clinicId,
    term,
    PAGE_SIZES.SEARCH_RESULTS,
    ownerId,
  );
  return rows.map((p) => ({
    value: p.id,
    label: `${p.name} · ${p.owner.firstName} ${p.owner.lastName}`,
    ownerId: p.ownerId,
    ownerLabel: `${p.owner.firstName} ${p.owner.lastName}`,
  }));
}
