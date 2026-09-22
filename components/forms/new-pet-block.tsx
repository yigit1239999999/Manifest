"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { PhoneOrNone } from "@/components/ui/phone-or-none";
import { ConsentChoice, type ConsentAnswer } from "@/components/ui/consent-choice";
import { SpeciesPicker, type HiddenSpecies } from "@/components/species-picker";
import { searchClientsAction } from "@/modules/clients/actions";
import { ownerLabel } from "@/lib/pet-label";
import { fold } from "@/lib/search";

/**
 * What the picker had found when the vet asked for a new animal.
 *
 * Two facts, and the second is the one that changes what opens: the
 * animal picker matches the owner's name as well as the animal's, so
 * "Ayşe" typed into it brings up Ayşe's animals and then offers to
 * create an ANIMAL called Ayşe underneath them. Carried here, that
 * offer becomes the right one -- a new animal whose OWNER is Ayşe,
 * with the name still to be typed.
 */
export interface OpenedWith {
  /** The animal's name, empty when what was typed named the owner. */
  petName: string;
  /** The owner's name, empty when what was typed named the animal. */
  ownerQuery: string;
}

interface Props extends OpenedWith {
  /**
   * What this block's fields open with: a submission the server sent
   * home, or a draft put back after the vet left and returned.
   *
   * Passed in rather than left to `ActionForm`, which restores by
   * writing into controls that already exist. These do not: the block
   * is what the draft has to reopen, so by the time it is on screen
   * that pass has already run.
   */
  values?: Record<string, string>;
  errors?: Record<string, string[]>;
  onCancel: () => void;
  owners: { id: string; firstName: string; lastName: string | null }[];
  ownersCapped?: boolean;
  /** Whether this reader may write a client at all (`clients.write`). */
  canCreateOwner?: boolean;
  speciesChoices: { value: string; label: string; icon?: string }[];
  hiddenBuiltIns?: HiddenSpecies[];
  hiddenQualifier?: string;
  manageHref?: string;
}

/**
 * The animal, and its owner, opened inside the visit form.
 *
 * The vet's account of what stood here: "the dog is on the table, the
 * owner is crying, and what I got was not a blank page but a door."
 * The door was replaced once already -- the picker offered to go and
 * make the animal -- but going is still leaving, and the visit that
 * was half typed had to survive a walk two screens deep and back. This
 * is the same offer without the walk: the form grows the two blocks it
 * needs and one save writes all three records (`createVisitWithIntake`).
 *
 * Short on purpose, and the shortness is the vet's: asked what else
 * has to be captured while the animal is on the table, they said there
 * is nothing -- "there is no field I would say you must ask me now or
 * I can never enter it." Breed, birth date, sex and the rest are on
 * the animal's own form tomorrow. What is here is what the clinic
 * cannot find the animal again without.
 */
export function NewPetBlock({
  petName,
  ownerQuery,
  values,
  errors,
  onCancel,
  owners,
  ownersCapped,
  canCreateOwner = true,
  speciesChoices,
  hiddenBuiltIns,
  hiddenQualifier,
  manageHref,
}: Props) {
  const t = useTranslations("pet");
  const tVisit = useTranslations("visit");
  const tClient = useTranslations("client");
  const tCommon = useTranslations("common");

  const openedName = values?.["newPet[name]"] ?? petName;

  // Held in state only because the heading above says it back. The box
  // is uncontrolled, like every other field in these forms: a
  // controlled one would fight `ActionForm`, which puts a rejected
  // submission back by writing into the DOM.
  const [heading, setHeading] = React.useState(openedName);

  const ownerOptions = React.useMemo(
    () => owners.map((o) => ({ value: o.id, label: ownerLabel(o) })),
    [owners],
  );

  // An owner typed into the animal box, matched against the list the
  // form already has. One exact hit is a choice the vet has already
  // made in every sense but the click, so it is made for them; two
  // Ayşes are not, and the box stays open on the query with both in it.
  const matchedOwner = React.useMemo(() => {
    if (!ownerQuery) return undefined;
    const needle = fold(ownerQuery.trim());
    const hits = ownerOptions.filter((o) => fold(o.label) === needle);
    return hits.length === 1 ? hits[0] : undefined;
  }, [ownerQuery, ownerOptions]);

  const openedOwnerId = values?.["newPet[ownerId]"] ?? matchedOwner?.value ?? "";
  const [creatingOwner, setCreatingOwner] = React.useState(
    Boolean(values?.["newOwner[firstName]"]),
  );
  const [ownerName, setOwnerName] = React.useState(
    values?.["newOwner[firstName]"]
      ? [values["newOwner[firstName]"], values["newOwner[lastName]"]]
          .filter(Boolean)
          .join(" ")
      : ownerQuery,
  );

  const consentAnswer = (values?.["newOwner[consent]"] ?? null) as
    | ConsentAnswer
    | null;

  const headingId = React.useId();
  const ownerHeadingId = React.useId();

  return (
    // `role="group"` with the heading as its name rather than a
    // `fieldset`/`legend`: a legend has to be the first child to be the
    // caption, and the way out of this block belongs on the same line
    // as the words it is about. A legend is also laid out by the engine
    // rather than by its parent, so a flex fieldset puts it somewhere
    // no two browsers agree on (`client-form.tsx` says the same).
    <div
      role="group"
      aria-labelledby={headingId}
      className={cn(surface, "flex flex-col gap-4 p-4")}
    >
      {/* The intent, and the reason it is a field rather than an
          inference: without it an empty block left on screen by a
          rejected submit is indistinguishable from no block at all,
          and the animal id underneath would quietly win
          (`intake-fields.ts`). */}
      <input type="hidden" name="newPet[intent]" value="1" />
      <div className="flex items-start justify-between gap-3">
        <p id={headingId} className="text-sm font-semibold text-foreground">
          {tVisit("newPetLegend", { name: heading })}
        </p>
        {/* The way out of a block that was opened by mistake, which is
            one keystroke away from the row that opens it. It closes
            the block and drops the intent with it, so the animal box
            goes back to being a choice. */}
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-control px-2 py-1 text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {tCommon("nevermind")}
        </button>
      </div>

      <Field label={t("name")} error={errors?.["newPet[name]"]} required>
        <Input
          name="newPet[name]"
          defaultValue={openedName}
          onChange={(e) => setHeading(e.target.value)}
          required
          // The cursor goes to the box that is empty, which is the
          // whole of what the block is asking for: opened from an
          // OWNER's name, the animal has none yet. Opened from the
          // animal's, this box is already filled and the caret stays
          // where the vet put it.
          autoFocus={!openedName}
        />
      </Field>

      <Field label={t("species")} error={errors?.["newPet[species]"]} required>
        <SpeciesPicker
          name="newPet[species]"
          label={t("species")}
          options={speciesChoices}
          defaultValue={values?.["newPet[species]"] ?? ""}
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

      <Field label={t("owner")} error={errors?.["newPet[ownerId]"]} required>
        {/* The second door the vet found before we did: "where does the
            owner of the animal opened that way come from? It has to
            open from the same box." It opens one block further in
            rather than one screen away, for the reason this whole
            block exists. */}
        <Combobox
          // Remounted when the owner block opens or closes, for the
          // reason the animal picker is: what is in the box belongs to
          // the answer the vet has moved on from. It comes back showing
          // the name they typed, over an empty id.
          key={creatingOwner ? "creating" : "picking"}
          name="newPet[ownerId]"
          // The owner is required and the asterisk says so. What is
          // dropped while the block below is open is the BROWSER's
          // insistence: the answer is being typed underneath, the id is
          // empty on purpose, and a native `required` on an empty
          // picker refuses the submit with no message anywhere -- the
          // save simply does not happen. The schema still refuses a new
          // animal with neither an owner nor an owner being written
          // down (`visitIntakeSchema`).
          required={!creatingOwner}
          options={ownerOptions}
          defaultValue={creatingOwner ? "" : openedOwnerId}
          // Only for an id the picker cannot name itself: it looks its
          // own options up, so a restored draft holding an owner from
          // the list comes back named without help. What is left is an
          // owner past the cap, and this form has no way to ask -- the
          // honest gap, and the same one `defaultOwnerLabel` closes on
          // `/pets/new` with a server lookup a draft restore cannot do.
          defaultLabel={
            creatingOwner
              ? ownerName || undefined
              : openedOwnerId
                ? matchedOwner?.label
                : ownerQuery || undefined
          }
          placeholder={tCommon("searchOrType")}
          noResultsLabel={tCommon("noResults")}
          onSearch={ownersCapped ? searchClientsAction : undefined}
          hasMore={ownersCapped}
          searchHintLabel={tCommon("searchMinChars")}
          searchingLabel={tCommon("searching")}
          searchFailedLabel={tCommon("searchFailed")}
          hasMoreLabel={tCommon("searchMore")}
          onCreate={
            canCreateOwner
              ? (typed) => {
                  setOwnerName(typed);
                  setCreatingOwner(true);
                }
              : undefined
          }
          createLabel={(typed) => tClient("createNamed", { name: typed })}
        />
      </Field>

      {creatingOwner && (
        // No second frame. Two nested boxes on a 390px screen spend
        // about a third of the line on borders and padding, and what
        // this block needs to say is "these fields belong to the owner
        // above" -- which a rule down the leading edge says in one pixel.
        <div
          role="group"
          aria-labelledby={ownerHeadingId}
          className="flex flex-col gap-4 border-s-2 border-border ps-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p
              id={ownerHeadingId}
              className="text-sm font-semibold text-foreground"
            >
              {tVisit("newOwnerLegend", { name: ownerName })}
            </p>
            <button
              type="button"
              onClick={() => setCreatingOwner(false)}
              className="shrink-0 rounded-control px-2 py-1 text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {tCommon("nevermind")}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={tClient("firstName")}
              error={errors?.["newOwner[firstName]"]}
              required
            >
              <Input
                name="newOwner[firstName]"
                defaultValue={
                  values?.["newOwner[firstName]"] ?? ownerName.split(" ")[0]
                }
                autoComplete="given-name"
                required
              />
            </Field>
            {/* "I do not know the surname of the lady who brings the
                street cat, and it would be rude to ask." */}
            <Field
              label={tClient("lastName")}
              error={errors?.["newOwner[lastName]"]}
              hint={tClient("lastNameHint")}
            >
              <Input
                name="newOwner[lastName]"
                defaultValue={
                  values?.["newOwner[lastName]"] ??
                  ownerName.split(" ").slice(1).join(" ")
                }
                autoComplete="family-name"
              />
            </Field>
          </div>

          {/* The same pair as the counter's own form, and the same
              rule between them. On the examination table the number is
              the fact least likely to be in the room: the animal is in
              front of the vet, the owner is a name. */}
          <PhoneOrNone
            name="newOwner[phone]"
            laterName="newOwner[phoneLater]"
            label={tClient("phone")}
            hint={tClient("phoneHint")}
            laterLabel={tClient("phoneLater")}
            error={errors?.["newOwner[phone]"]}
            defaultValue={values?.["newOwner[phone]"]}
            defaultLater={Boolean(values?.["newOwner[phoneLater]"])}
          />

          {/* Asked here for the same reason it is asked at the counter:
              the owner is standing there, and an unanswered consent is
              silence this clinic never finds out it chose. */}
          <ConsentChoice
            name="newOwner[consent]"
            defaultValue={consentAnswer}
            legend={tClient("consent.legend")}
            labels={{
              true: tClient("consent.answer.granted"),
              false: tClient("consent.answer.declined"),
              "": tClient("consent.answer.unanswered"),
            }}
            hints={{
              true: tClient("consent.grantedHint"),
              false: tClient("consent.declinedHint"),
              "": tClient("consent.unansweredHint"),
            }}
          />
        </div>
      )}
    </div>
  );
}
