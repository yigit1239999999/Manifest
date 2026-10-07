"use server";

import { action, type FormState } from "@/lib/action";
import { ARRIVAL_STATUSES, setArrival, undoArrival, type ArrivalStatus } from "./arrival";
import { conflict } from "@/lib/errors";

/**
 * One tap from a row: "came" or "did not come". Returns the status it
 * replaced so the toast can offer the way back without asking again.
 * No `revalidatePath`: the button refreshes the page it is on, and a
 * value-returning action that also revalidates races the client.
 */
export const setArrivalAction = action(
  "appointment.arrival",
  async (ctx, id: string, status: ArrivalStatus): Promise<FormState & { previous?: string }> => {
    if (!(ARRIVAL_STATUSES as readonly string[]).includes(status))
      throw conflict("error.validation.appointmentNotWaiting");
    const { previous } = await setArrival(id, status, ctx);
    return { success: true, previous };
  },
);

export const undoArrivalAction = action(
  "appointment.arrival.undo",
  async (ctx, id: string, previous: string): Promise<FormState> => {
    await undoArrival(id, previous, ctx);
    return { success: true };
  },
);
