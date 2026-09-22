"use client";

import { useMemo, useRef, useState } from "react";
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
import { matches } from "@/lib/search";
import { NewPetBlock, type OpenedWith } from "@/components/forms/new-pet-block";
import { readDraft } from "@/lib/form-draft";
import type { HiddenSpecies } from "@/components/species-picker";

interface Props {
  visit?: Visit;
  /** The owner travels with the animal: see `lib/pet-label.ts`. */
  pets: (Pick<Pet, "id" | "name" | "ownerId"> & {
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
  // What the "create" row offers, decided here rather than in the
  // picker -- and the reason is what a caption is. The animal rows read
  // "Ayşe Yılmaz · 7 ay önce" (`petRowCaption`), so a picker that knew
  // only that "the caption matched" could not tell an owner's name from
  // a date, and "7 ay" typed into the box would have offered to make an
  // animal for somebody. This form has the two fields separately.
  //
  // The rule, in the order it is asked:
  //   - anything at all called that already? then the vet is naming an
  //     ANIMAL, whether or not one of them is the one they mean. Two
  //     Limons is the ordinary case here.
  //   - nothing called that, and exactly one owner does? then they were
  //     naming a PERSON, and the offer is an animal OF that person with
  //     the name still to be typed.
  //   - anything else -- no match at all, or two different owners --
  //     is an animal called whatever they typed. Guessing between two
  //     Ayşes is how the wrong record gets the visit.
  //
  // The words on the row and what the row does share this one
  // calculation, so they cannot say different things.
  const offerFor = useMemo(() => {
    const named = pets.map((p) => p.name);
    const owners = pets.map((p) => ({ id: p.ownerId, name: p.ownerName }));
    return (query: string): OpenedWith => {
      const typed = query.trim();
      const asAnimal = { petName: typed, ownerQuery: "" };
      if (!typed || named.some((name) => matches(name, typed))) return asAnimal;
      const hits = owners.filter((owner) => matches(owner.name, typed));
      // Counted by WHO, not by what they are called. Two clients with
      // one name is the case this had wrong: the names deduplicated to
      // a single entry, so a typed "Ayşe Çelik" that reached two
      // different people looked like it had reached one, and the block
      // would have opened with the wrong one's record under it -- the
      // thing this whole round is most afraid of, arriving through the
      // convenience that was meant to save a click.
      const who = new Set(hits.map((owner) => owner.id));
      const [only] = who;
      return who.size === 1
        ? { petName: "", ownerQuery: hits[0].name, ownerId: only }
        : asAnimal;
    };
  }, [pets]);
  const t = useTranslations("visit");
  const tCommon = useTranslations("common");
  const tType = useTranslations("enum.visitType");
  const tPet = useTranslations("pet");
  const tStaff = useTranslations("staff");
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
  // What was typed into the animal box, kept across a cancel.
  //
  // The picker is remounted as the block opens and again as it closes,
  // which is what empties the id -- and it took the typed text with it,
  // so "never mind" charged the vet for a keystroke they had already
  // made. pm measured the box going from "PMTEST Findik" to empty.
  // Held here rather than read back off the DOM, because by the time
  // the cancel has run the input carrying it is gone.
  const [typedPet, setTypedPet] = useState("");
  // Everything a clinic with nothing on file is told, from one
  // condition, because the three places it reaches are one moment: the
  // box names what to type, the line under the label and the list's
  // body carry the SAME sentence.
  //
  // The same sentence twice is usually the defect. Here it is the fix,
  // and a screenshot is why: the list is `absolute top-full`
  // (`combobox.tsx:579`), so it covers the line under the label the
  // instant it opens. Split between the two, the vet who clicks the
  // box -- the likeliest move -- keeps the half that says what is
  // missing and loses the half that says what to do.
  //
  // `!creating` because the block below is the thing this sentence
  // asks for: left up, it tells the vet to do what they have just
  // done. `canCreatePet` because without it the server refuses, and
  // an instruction the server refuses is worse than silence.
  const teachPet = pets.length === 0 && !visit && canCreatePet && !creating;
  const picker = useRef<HTMLDivElement>(null);

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

      {/* The ref is how "never mind" finds its way back to the box it
          was pressed from: the picker is remounted by that same state
          change, so a ref to the control itself would point at a node
          that no longer exists. The row is stable; the control inside
          it is the only explicit `role="combobox"` here -- the visit
          type beside it is a native `select`. */}
      <div ref={picker} className="grid gap-4 sm:grid-cols-2">
        <Field
          label={tPet("one")}
          error={state.fieldErrors?.petId}
          hint={teachPet ? tPet("noneYetTypeToOpen") : undefined}
          required
        >
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
              creating
                ? creating.petName || creating.ownerQuery
                : typedPet || defaultPetLabel
            }
            // "Search or type" is written for a clinic that has
            // records. With none, "search" is a dead word: it invites
            // the vet to look for something that cannot be there.
            placeholder={
              teachPet ? tPet("typeNamePlaceholder") : tCommon("searchOrType")
            }
            noResultsLabel={tCommon("noResults")}
            // Deliberately the same string as the hint above: see
            // `teachPet`.
            emptyCatalogueLabel={teachPet ? tPet("noneYetTypeToOpen") : undefined}
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
                : (typed) => {
                    setTypedPet(typed);
                    // Asked for by hand, so the caret comes with it --
                    // unlike a block put back by a draft or a
                    // rejection, where the reader has their own idea of
                    // where to carry on.
                    setCreating({ ...offerFor(typed), takeFocus: true });
                  }
            }
            createLabel={(typed) => {
              const offer = offerFor(typed);
              return offer.ownerQuery
                ? tPet("createForOwner", { owner: offer.ownerQuery })
                : tPet("createNamed", { name: offer.petName });
            }}
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
          // Spread, and the reason is a defect that has now happened
          // twice: `OpenedWith` is exactly what the block needs to know
          // about how it was opened, and listing its fields here by
          // hand means a field added to the type reaches the STATE and
          // not the component. Both times the symptom was silence --
          // the block simply behaved as though nothing had been
          // decided, and only a test said otherwise.
          {...creating}
          values={blockValues}
          errors={state.fieldErrors}
          // Flushed, because the draft is written by the form's own
          // click handler as this click bubbles past it: without the
          // synchronous commit the hidden intent is still in the DOM
          // when the snapshot is taken, and a block somebody closed
          // would be waiting for them when they came back.
          onCancel={() => {
            flushSync(() => setCreating(null));
            // Back where they were, which is the box they opened it
            // from. Without this the caret lands on `body` and a
            // keyboard user tabs in from the top of the document to
            // reach a field they were standing in a moment ago -- the
            // same 22-keystroke walk `ActionForm`'s error summary was
            // written for. After the flush, because the picker this
            // looks for is remounted by that state change.
            picker.current
              ?.querySelector<HTMLElement>('[role="combobox"]')
              ?.focus();
          }}
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
                {v.id === defaultVetId
                  ? `${v.name} ${tStaff("you")}`
                  : v.name}
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
