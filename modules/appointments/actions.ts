"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { action, parse, type FormState } from "@/lib/action";
import { appointmentSchema } from "./schema";
import {
  cancelAppointment,
  createAppointment,
  updateAppointment,
} from "./service";

export const createAppointmentAction = action(
  "appointment.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(appointmentSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const { appointment, created, discarded } = await createAppointment(
      parsed.data,
      ctx,
    );
    revalidatePath("/appointments");
    revalidatePath(`/pets/${appointment.petId}`);
    revalidatePath(`/clients/${appointment.clientId}`);
    revalidatePath("/");

    // A second submission for the same animal at the same instant lands on
    // the appointment that already exists, and has to be told so — being
    // moved somewhere without explanation reads as the app losing what was
    // typed, which in part it did. `kept` distinguishes the two sentences
    // the page can truthfully say: one when the submission added nothing,
    // one when it carried details that were not saved.
    const notice = created ? "" : discarded ? "?existing=dropped" : "?existing=1";
    redirect(`/appointments/${appointment.id}${notice}`);
  },
);

export const updateAppointmentAction = action(
  "appointment.update",
  async (
    ctx,
    id: string,
    _prev: FormState,
    formData: FormData,
  ): Promise<FormState> => {
    const parsed = parse(appointmentSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const appointment = await updateAppointment(id, parsed.data, ctx);
    revalidatePath("/appointments");
    revalidatePath(`/appointments/${id}`);
    revalidatePath(`/pets/${appointment.petId}`);
    revalidatePath(`/clients/${appointment.clientId}`);
    redirect(`/appointments/${id}`);
  },
);

export const cancelAppointmentAction = action(
  "appointment.cancel",
  async (ctx, id: string): Promise<void> => {
    const { petId } = await cancelAppointment(id, ctx);
    revalidatePath("/appointments");
    revalidatePath(`/appointments/${id}`);
    revalidatePath(`/pets/${petId}`);
    revalidatePath("/");
  },
);
