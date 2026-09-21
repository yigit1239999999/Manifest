"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { action, parse, type FormState } from "@/lib/action";
import { clientSchema } from "./schema";
import { quickSearchClients } from "./queries";
import { PAGE_SIZES } from "@/lib/pagination";
import { requireSession } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import {
  archiveClient,
  createClient,
  restoreClient,
  updateClient,
} from "./service";

export const createClientAction = action(
  "client.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(clientSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const client = await createClient(parsed.data, ctx);
    revalidatePath("/clients");
    revalidatePath("/");
    redirect(`/clients/${client.id}`);
  },
);

export const updateClientAction = action(
  "client.update",
  async (
    ctx,
    id: string,
    _prev: FormState,
    formData: FormData,
  ): Promise<FormState> => {
    const parsed = parse(clientSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    await updateClient(id, parsed.data, ctx);
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    redirect(`/clients/${id}`);
  },
);

export const archiveClientAction = action(
  "client.archive",
  async (ctx, id: string): Promise<void> => {
    await archiveClient(id, ctx);
    // No redirect: archiving is a state change on a record that still
    // exists, and its own page is the one place that says so and offers
    // the way back. Being thrown to the list instead hides the notice and
    // the "Restore" beside it, so a reversible action reads as a removal —
    // which is the thing backlog 39 was about (TEAM.md #25). The three
    // archive actions used to land in three different places; they now
    // all stay put (TEAM.md #18).
  },
);

export const restoreClientAction = action(
  "client.restore",
  async (ctx, id: string): Promise<void> => {
    await restoreClient(id, ctx);
  },
);

/**
 * Clients matching what someone has typed into a picker.
 *
 * The pickers were handed the first five hundred clients and filtered them
 * in the browser, so past that the rest were not merely hard to find —
 * they were absent, and searching could not reach them. This is the way
 * in: the query runs where the rows are.
 *
 * Shaped as `{ value, label }` because that is all a picker needs. Handing
 * back rows would send the phone, the address and the notes over the wire
 * to draw one line of text.
 *
 * Below two characters it returns nothing rather than the first page of
 * everybody — two letters is the shortest search worth running against a
 * whole clinic — and the picker tells "type more" from "no matches" by
 * looking at what was typed, not at the empty array.
 *
 * Outside the `action()` wrapper on purpose: that wrapper exists to turn a
 * thrown `AppError` into a `FormState` for a form to render, and this
 * returns data to a component rather than a result to a form. Session and
 * permission are still checked, which is what the wrapper was giving it.
 */
/**
 * Why a pair and not an array.
 *
 * The picker shows a note when the list it has is not all there is.
 * With a bare array it could only guess, by comparing the length to
 * the cap -- the same fact written in two places, disagreeing the day
 * the cap moves. Worse, the guess was wrong in the ordinary case: a
 * search for "sa" matching three clients showed all three AND told the
 * vet records were missing.
 *
 * dev-ui tried silencing the note and reverted it in one sentence:
 * replacing a known lie with an unknown one is not progress, and this
 * direction is worse -- "there is more" keeps a vet searching, "that is
 * all" stops them.
 *
 * So the server says whether it truncated, because the server is the
 * only one that knows. `listClients` has answered this question this
 * way since it was written; this is the search path catching up, not a
 * new idea.
 */
export async function searchClientsAction(term: string): Promise<{
  options: {
    value: string;
    label: string;
    /**
     * What a form needs to warn before it saves, carried beside the
     * label rather than derived later.
     *
     * A reminder for a client with no consent, or no number, is a
     * record that will sit there forever looking like work in
     * progress. The form says so before it is written -- but it takes
     * clients from two places, this search and the page's own list,
     * and a warning present on one path only is the defect it was
     * written to prevent: right often enough to be trusted, missing
     * exactly when the clinic got big enough to cap the list.
     *
     * `notificationsOptIn` is three-valued on purpose. `false` is a
     * refusal and there is nothing to do about it; `null` is a
     * question nobody asked, and that is a phone call.
     */
    phone: string | null;
    notificationsOptIn: boolean | null;
  }[];
  hasMore: boolean;
}> {
  const session = await requireSession();
  requirePermission(session.user.role ?? "", "clients.read");
  const { items, hasMore } = await quickSearchClients(
    session.user.clinicId,
    term,
    PAGE_SIZES.SEARCH_RESULTS,
  );
  return {
    options: items.map((c) => ({
      value: c.id,
      label: `${c.firstName} ${c.lastName}`,
      phone: c.phone,
      notificationsOptIn: c.notificationsOptIn,
    })),
    hasMore,
  };
}
