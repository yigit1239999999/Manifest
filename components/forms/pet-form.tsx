"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { Client, Pet } from "@/generated/prisma/client";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { SPECIES, SEXES } from "@/modules/pets/schema";
import { createPetAction, updatePetAction } from "@/modules/pets/actions";
import { toDateInput } from "@/lib/format";

interface Props {
  pet?: Pet;
  owners: Pick<Client, "id" | "firstName" | "lastName">[];
  defaultOwnerId?: string;
}

export function PetForm({ pet, owners, defaultOwnerId }: Props) {
  const t = useTranslations("pet");
  const tSpecies = useTranslations("enum.species");
  const tSex = useTranslations("enum.sex");
  const tCommon = useTranslations("common");

  const action = pet
    ? updatePetAction.bind(null, pet.id)
    : createPetAction;
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Field label={t("owner")} error={state.fieldErrors?.ownerId} required>
        <Select
          name="ownerId"
          defaultValue={pet?.ownerId ?? defaultOwnerId ?? ""}
          required
        >
          <option value="" disabled>
            {tCommon("search")}
          </option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.firstName} {o.lastName}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("name")} error={state.fieldErrors?.name} required>
          <Input name="name" defaultValue={pet?.name} required />
        </Field>
        <Field label={t("species")} error={state.fieldErrors?.species} required>
          <Select
            name="species"
            defaultValue={pet?.species ?? "DOG"}
            required
          >
            {SPECIES.map((s) => (
              <option key={s} value={s}>
                {tSpecies(s)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("breed")} error={state.fieldErrors?.breed}>
          <Input name="breed" defaultValue={pet?.breed ?? ""} />
        </Field>
        <Field label={t("sex")} error={state.fieldErrors?.sex} required>
          <Select name="sex" defaultValue={pet?.sex ?? "UNKNOWN"} required>
            {SEXES.map((s) => (
              <option key={s} value={s}>
                {tSex(s)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("birthDate")} error={state.fieldErrors?.birthDate}>
          <Input
            type="date"
            name="birthDate"
            defaultValue={toDateInput(pet?.birthDate)}
          />
        </Field>
        <Field label={t("weightKg")} error={state.fieldErrors?.weightKg}>
          <Input
            type="number"
            step="0.01"
            min="0"
            name="weightKg"
            defaultValue={pet?.weightKg ?? ""}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("color")} error={state.fieldErrors?.color}>
          <Input name="color" defaultValue={pet?.color ?? ""} />
        </Field>
        <Field label={t("microchipId")} error={state.fieldErrors?.microchipId}>
          <Input name="microchipId" defaultValue={pet?.microchipId ?? ""} />
        </Field>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="neutered"
          defaultChecked={pet?.neutered ?? false}
          className="mt-0.5 size-4 rounded border-border"
        />
        <span className="text-foreground">{t("neutered")}</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("insuranceProvider")}
          error={state.fieldErrors?.insuranceProvider}
        >
          <Input
            name="insuranceProvider"
            defaultValue={pet?.insuranceProvider ?? ""}
          />
        </Field>
        <Field
          label={t("insurancePolicy")}
          error={state.fieldErrors?.insurancePolicy}
        >
          <Input
            name="insurancePolicy"
            defaultValue={pet?.insurancePolicy ?? ""}
          />
        </Field>
      </div>

      <Field label={t("alerts")} error={state.fieldErrors?.alerts}>
        <Textarea name="alerts" rows={2} defaultValue={pet?.alerts ?? ""} />
      </Field>

      <Field label={t("notes")} error={state.fieldErrors?.notes}>
        <Textarea name="notes" rows={4} defaultValue={pet?.notes ?? ""} />
      </Field>

      <SubmitButton>{pet ? t("update") : t("create")}</SubmitButton>
    </form>
  );
}
