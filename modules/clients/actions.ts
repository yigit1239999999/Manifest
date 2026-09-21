"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { action, parse, type FormState } from "@/lib/action";
import { clientSchema } from "./schema";
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
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
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

export const restoreClientAction = action(
  "client.restore",
  async (ctx, id: string): Promise<void> => {
    await restoreClient(id, ctx);
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
  },
);
