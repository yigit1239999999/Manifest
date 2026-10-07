"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { action, type FormState } from "@/lib/action";
import { mergeClients, mergePreview, type MergeCounts } from "./merge";

/** The numbers the confirmation states before anything moves. */
export const mergePreviewAction = action(
  "client.mergePreview",
  async (
    ctx,
    sourceId: string,
    targetId: string,
  ): Promise<FormState & { counts?: MergeCounts; source?: string; target?: string }> => {
    const preview = await mergePreview(sourceId, targetId, ctx);
    return { success: true, ...preview };
  },
);

export const mergeClientsAction = action(
  "client.merge",
  async (ctx, sourceId: string, targetId: string): Promise<FormState> => {
    await mergeClients(sourceId, targetId, ctx);
    revalidatePath("/clients");
    revalidatePath(`/clients/${sourceId}`);
    revalidatePath(`/clients/${targetId}`);
    // To the record that now holds everything: the one this started on is
    // archived and empty.
    redirect(`/clients/${targetId}?merged=1`);
  },
);
