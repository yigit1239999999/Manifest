"use server";

import { revalidatePath } from "next/cache";
import { action, parse, type FormState } from "@/lib/action";
import { vaccinationSchema } from "./schema";
import {
  createVaccination,
  deleteVaccination,
  setVaccinationDueDismissed,
  setVaccineSettings,
} from "./service";

export const createVaccinationAction = action(
  "vaccination.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(vaccinationSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    await createVaccination(parsed.data, ctx);
    return { success: true };
  },
);

export const deleteVaccinationAction = action(
  "vaccination.delete",
  async (ctx, id: string): Promise<void> => {
    const { petId } = await deleteVaccination(id, ctx);
    revalidatePath(`/pets/${petId}`);
  },
);

/**
 * Closes an overdue row on the dashboard, or puts it back. Both
 * directions through one action so the screen can offer an undo
 * without a second round trip to find out what it undid.
 */
export const setVaccinationDueDismissedAction = action(
  "vaccination.dueDismissed",
  async (ctx, id: string, dismissed: boolean): Promise<FormState> => {
    await setVaccinationDueDismissed(id, dismissed, ctx);
    return { success: true };
  },
);

/**
 * The clinic's own version of the vaccine list.
 *
 * Parsed by hand rather than with a schema, because the shape is three
 * parallel arrays from one form and a zod object would have to describe
 * the transport rather than the value. What is safe about it is not this
 * function: `setVaccineSettings` normalises everything it is given, and
 * drops anything it cannot read rather than repairing it.
 *
 * The checkbox is "on the list", not "hidden". A screen full of boxes
 * where ticking one REMOVES something is a screen people get wrong, and
 * getting it wrong here means a vet loses a vaccine from their form and
 * has no idea why.
 */
export const setVaccineSettingsAction = action(
  "vaccination.settings",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const allKeys = formData.getAll("catalogueKey").map(String);
    const shown = new Set(formData.getAll("shown").map(String));
    const hidden = allKeys.filter((key) => !shown.has(key));

    const intervals: Record<string, { unit: string; value: number }> = {};
    for (const key of allKeys) {
      const raw = String(formData.get(`interval-${key}`) ?? "").trim();
      if (raw === "") continue;
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 1) continue;
      intervals[key] = { unit: String(formData.get(`unit-${key}`) ?? "year"), value };
    }

    const names = formData.getAll("addedName").map((v) => String(v).trim());
    const speciesList = formData.getAll("addedSpecies").map(String);
    const values = formData.getAll("addedValue").map((v) => String(v).trim());
    const units = formData.getAll("addedUnit").map(String);
    const added = names
      .map((name, i) => ({
        name,
        species: speciesList[i] ?? "",
        interval:
          values[i] && Number.isInteger(Number(values[i])) && Number(values[i]) >= 1
            ? { unit: units[i] ?? "year", value: Number(values[i]) }
            : undefined,
      }))
      // A blank row is how the screen offers "add one"; it is not an entry.
      .filter((entry) => entry.name !== "" && entry.species !== "");

    await setVaccineSettings(
      { hidden, intervals, added } as never,
      ctx,
    );
    return { success: true };
  },
);
