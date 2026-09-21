"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { Client } from "@/generated/prisma/client";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { OptionalDetails } from "@/components/ui/optional-details";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { CONTACT_METHODS, LANGUAGES } from "@/modules/clients/schema";
import {
  createClientAction,
  updateClientAction,
} from "@/modules/clients/actions";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

interface Props {
  client?: Client;
  /**
   * Where the vet was going when they found they needed a client
   * first. Carried through the save so they land back on it instead
   * of on the new client's page with their errand forgotten.
   *
   * Validated on the server before it is used -- `lib/next-param.ts`
   * -- because this ends up deciding a redirect.
   */
  next?: string;
}

// Three answers and not two, and the third is the one the counter
// produces. Until now "nobody has asked" was the absence of a
// selection: true and false were the only things a reader could click,
// and unasked was what you got by clicking neither. That reads as an
// unfinished form rather than as an answer, and it is an answer -- it
// is the honest state of most clients on the day they are created.
//
// Stated in this order because the vet stated it in this order, and
// carried as a table so the control, its wording and its sentence
// cannot drift apart. The empty string is what the wire wants: the
// schema turns anything that is not "true" or "false" into no value at
// all, which is how "not asked" stays distinct from "refused" all the
// way to the column.
//
// Deliberately not `required`. The vet's reason is the whole design:
// "if you force me I will tick one at random, and that means messaging
// someone who never agreed." A forced answer here is worse than no
// answer, because it is indistinguishable from a real one.
const CONSENT_ANSWERS = ["true", "false", ""] as const;

type ConsentAnswer = (typeof CONSENT_ANSWERS)[number];

const CONSENT_LABELS: Record<ConsentAnswer, string> = {
  true: "consent.granted",
  false: "consent.declined",
  "": "consent.unanswered",
};

const CONSENT_HINTS: Record<ConsentAnswer, string> = {
  true: "consent.grantedHint",
  false: "consent.declinedHint",
  "": "consent.unansweredHint",
};

export function ClientForm({ client, next }: Props) {
  const t = useTranslations("client");
  const tEnum = useTranslations("enum.contactMethod");
  const tCommon = useTranslations("common");
  const tLang = useTranslations("enum.language");

  const action = client
    ? updateClientAction.bind(null, client.id)
    : createClientAction;
  const form = useActionForm(action, {});
  const { state } = form;

  // Three states, not two, and the third is the one that matters: a
  // client nobody has asked yet is not a client who said no. They get
  // the same silence and they are owed different work, so the record
  // has to be able to say "unanswered" and the form has to be able to
  // leave it that way. Nothing is selected until someone selects it.
  //
  // Held in state only because the sentence underneath changes with it;
  // the radios are what the form submits. `=== true` / `=== false`
  // rather than a truthiness test, so that a null arrives here as null
  // instead of collapsing into "declined" on its way through.
  // Editing an existing client opens the fold when any of it is filled,
  // so nothing that exists is ever hidden from the person looking at it.
  const hasOptionalData = Boolean(
    client &&
      (client.email ||
        client.secondaryPhone ||
        client.preferredContact ||
        client.preferredLanguage ||
        client.address ||
        client.city ||
        client.postalCode ||
        client.country ||
        client.notes),
  );

  const consentNoteId = useId();
  const [consent, setConsent] = useState<"true" | "false" | "">(
    client?.notificationsOptIn === true
      ? "true"
      : client?.notificationsOptIn === false
        ? "false"
        : "",
  );

  return (
    <ActionForm form={form} className="flex flex-col gap-8">
      {/* The errand, travelling with the form because a server action
          cannot see the URL it was submitted from. */}
      {next && <input type="hidden" name="next" value={next} />}
      <FormSection
        title={t("sections.identity")}
        description={t("sections.identityHint")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("firstName")}
            error={state.fieldErrors?.firstName}
            required
          >
            <Input
              name="firstName"
              defaultValue={client?.firstName}
              autoComplete="given-name"
              required
            />
          </Field>
          <Field
            label={t("lastName")}
            error={state.fieldErrors?.lastName}
            required
          >
            <Input
              name="lastName"
              defaultValue={client?.lastName}
              autoComplete="family-name"
              required
            />
          </Field>
        </div>
        {/* The phone comes up here out of the contact block, because at
            the counter it is not contact detail -- it is the key. The
            vet's own account: "if I do not take her number I will never
            find that animal again." */}
        <Field label={t("phone")} error={state.fieldErrors?.phone}>
          <Input
            name="phone"
            type="tel"
            defaultValue={client?.phone ?? ""}
            autoComplete="tel"
          />
        </Field>
      </FormSection>

    {/* Under the phone and above the fold, which is the order of the
        two questions: consent is whether a message goes at all, the
        channel is which one it goes by. Asking which door to knock on
        before asking whether to knock reads as though the answer to
        the second is assumed -- and the channel now sits behind the
        fold, so the order holds by construction.

        This is the one field here that may not be folded away, and
        the reason is what its empty value does. Unasked is stored as
        `null` and silently means "send this owner nothing", so a
        folded consent would make every client opened at the counter
        unreachable, on the same dashboard that is gaining a count of
        exactly those owners. The counter is also the cheapest moment
        it will ever be asked: the owner is standing there and the
        question rides along with the phone number.

            A plain `fieldset` rather than `Field`: `Field` associates
            one label with one control and injects the id, and a group
            of radios needs a `legend` instead — the name of the
            question, not of any one answer. `min-w-0` because a
            fieldset's default minimum width is its min-content, which
            in a grid column is how a long legend pushes the page
            wider than the phone it is on. */}
        <fieldset className="min-w-0 sm:col-span-2">
          {/* The fieldset stays a plain block and the contents get
              their own flex wrapper. A `legend` is laid out by the
              engine rather than by its parent's display mode, so a
              flex or grid fieldset puts it somewhere none of the
              three agree on; keeping the layout one level in is the
              boring arrangement that renders the same everywhere. */}
          <legend className="mb-2 text-sm font-medium text-foreground">
            {t("consent.legend")}
          </legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {CONSENT_ANSWERS.map((answer) => (
              <label
                key={answer}
                // `py-1` is not padding for looks. The label is the
                // clickable target — bigger than the 16px box, which
                // is the point — but at `text-sm` its height was the
                // line box, 20px, and WCAG 2.5.8 asks for 24. pm
                // measured it: 81×20 and 101×20 in Turkish, 111×20
                // and 80×20 in English. Width was never the problem;
                // height was, on the two controls a phone user taps
                // to answer a consent question. This makes it 28.
                className="flex min-h-6 items-center gap-2 py-1 text-sm text-foreground"
              >
                <input
                  type="radio"
                  name="notificationsOptIn"
                  value={answer}
                  // On the inputs, not on the `fieldset`.
                  //
                  // The line underneath was visible and silent: it
                  // told anyone who could see it that no automatic
                  // message goes out until an answer is recorded,
                  // and told nobody else. A description on a
                  // `fieldset` is announced unevenly across screen
                  // readers; on the control it is read when focus
                  // arrives, which is the moment the sentence is
                  // about. One channel rather than both, for the
                  // same reason the error summary is not also a live
                  // region — two copies of one sentence is not twice
                  // the information.
                  aria-describedby={consentNoteId}
                  checked={consent === answer}
                  onChange={() => setConsent(answer)}
                  // No focus class and no `accent-color`: both come
                  // from the rules in `app/globals.css` that cover
                  // every tick and radio in the product. A tenth copy
                  // here would be the one that drifts.
                  className="size-4"
                />
                {t(CONSENT_LABELS[answer])}
              </label>
            ))}
          </div>
          {/* All three states say something, including the empty one
              (TEAM.md #21). Unanswered and declined end in the same
              silence and are not the same fact: one is work still to
              do, the other is a closed question. And consent needs a
              sentence of its own — copy that only describes the
              refusal leaves the vet to infer what a yes buys. */}
          <p
            id={consentNoteId}
            className="mt-2 text-xs text-muted-foreground"
          >
            {t(CONSENT_HINTS[consent])}
          </p>
        </fieldset>

      {/* Nine fields behind one fold, and the split is the whole point
          of this form rather than a tidy-up. Measured on the counter
          path a receptionist actually walks -- client, then animal,
          then appointment -- this form came first and showed all
          thirteen of its fields with two required. `pet-form` had
          already been cut to the minute the work takes; this is that
          same cut, arriving at the form that is reached first.

          What stays outside is not "the important ones". It is the four
          things the vet described themselves asking while the owner
          stands there: who they are, how to reach them, and whether
          they may be written to. Everything else is true of the client
          and can be true of them tomorrow. */}
      <OptionalDetails
        title={t("optionalDetails")}
        hint={t("optionalDetailsHint")}
        defaultOpen={hasOptionalData}
      >
        <FormSection
          title={t("sections.contact")}
          description={t("sections.contactHint")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("email")} error={state.fieldErrors?.email}>
              <Input
                name="email"
                type="email"
                defaultValue={client?.email ?? ""}
                autoComplete="email"
                placeholder={tCommon("emailPlaceholder")}
              />
            </Field>
            <Field
              label={t("secondaryPhone")}
              error={state.fieldErrors?.secondaryPhone}
            >
              <Input
                name="secondaryPhone"
                type="tel"
                defaultValue={client?.secondaryPhone ?? ""}
              />
            </Field>
            <Field
              label={t("preferredContact")}
              error={state.fieldErrors?.preferredContact}
            >
              <Select
                name="preferredContact"
                defaultValue={client?.preferredContact ?? ""}
              >
                <option value="">{tCommon("none")}</option>
                {CONTACT_METHODS.map((v) => (
                  <option key={v} value={v}>
                    {tEnum(v)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("preferredLanguage")}
              error={state.fieldErrors?.preferredLanguage}
              hint={t("preferredLanguageHint")}
            >
              <Select
                name="preferredLanguage"
                defaultValue={client?.preferredLanguage ?? ""}
              >
                <option value="">{tCommon("none")}</option>
                {LANGUAGES.map((v) => (
                  <option key={v} value={v}>
                    {tLang(v)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </FormSection>

        <FormSection
          title={t("sections.address")}
          description={t("sections.addressHint")}
        >
          <Field label={t("address")} error={state.fieldErrors?.address}>
            <Input
              name="address"
              defaultValue={client?.address ?? ""}
              autoComplete="street-address"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("city")} error={state.fieldErrors?.city}>
              <Input name="city" defaultValue={client?.city ?? ""} />
            </Field>
            <Field label={t("postalCode")} error={state.fieldErrors?.postalCode}>
              <Input name="postalCode" defaultValue={client?.postalCode ?? ""} />
            </Field>
            <Field label={t("country")} error={state.fieldErrors?.country}>
              <Input name="country" defaultValue={client?.country ?? ""} />
            </Field>
          </div>
        </FormSection>

        {/* "Preferences & notes" with the consent box gone is a section
            named after something that left it: what remains is notes.
            The heading follows the content rather than the other way
            round. */}
        <FormSection
          title={t("sections.notes")}
          description={t("sections.notesHint")}
        >
          <Field label={t("notes")} error={state.fieldErrors?.notes}>
            <Textarea name="notes" rows={4} defaultValue={client?.notes ?? ""} />
          </Field>
        </FormSection>
      </OptionalDetails>

      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-muted-foreground">
          {tCommon("requiredFields", {
            fields: [t("firstName"), t("lastName")].join(", "),
          })}
        </span>
        <SubmitButton>{client ? t("update") : t("create")}</SubmitButton>
      </div>
    </ActionForm>
  );
}
