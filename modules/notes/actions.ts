"use server";

import { revalidatePath } from "next/cache";
import { action, parse, type FormState } from "@/lib/action";
import { noteSchema } from "./schema";
import { createNote, deleteNote, togglePinned } from "./service";

export const createNoteAction = action(
  "note.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(noteSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const note = await createNote(parsed.data, ctx);
    if (note.petId) revalidatePath(`/pets/${note.petId}`);
    if (note.clientId) revalidatePath(`/clients/${note.clientId}`);
    return { success: true };
  },
);

export const deleteNoteAction = action(
  "note.delete",
  async (ctx, id: string): Promise<void> => {
    const note = await deleteNote(id, ctx);
    if (note.petId) revalidatePath(`/pets/${note.petId}`);
    if (note.clientId) revalidatePath(`/clients/${note.clientId}`);
  },
);

export const togglePinnedAction = action(
  "note.toggle_pinned",
  async (ctx, id: string): Promise<void> => {
    await togglePinned(id, ctx);
  },
);
