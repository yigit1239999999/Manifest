"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { buttonVariants } from "@/components/ui/button";
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
  /**
   * Whether the cursor should come with it.
   *
   * True when the vet just asked for this block, false when it is
   * being put back -- by a draft or by a rejected submit. The
   * difference is where the reader already is: somebody who has just
   * pressed "create" is looking at the block and cannot type into it
   * until the caret arrives, while somebody returning to a form has
   * their own idea of where to carry on, and a page that grabs focus
   * on load takes it from them.
   */
  takeFocus?: boolean;
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
  takeFocus = false,
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
  // The owner branch, opened by a choice rather than inferred from a
  // box being non-empty -- see `intakeFrom`, which reads the same
  // intent on the other side.
  const [creatingOwner, setCreatingOwner] = React.useState(
    values?.["newOwner[intent]"] === "1",
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

  // Where the caret goes when this block appears, and why it has to be
  // put there rather than left where it was.
  //
  // The picker above is REMOUNTED as the block opens -- that is what
  // empties the animal id somebody moved on from (`visit-form.tsx`) --
  // and a focused input that is removed from the document drops focus
  // to `body`. pm measured exactly that: eleven samples from 50ms to
  // 3s, all of them on `body`. So the vet who asked for a new animal
  // was left with a block on screen and nowhere to type, and a
  // keyboard user with nothing under the cursor at all.
  //
  // Which control depends on what is still unanswered, which is the
  // same question `autoFocus` used to answer for one of the two cases:
  // opened on an owner's name, the animal has no name yet and that box
  // is the work; opened on the animal's, the name is already in and
  // the species is the first thing nobody has said.
  //
  // The chip with `tabIndex="0"` rather than the first one: that is
  // the roving stop, the chip a keyboard would land on, and after a
  // species is chosen it is the chosen one (`species-picker.tsx`).
  const block = React.useRef<HTMLFieldSetElement>(null);
  React.useEffect(() => {
    if (!takeFocus) return;
    const el = block.current;
    if (!el) return;
    const target = openedName
      ? el.querySelector<HTMLElement>('[role="group"] button[tabindex="0"]')
      : el.querySelector<HTMLElement>('input[name="newPet[name]"]');
    target?.focus();
    // On open only. Moving the caret later would take it off whatever
    // is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // The frame the SOAP notes and the vitals are drawn in, on the
    // same form a few fields down (`visit-form.tsx`). A block that
    // invents its own hierarchy mark teaches the reader a second
    // vocabulary for the same idea.
    <fieldset
      ref={block}
      className={cn(surface, "grid gap-4 p-4 sm:grid-cols-2")}
    >
      <legend className="px-2 text-sm font-semibold text-foreground">
        {tVisit("newPet")}
      </legend>
      {/* The intent, and the reason it is a field rather than an
          inference: without it an empty block left on screen by a
          rejected submit is indistinguishable from no block at all,
          and the animal id underneath would quietly win
          (`intake-fields.ts`). */}
      <input type="hidden" name="newPet[intent]" value="1" />
      {/* The way out of a block that one keystroke opened.

          Not inside the `legend`: a legend is laid out by the engine
          rather than by its parent, so a control in it lands somewhere
          no two browsers agree on -- and on a phone it would squeeze
          the heading. First row of the contents instead, right-aligned,
          which is where a form's secondary action sits everywhere else
          in this product. */}
      <div className="flex justify-end sm:col-span-2">
        <button
          type="button"
          onClick={onCancel}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {tCommon("nevermind")}
        </button>
      </div>

      <Field label={t("name")} error={errors?.["newPet[name]"]} required>
        <Input
          name="newPet[name]"
          defaultValue={openedName}
          required
        />
      </Field>

      {/* The chips are a group, not a box: they want the whole row on
          a phone and read as one answer on a desktop. */}
      <Field
        label={t("species")}
        error={errors?.["newPet[species]"]}
        required
        className="sm:col-span-2"
      >
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

      <Field
        label={t("owner")}
        error={errors?.["newPet[ownerId]"]}
        required
        className="sm:col-span-2"
      >
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
          // What is in the box while no owner is chosen: the name that
          // was typed, whether it came in with the block or was typed
          // into this picker and then thought better of. Coming back
          // from a cancelled owner to an empty box would make the vet
          // type it a third time.
          //
          // For a chosen one this is only needed when the picker
          // cannot name the id itself; it looks its own options up. An
          // owner past the cap is the honest gap -- `/pets/new` closes
          // it with a server lookup that a draft restore cannot ask
          // for.
          defaultLabel={
            openedOwnerId && !creatingOwner
              ? matchedOwner?.label
              : ownerName || undefined
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
        // No second frame and no rule down the side: the heading says
        // whose fields these are, and a second border mark would be a
        // hierarchy sign this product does not use anywhere else. On a
        // 390px screen it would also spend the width the consent
        // question underneath needs.
        <FormSection title={tVisit("newOwner")} className="sm:col-span-2">
          {/* Same intent, one branch in. */}
          <input type="hidden" name="newOwner[intent]" value="1" />
          {/* And its own way out, which is not the one above it.

              The create row is one keystroke from the rows over it, so
              it gets pressed by accident -- and the block above has by
              then been given a name and a species. Closing the whole
              thing to undo the inner half would charge the vet for the
              work they got right. This closes the owner alone: the
              animal, its name and its species stay, and the name that
              was typed stays in the picker above as a query. */}
          <div className="flex justify-end">
            <button
              type="button"
              // Flushed for the reason the outer one is: the draft is
              // written by the form's own click handler as this click
              // bubbles past it, and an intent still in the DOM at
              // that moment comes back as an open block tomorrow.
              onClick={() => flushSync(() => setCreatingOwner(false))}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
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
        </FormSection>
      )}
    </fieldset>
  );
}
