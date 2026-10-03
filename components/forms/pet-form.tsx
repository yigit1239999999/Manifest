"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Client, Pet } from "@/generated/prisma/client";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { OptionalDetails } from "@/components/ui/optional-details";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { SpeciesPicker, type HiddenSpecies } from "@/components/species-picker";
import { SubmitButton } from "@/components/submit-button";
import { searchClientsAction } from "@/modules/clients/actions";
import { SPECIES, SEXES } from "@/modules/pets/schema";
import { createPetAction, updatePetAction } from "@/modules/pets/actions";
import { toDateInput } from "@/lib/format";
import { BREEDS } from "@/lib/breeds";
import { ActionForm, useActionForm } from "@/components/forms/action-form";
import { createHref } from "@/lib/next-param";
import { ownerLabel } from "@/lib/pet-label";

interface Props {
  pet?: Pet;
  owners: Pick<Client, "id" | "firstName" | "lastName">[];
  /** See `InvoiceForm`: true when the list was cut off at its cap. */
  ownersCapped?: boolean;
  defaultOwnerId?: string;
  /**
   * The name the vet had already typed into the picker that sent them
   * here.
   *
   * The walk back carries the address (`?next=`) and now the content
   * too: they wrote "Limon" into the visit's animal box, found no such
   * animal, and asked for one to be made. Retyping it is small, but
   * this is the errand the vet described as the difference between a
   * door that annoys and a form that loses them.
   */
  defaultName?: string;
  /**
   * The address that brings the vet back to this form, as it stands,
   * after making a client.
   *
   * Built by the page, because only the page knows the errand it is
   * itself on: coming from a visit this is
   * `/pets/new?next=/visits/new&name=Limon`, and the walk has to come
   * back through here rather than to the animal list.
   */
  errand?: string;
  /**
   * The label for the selected owner (`pet.ownerId` or `defaultOwnerId`)
   * when that record is not in `owners`.
   *
   * The list is capped (`lib/pagination.ts`), so an id that comes from
   * the record being edited, or from a link that carried one, can sit
   * outside it. Passed unconditionally: a label that matches an option
   * changes nothing, and a missing one leaves a required field looking
   * empty over a hidden input that is not.
   */
  defaultOwnerLabel?: string;
  /** Clinic-defined species (beyond the built-in enum). */
  customSpecies?: { id: string; name: string }[];
  /** Breeds this clinic already used, keyed by species ("DOG" | "custom:<id>"). */
  clinicBreeds?: { speciesKey: string; breed: string }[];
  /** Built-in species this clinic chose to show (Settings → Species). */
  enabledSpecies?: readonly string[];
  /**
   * The built-ins this clinic switched off, with every name each may be
   * typed as.
   *
   * Built on the server (`modules/pets/species-names.ts`) because the
   * names come from both catalogues and this component only has the
   * active language. Shipping both message files to the browser to work
   * that out would buy a whole catalogue to answer a question the
   * server already knows.
   */
  hiddenBuiltIns?: HiddenSpecies[];
  hiddenQualifier?: string;
  /** Only for a reader who may change the setting; absent means absent. */
  /** Link to the species settings page, only for users who may manage it. */
  manageHref?: string;
  /**
   * Where the vet was going when they found they needed an animal
   * first. See `ClientForm` -- same errand, one link further down the
   * chain, and validated on the server for the same reason.
   */
  next?: string;
}

export function PetForm({
  pet,
  owners,
  ownersCapped,
  defaultOwnerId,
  defaultName,
  errand,
  defaultOwnerLabel,
  customSpecies = [],
  clinicBreeds = [],
  enabledSpecies = SPECIES,
  hiddenBuiltIns,
  hiddenQualifier,
  manageHref,
  next,
}: Props) {
  // See `teachPet` in `VisitForm`: one condition, three places, one
  // sentence, and the rules for shortening it. No `creating` here --
  // this picker leaves for `/clients/new` rather than growing a block,
  // which is also why its string promises a form rather than this one.
  const teachOwner = owners.length === 0 && !pet;
  const ownerOptions = useMemo(
    () =>
      owners.map((o) => ({
        value: o.id,
        label: ownerLabel(o),
      })),
    [owners],
  );
  const router = useRouter();
  const t = useTranslations("pet");
  const tClient = useTranslations("client");
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
    <ActionForm
      form={form}
      focusFirstEmpty={Boolean(defaultOwnerId || defaultName)}
      // This form sends the vet away mid-errand -- the owner box offers
      // to make a client -- so what is already typed into it has to
      // survive the trip, including the species and the name that
      // arrived from the picker before them.
      draftKey={pet ? `pet:${pet.id}` : "pet:new"}
      className="flex flex-col gap-8"
    >
      {/* Part-filled arrivals only: the chain a new clinic walks, or a
          deep link from a record's own page. See `focusFirstEmpty`. */}
      {/* The errand, travelling with the form because a server action
          cannot see the URL it was submitted from. */}
      {next && <input type="hidden" name="next" value={next} />}
      {/* The essentials: everything a vet needs to register an animal in
          under a minute. Everything else lives under "optional details". */}
      <FormSection
        title={t("sections.identity")}
        description={t("sections.identityHint")}
      >
        <Field
          label={t("owner")}
          error={state.fieldErrors?.ownerId}
          // Its own sentence rather than the one the two inline
          // pickers share: `onCreate` below leaves for `/clients/new`,
          // so "on this form" would be a lie here. A promise reused
          // where it is not true is spent for both places it is made.
          //
          // No permission in the condition, and it follows `onCreate`
          // rather than leading it: this form has no such prop, and no
          // role today holds `pets.write` without `clients.write`
          // (`lib/permissions.ts`). A hidden dependency rather than a
          // defect -- the day a role splits them, this line and the
          // offer it describes go wrong together.
          hint={teachOwner ? tClient("noneYetTypeToOpenForm") : undefined}
          required
        >
          {/* See `InvoiceForm`: searchable only once the list is short
              of the whole clinic, so a small one is not taxed for a
              problem it does not have. */}
          <Combobox
            name="ownerId"
            required
            options={ownerOptions}
            defaultValue={pet?.ownerId ?? defaultOwnerId ?? ""}
            defaultLabel={defaultOwnerLabel}
            // See `VisitForm`: with nothing on file, "search" is a
            // dead word.
            placeholder={
              teachOwner
                ? tClient("typeNamePlaceholder")
                : tCommon("searchOrType")
            }
            noResultsLabel={tCommon("noResults")}
            // Deliberately the same string as the hint above: see
            // `teachPet` in `VisitForm`.
            emptyCatalogueLabel={
              teachOwner ? tClient("noneYetTypeToOpenForm") : undefined
            }
            onSearch={ownersCapped ? searchClientsAction : undefined}
            hasMore={ownersCapped}
            searchHintLabel={tCommon("searchMinChars")}
            searchingLabel={tCommon("searching")}
            searchFailedLabel={tCommon("searchFailed")}
            hasMoreLabel={tCommon("searchMore")}
            // The second door, and the vet found it before we did:
            // "where does the owner of the animal opened that way come
            // from? It has to open from the same box, or you have taken
            // one door away and left the other." Only on a new animal,
            // for the reason `VisitForm` gives.
            onCreate={
              pet
                ? undefined
                : (typed) =>
                    router.push(createHref("/clients/new", typed, errand))
            }
            createLabel={(typed) => tClient("createNamed", { name: typed })}
          />
        </Field>

        <Field label={t("name")} error={state.fieldErrors?.name} required>
          <Input
            name="name"
            defaultValue={pet?.name ?? defaultName ?? ""}
            required
            // Not when the name arrived already typed: the cursor
            // belongs on the work that is left, which `focusFirstEmpty`
            // works out (`action-form.tsx`).
            autoFocus={!pet && !defaultName}
          />
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
            hiddenBuiltIns={hiddenBuiltIns}
            hiddenQualifier={hiddenQualifier}
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

      <OptionalDetails
        title={t("optionalDetails")}
        hint={t("optionalDetailsHint")}
        defaultOpen={hasOptionalData}
      >
          <FormSection
            title={t("sections.physical")}
            description={t("sections.physicalHint")}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("birthDate")}
                error={state.fieldErrors?.birthDate}
              >
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

          <FormSection
            title={t("sections.medical")}
            description={t("sections.medicalHint")}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("microchipId")}
                error={state.fieldErrors?.microchipId}
              >
                <Input
                  name="microchipId"
                  defaultValue={pet?.microchipId ?? ""}
                />
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
              <Textarea
                name="alerts"
                rows={2}
                defaultValue={pet?.alerts ?? ""}
              />
            </Field>
          </FormSection>

          <FormSection
            title={t("sections.notes")}
            description={t("sections.notesHint")}
          >
            <Field label={t("notes")} error={state.fieldErrors?.notes}>
              <Textarea name="notes" rows={4} defaultValue={pet?.notes ?? ""} />
            </Field>
          </FormSection>
      </OptionalDetails>

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
