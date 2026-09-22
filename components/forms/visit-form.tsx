"use client";

import { useMemo, useState } from "react";
import { flushSync } from "react-dom";

import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";
import type { Pet, User, Visit } from "@/generated/prisma/client";
import { centsToInputValue } from "@/lib/money";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { VISIT_TYPES } from "@/modules/appointments/schema";
import {
  createVisitIntakeAction,
  updateVisitAction,
} from "@/modules/visits/actions";
import { ActionForm, useActionForm } from "@/components/forms/action-form";
import { searchPetsAction } from "@/modules/pets/actions";
import { petRowCaption, petRowLabel } from "@/lib/pet-label";
import { NewPetBlock, type OpenedWith } from "@/components/forms/new-pet-block";
import { readDraft } from "@/lib/form-draft";
import type { HiddenSpecies } from "@/components/species-picker";

interface Props {
  visit?: Visit;
  /** The owner travels with the animal: see `lib/pet-label.ts`. */
  pets: (Pick<Pet, "id" | "name"> & {
    ownerName: string;
    /**
     * What this animal is, in the reader's language, and when it was
     * last seen -- both already put into words by the page, because
     * only the server has the catalogues and the clinic's time zone.
     *
     * The picker row shows them beside the name and under it: the vet
     * is looking at the animal while they choose, so the species is
     * what eliminates at a glance (`petRowLabel`).
     */
    speciesLabel?: string | null;
    lastSeen?: string | null;
  })[];
  /** See `InvoiceForm`: true when the list was cut off at its cap. */
  petsCapped?: boolean;
  vets: Pick<User, "id" | "name">[];
  defaultPetId?: string;
  /**
   * The label for the selected animal (`visit.petId` or `defaultPetId`)
   * when that record is not in `pets`.
   *
   * The list is capped (`lib/pagination.ts`), so an id that comes from
   * the record being edited, or from a link that carried one, can sit
   * outside it. Passed unconditionally: a label that matches an option
   * changes nothing, and a missing one leaves a required field looking
   * empty over a hidden input that is not.
   */
  defaultPetLabel?: string;
  /**
   * The signed-in user, when they are somebody a visit may be recorded
   * against. Absent for everyone else, and absent is not a fallback:
   * "not recorded" is a better answer than a name nobody chose.
   *
   * Decided on the server (`visits/new/page.tsx`) rather than here,
   * because the browser cannot tell a clinician from a receptionist,
   * and the same question used to be answered in the service -- where
   * it was a guess nobody could see.
   */
  defaultVetId?: string;
  /**
   * Everything the block inside this form needs to open an animal and
   * its owner, assembled by the page from the same queries
   * `pets/new/page.tsx` runs.
   *
   * Absent on an edit, where there is no such block: a visit being
   * corrected cannot grow a new animal, and the schema that would
   * write one is deliberately a different schema.
   */
  owners?: { id: string; firstName: string; lastName: string | null }[];
  ownersCapped?: boolean;
  speciesChoices?: { value: string; label: string; icon?: string }[];
  hiddenBuiltIns?: HiddenSpecies[];
  hiddenQualifier?: string;
  manageHref?: string;
  /**
   * What the reader is allowed to write, decided where the service
   * decides it (`lib/permissions.ts`).
   *
   * Not decoration: `createVisitWithIntake` requires `pets.write` for
   * the animal and `clients.write` for the owner, so an offer this
   * reader cannot take is a server error rather than a message under a
   * field. A receptionist who may record visits but not open records
   * gets the picker without the offer, which is the honest screen.
   */
  canCreatePet?: boolean;
  canCreateOwner?: boolean;
}

/**
 * What a block being put back opens with.
 *
 * The name matters: it is what the animal picker above shows while the
 * block is open, and a picker that comes back blank over a hidden id
 * reads as a selection that was lost.
 */
function reopenedWith(values: Record<string, string>): OpenedWith {
  return { petName: values["newPet[name]"] ?? "", ownerQuery: "" };
}

export function VisitForm({
  visit,
  pets,
  petsCapped,
  vets,
  defaultPetId,
  defaultPetLabel,
  defaultVetId,
  owners = [],
  ownersCapped,
  speciesChoices = [],
  hiddenBuiltIns,
  hiddenQualifier,
  manageHref,
  canCreatePet = false,
  canCreateOwner = false,
}: Props) {
  const locale = useLocale();
  const petOptions = useMemo(
    () =>
      pets.map((p) => ({
        value: p.id,
        label: petRowLabel(p.name, p.speciesLabel),
        caption: petRowCaption(p.ownerName, p.lastSeen),
      })),
    [pets],
  );
  const t = useTranslations("visit");
  const tCommon = useTranslations("common");
  const tType = useTranslations("enum.visitType");
  const tPet = useTranslations("pet");
  // One action for a new visit, whether or not the block is open.
  // `visitIntakeSchema` is `visitSchema` with the two extra branches,
  // and `intakeFrom` hands a plain submission straight through -- so a
  // visit recorded against an animal already on file takes exactly the
  // path it always did, and there is no second code path to keep in
  // step with this one.
  const action = visit
    ? updateVisitAction.bind(null, visit.id)
    : createVisitIntakeAction;
  const form = useActionForm(action, {});
  const { state } = form;

  // The block, and the four ways it comes to be open.
  //
  // Opened by hand from the picker's "create" row; reopened by a
  // rejected submit, which echoes the submission back with the intent
  // in it; reopened by a draft, for the vet who left this form and came
  // back to it; and closed by "never mind", which drops the intent so
  // the animal box goes back to being a choice.
  //
  // The submission and the draft are read HERE rather than left to
  // `ActionForm`. It restores by writing into controls that already
  // exist, and the block is precisely the controls that do not: by the
  // time it is on screen that pass has run. So whatever reopens it also
  // hands it its values.
  //
  // Read during the first render, the way `ActionForm` reads the same
  // key, because a block that appeared one render later would arrive
  // after the restore and after the cursor had been placed.
  const [restoredDraft] = useState<Record<string, string> | null>(() =>
    visit || typeof window === "undefined" ? null : readDraft("visit:new"),
  );
  const [creating, setCreating] = useState<OpenedWith | null>(
    restoredDraft?.["newPet[intent]"] === "1" ? reopenedWith(restoredDraft) : null,
  );

  // A rejected submit is a server response, not an event this form can
  // subscribe to, so it is read as it arrives rather than in an effect:
  // the block has to be in the SAME render as the values that refill
  // it. Same shape as the response bookkeeping in `useActionForm`.
  const echoed = state.values;
  const [seenValues, setSeenValues] = useState(echoed);
  if (seenValues !== echoed) {
    setSeenValues(echoed);
    if (echoed?.["newPet[intent]"] === "1" && !creating) {
      setCreating(reopenedWith(echoed));
    }
  }

  const blockValues =
    echoed?.["newPet[intent]"] === "1" ? echoed : (restoredDraft ?? undefined);

  return (
    <ActionForm
      form={form}
      focusFirstEmpty={Boolean(defaultPetId)}
      // The form the measured loss happened on: a chief complaint and
      // a history typed in, a walk to the client list, and both gone
      // on the way back. Keyed to the record rather than the route, so
      // a half-written new visit cannot pour itself into the edit form
      // of an old one.
      draftKey={visit ? `visit:${visit.id}` : "visit:new"}
      className="flex flex-col gap-6"
    >
      {/* Part-filled arrivals only: the chain a new clinic walks, or a
          deep link from a record's own page. See `focusFirstEmpty`. */}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tPet("one")} error={state.fieldErrors?.petId} required>
          {/* See `InvoiceForm`: searchable only once the list is short
              of the whole clinic. */}
          <Combobox
            // Remounted when the block opens or closes, and that is
            // what empties the hidden id: the vet had picked Zeytin,
            // changed their mind and asked for a new animal, and the
            // id left behind would otherwise be what the visit was
            // written against. The typed text survives as the label,
            // so the box still shows what they asked for.
            key={creating ? "creating" : "picking"}
            name="petId"
            options={petOptions}
            // Dropped while the block is open, and this is the same
            // rule the owner picker follows one level in: the animal
            // is being typed below, the id is empty on purpose, and a
            // native `required` over an empty picker refuses the
            // submit with nothing on screen to say why. The asterisk
            // stays, and `visitIntakeSchema` still refuses a visit
            // with neither an animal nor a new one.
            required={!creating}
            defaultValue={creating ? "" : (visit?.petId ?? defaultPetId ?? "")}
            defaultLabel={
              creating ? creating.petName || creating.ownerQuery : defaultPetLabel
            }
            placeholder={tCommon("searchOrType")}
            noResultsLabel={tCommon("noResults")}
            onSearch={petsCapped ? searchPetsAction : undefined}
            hasMore={petsCapped}
            searchHintLabel={tCommon("searchMinChars")}
            searchingLabel={tCommon("searching")}
            searchFailedLabel={tCommon("searchFailed")}
            hasMoreLabel={tCommon("searchMore")}
            // The door that used to stand in front of this whole form
            // when the clinic had no animals, moved inside the field
            // that asks for one: "the dog is on the table, the owner is
            // crying, and what I got was not a blank page but a door".
            //
            // It used to walk to `/pets/new` and back with `?next=`,
            // which kept the errand but not the minute: a visit half
            // typed had to survive two screens and a return. Now the
            // form grows the block instead and the address never
            // changes.
            //
            // Only on a new visit: an edit cannot create an animal, and
            // the schema that would is deliberately a different one.
            onCreate={
              visit || !canCreatePet
                ? undefined
                : (typed) => setCreating({ petName: typed, ownerQuery: "" })
            }
            createLabel={(typed) => tPet("createNamed", { name: typed })}
          />
        </Field>
        <Field label={t("type")} error={state.fieldErrors?.type} required>
          <Select
            name="type"
            defaultValue={visit?.type ?? "WELLNESS_CHECK"}
            required
          >
            {VISIT_TYPES.map((v) => (
              <option key={v} value={v}>
                {tType(v)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {creating && (
        <NewPetBlock
          petName={creating.petName}
          ownerQuery={creating.ownerQuery}
          values={blockValues}
          errors={state.fieldErrors}
          // Flushed, because the draft is written by the form's own
          // click handler as this click bubbles past it: without the
          // synchronous commit the hidden intent is still in the DOM
          // when the snapshot is taken, and a block somebody closed
          // would be waiting for them when they came back.
          onCancel={() => flushSync(() => setCreating(null))}
          owners={owners}
          ownersCapped={ownersCapped}
          canCreateOwner={canCreateOwner}
          speciesChoices={speciesChoices}
          hiddenBuiltIns={hiddenBuiltIns}
          hiddenQualifier={hiddenQualifier}
          manageHref={manageHref}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("visitedAt")} error={state.fieldErrors?.visitedAt} required>
          <DateTimeInput
            name="visitedAt"
            defaultValue={visit?.visitedAt ?? new Date()}
            required
          />
        </Field>
        <Field label={t("vet")} error={state.fieldErrors?.vetId}>
          {/* Only a new visit takes the default: on an edit the field
              already says who was recorded, and a blank there is a
              decision somebody made rather than a question nobody
              reached. */}
          <Select name="vetId" defaultValue={visit?.vetId ?? defaultVetId ?? ""}>
            <option value="">{tCommon("none")}</option>
            {vets.map((v) => (
              <option key={v.id} value={v.id}>
                {/* The reader is in this list, and saying so is what
                    makes a pre-chosen name readable as their own
                    rather than as a name the form picked at random. */}
                {v.id === defaultVetId ? t("vetYou", { name: v.name }) : v.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label={t("chiefComplaint")}
        error={state.fieldErrors?.chiefComplaint}
      >
        <Textarea
          name="chiefComplaint"
          rows={2}
          defaultValue={visit?.chiefComplaint ?? ""}
        />
      </Field>

      <fieldset className={cn(surface, "grid gap-4 p-4 sm:grid-cols-2")}>
        <legend className="px-2 text-sm font-semibold text-foreground">
          {t("soap")}
        </legend>
        <Field label={t("subjective")} error={state.fieldErrors?.subjective}>
          <Textarea
            name="subjective"
            rows={4}
            defaultValue={visit?.subjective ?? ""}
          />
        </Field>
        <Field label={t("objective")} error={state.fieldErrors?.objective}>
          <Textarea
            name="objective"
            rows={4}
            defaultValue={visit?.objective ?? ""}
          />
        </Field>
        <Field label={t("assessment")} error={state.fieldErrors?.assessment}>
          <Textarea
            name="assessment"
            rows={4}
            defaultValue={visit?.assessment ?? ""}
          />
        </Field>
        <Field label={t("plan")} error={state.fieldErrors?.plan}>
          <Textarea
            name="plan"
            rows={4}
            defaultValue={visit?.plan ?? ""}
          />
        </Field>
      </fieldset>

      <fieldset className={cn(surface, "grid gap-4 p-4 sm:grid-cols-4")}>
        <legend className="px-2 text-sm font-semibold text-foreground">
          {t("vitals")}
        </legend>
        <Field label={t("weightKg")} error={state.fieldErrors?.weightKg}>
          <Input
            type="number"
            step="0.01"
            name="weightKg"
            defaultValue={visit?.weightKg ?? ""}
          />
        </Field>
        <Field
          label={t("temperatureC")}
          error={state.fieldErrors?.temperatureC}
        >
          <Input
            type="number"
            step="0.1"
            name="temperatureC"
            defaultValue={visit?.temperatureC ?? ""}
          />
        </Field>
        <Field
          label={t("heartRateBpm")}
          error={state.fieldErrors?.heartRateBpm}
        >
          <Input
            type="number"
            name="heartRateBpm"
            defaultValue={visit?.heartRateBpm ?? ""}
          />
        </Field>
        <Field
          label={t("respiratoryRateBpm")}
          error={state.fieldErrors?.respiratoryRateBpm}
        >
          <Input
            type="number"
            name="respiratoryRateBpm"
            defaultValue={visit?.respiratoryRateBpm ?? ""}
          />
        </Field>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("followupAt")} error={state.fieldErrors?.followupAt}>
          <DateTimeInput
            name="followupAt"
            defaultValue={visit?.followupAt}
            granularity="day"
          />
        </Field>
        <Field label={t("totalCost")} error={state.fieldErrors?.total}>
          <Input
            name="total"
            inputMode="decimal"
            placeholder={centsToInputValue(locale, 0)}
            defaultValue={
              visit?.totalCents != null
                ? centsToInputValue(locale, visit.totalCents)
                : ""
            }
          />
        </Field>
      </div>

      <SubmitButton>{visit ? t("update") : t("create")}</SubmitButton>
    </ActionForm>
  );
}
