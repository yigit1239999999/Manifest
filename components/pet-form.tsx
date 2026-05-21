"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import type { FormState } from "@/lib/validations";
import { SPECIES, SEXES } from "@/lib/validations";
import { speciesLabel, sexLabel } from "@/lib/format";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";

type OwnerOption = { id: string; name: string };

type PetDefaults = {
  name?: string | null;
  species?: string | null;
  ownerId?: string | null;
  breed?: string | null;
  sex?: string | null;
  birthDate?: string | null;
  color?: string | null;
  weightKg?: number | string | null;
  microchipId?: string | null;
  notes?: string | null;
};

export function PetForm({
  action,
  owners,
  defaultValues,
  submitLabel = "Save pet",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  owners: OwnerOption[];
  defaultValues?: PetDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Pet name" htmlFor="name" required error={state.fieldErrors?.name}>
          <Input
            id="name"
            name="name"
            defaultValue={defaultValues?.name ?? ""}
            placeholder="Biscuit"
            required
          />
        </Field>

        <Field
          label="Owner"
          htmlFor="ownerId"
          required
          error={state.fieldErrors?.ownerId}
        >
          <Select
            id="ownerId"
            name="ownerId"
            defaultValue={defaultValues?.ownerId ?? ""}
            required
          >
            <option value="" disabled>
              Select a client…
            </option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Species"
          htmlFor="species"
          required
          error={state.fieldErrors?.species}
        >
          <Select
            id="species"
            name="species"
            defaultValue={defaultValues?.species ?? "DOG"}
          >
            {SPECIES.map((species) => (
              <option key={species} value={species}>
                {speciesLabel(species)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Breed" htmlFor="breed" error={state.fieldErrors?.breed}>
          <Input
            id="breed"
            name="breed"
            defaultValue={defaultValues?.breed ?? ""}
            placeholder="Golden Retriever"
          />
        </Field>

        <Field label="Sex" htmlFor="sex" error={state.fieldErrors?.sex}>
          <Select
            id="sex"
            name="sex"
            defaultValue={defaultValues?.sex ?? "UNKNOWN"}
          >
            {SEXES.map((sex) => (
              <option key={sex} value={sex}>
                {sexLabel(sex)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Date of birth"
          htmlFor="birthDate"
          error={state.fieldErrors?.birthDate}
        >
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            defaultValue={defaultValues?.birthDate ?? ""}
          />
        </Field>

        <Field label="Color / markings" htmlFor="color" error={state.fieldErrors?.color}>
          <Input
            id="color"
            name="color"
            defaultValue={defaultValues?.color ?? ""}
            placeholder="Golden"
          />
        </Field>

        <Field
          label="Weight (kg)"
          htmlFor="weightKg"
          error={state.fieldErrors?.weightKg}
        >
          <Input
            id="weightKg"
            name="weightKg"
            type="number"
            step="0.1"
            min="0"
            defaultValue={
              defaultValues?.weightKg != null ? String(defaultValues.weightKg) : ""
            }
            placeholder="12.5"
          />
        </Field>
      </div>

      <Field
        label="Microchip ID"
        htmlFor="microchipId"
        error={state.fieldErrors?.microchipId}
      >
        <Input
          id="microchipId"
          name="microchipId"
          defaultValue={defaultValues?.microchipId ?? ""}
          placeholder="985 1120 0… "
        />
      </Field>

      <Field
        label="Notes"
        htmlFor="notes"
        error={state.fieldErrors?.notes}
        hint="Temperament, allergies, anything the care team should know."
      >
        <Textarea
          id="notes"
          name="notes"
          defaultValue={defaultValues?.notes ?? ""}
          rows={3}
        />
      </Field>

      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <SubmitButton>
          <Save />
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
