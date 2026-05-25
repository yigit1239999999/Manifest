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

    const appointment = await createAppointment(parsed.data, ctx);
    revalidatePath("/appointments");
    revalidatePath(`/pets/${appointment.petId}`);
    revalidatePath(`/clients/${appointment.clientId}`);
    revalidatePath("/");
    redirect(`/appointments/${appointment.id}`);
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
