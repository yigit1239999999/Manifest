"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import type { Client, Pet } from "@/generated/prisma/client";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { SpeciesPicker } from "@/components/species-picker";
import { SubmitButton } from "@/components/submit-button";
import { SPECIES, SEXES } from "@/modules/pets/schema";
import { createPetAction, updatePetAction } from "@/modules/pets/actions";
import { toDateInput } from "@/lib/format";
import { BREEDS } from "@/lib/breeds";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

interface Props {
  pet?: Pet;
  owners: Pick<Client, "id" | "firstName" | "lastName">[];
  /** See `InvoiceForm`: true when the list was cut off at its cap. */
  ownersCapped?: boolean;
  defaultOwnerId?: string;
  /** Clinic-defined species (beyond the built-in enum). */
  customSpecies?: { id: string; name: string }[];
  /** Breeds this clinic already used, keyed by species ("DOG" | "custom:<id>"). */
  clinicBreeds?: { speciesKey: string; breed: string }[];
  /** Built-in species this clinic chose to show (Settings → Species). */
  enabledSpecies?: readonly string[];
  /** Link to the species settings page, only for users who may manage it. */
  manageHref?: string;
}

export function PetForm({
  pet,
  owners,
  ownersCapped,
  defaultOwnerId,
  customSpecies = [],
  clinicBreeds = [],
  enabledSpecies = SPECIES,
  manageHref,
}: Props) {
  const t = useTranslations("pet");
  const tSpecies = useTranslations("enum.species");
  const tSex = useTranslations("enum.sex");
  const tCommon = useTranslations("common");

  const action = pet ? updatePetAction.bind(null, pet.id) : createPetAction;
  const form = useActionForm(action, {});
  const { state } = form;

  // "DOG" | ... | "custom:<id>" | free text for a brand-new species.
  // New pets start blank so the vet consciously picks a species.
  const initialSpeciesKey = pet
    ? pet.customSpeciesId
      ? `custom:${pet.customSpeciesId}`
      : pet.species
    : "";
  const [speciesKey, setSpeciesKey] = useState<string>(initialSpeciesKey);

  const speciesChoices = useMemo(() => {
    // Enabled built-ins, plus the pet's own species if it was hidden later.
    const builtIns = SPECIES.filter(
      (s) => enabledSpecies.includes(s) || s === pet?.species,
    );
    return [
      ...builtIns.map((s) => ({ value: s, label: tSpecies(s), icon: s })),
      ...customSpecies.map((cs) => ({
        value: `custom:${cs.id}`,
        label: cs.name,
        icon: "OTHER",
      })),
    ];
  }, [enabledSpecies, customSpecies, pet?.species, tSpecies]);

  const breedOptions = useMemo(() => {
    const catalog = BREEDS[speciesKey] ?? [];
    const used = clinicBreeds
      .filter((b) => b.speciesKey === speciesKey)
      .map((b) => b.breed);
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const b of [...used, ...catalog]) {
      const key = b.toLocaleLowerCase("tr");
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(b);
      }
    }
    return merged.map((b) => ({ value: b, label: b }));
  }, [speciesKey, clinicBreeds]);

  // When editing, a pet that already has optional data shows it expanded.
  const hasOptionalData = Boolean(
    pet &&
      (pet.birthDate ||
        pet.weightKg != null ||
        pet.color ||
        pet.neutered ||
        pet.microchipId ||
        pet.insuranceProvider ||
        pet.insurancePolicy ||
        pet.alerts ||
        pet.notes),
  );

  return (
    <ActionForm form={form} className="flex flex-col gap-8">

      {/* The essentials: everything a vet needs to register an animal in
          under a minute. Everything else lives under "optional details". */}
      <FormSection title={t("sections.identity")} description={t("sections.identityHint")}>
        <Field
          label={t("owner")}
          error={state.fieldErrors?.ownerId}
          hint={
            ownersCapped
              ? tCommon("listCapped", { count: owners.length })
              : undefined
          }
          required
        >
          <Select
            name="ownerId"
            defaultValue={pet?.ownerId ?? defaultOwnerId ?? ""}
            required
          >
            <option value="" disabled>
              {tCommon("select")}
            </option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.firstName} {o.lastName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("name")} error={state.fieldErrors?.name} required>
          <Input name="name" defaultValue={pet?.name} required autoFocus={!pet} />
        </Field>

        <Field label={t("species")} error={state.fieldErrors?.species} required>
          <SpeciesPicker
            name="species"
            // The `<label>` above cannot reach a `div[role="group"]`, so
            // the group is named here with the same word.
            label={t("species")}
            options={speciesChoices}
            defaultValue={initialSpeciesKey}
            onChange={setSpeciesKey}
            newLabel={t("newSpecies")}
            newHint={t("newSpeciesHint")}
            newPlaceholder={t("newSpeciesPlaceholder")}
            addLabel={tCommon("add")}
            manageHref={manageHref}
            manageLabel={manageHref ? t("manageSpecies") : undefined}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("breed")} error={state.fieldErrors?.breed}>
            <Combobox
              key={speciesKey}
              name="breed"
              freeText
              options={breedOptions}
              defaultValue={pet?.breed ?? ""}
              placeholder={tCommon("searchOrType")}
              noResultsLabel={tCommon("noResults")}
            />
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
      </FormSection>

      <details
        open={hasOptionalData}
        className="group rounded-surface border border-border bg-muted/20 open:bg-transparent"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
          <span className="flex flex-col">
            <span className="font-semibold text-foreground">{t("optionalDetails")}</span>
            <span className="text-xs text-muted-foreground">{t("optionalDetailsHint")}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>

        <div className="flex flex-col gap-8 px-4 pb-5 pt-2">
          <FormSection title={t("sections.physical")} description={t("sections.physicalHint")}>
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
              <Field label={t("color")} error={state.fieldErrors?.color}>
                <Input name="color" defaultValue={pet?.color ?? ""} />
              </Field>
              <label className="flex items-start gap-3 self-end pb-3 text-sm">
                <input
                  type="checkbox"
                  name="neutered"
                  defaultChecked={pet?.neutered ?? false}
                  className="mt-0.5 size-4 rounded border-border"
                />
                <span className="text-foreground">{t("neutered")}</span>
              </label>
            </div>
          </FormSection>

          <FormSection title={t("sections.medical")} description={t("sections.medicalHint")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("microchipId")} error={state.fieldErrors?.microchipId}>
                <Input name="microchipId" defaultValue={pet?.microchipId ?? ""} />
              </Field>
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
          </FormSection>

          <FormSection title={t("sections.notes")} description={t("sections.notesHint")}>
            <Field label={t("notes")} error={state.fieldErrors?.notes}>
              <Textarea name="notes" rows={4} defaultValue={pet?.notes ?? ""} />
            </Field>
          </FormSection>
        </div>
      </details>

      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-muted-foreground">
          {tCommon("requiredFields", {
            fields: [t("owner"), t("name"), t("species"), t("sex")].join(", "),
          })}
        </span>
        <SubmitButton>{pet ? t("update") : t("create")}</SubmitButton>
      </div>
    </ActionForm>
  );
}
