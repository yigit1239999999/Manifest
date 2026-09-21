"use client";

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
import {
  ConsentChoice,
  type ConsentAnswer,
} from "@/components/ui/consent-choice";

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
  /**
   * The name the vet had typed into the picker that sent them here,
   * already split.
   *
   * The counter is writing down a person who is standing in front of
   * them, so what was typed is a whole name: the page splits it at the
   * first space and both halves are editable, because a guess in an
   * editable box costs a keystroke and retyping the name costs the
   * thing the vet complained about.
   */
  defaultFirstName?: string;
  defaultLastName?: string;
}

// What is behind the fold, named rather than counted by hand.
//
// The hint tells the reader how many fields they are not seeing, and ux
// asked for the number to be derived: "today it is nine, tomorrow it is
// eight, and a hand-written 9 will lie one day". This list is the
// derivation, and `optional-details.test` compares it against the
// controls actually rendered inside the fold -- so it cannot drift from
// the form without a red suite.
const FOLDED_FIELDS = [
  "email",
  "secondaryPhone",
  "preferredContact",
  "preferredLanguage",
  "address",
  "city",
  "postalCode",
  "country",
  "notes",
] as const;

export function ClientForm({
  client,
  next,
  defaultFirstName,
  defaultLastName,
}: Props) {
  const t = useTranslations("client");
  const tEnum = useTranslations("enum.contactMethod");
  const tCommon = useTranslations("common");
  const tLang = useTranslations("enum.language");

  const action = client
    ? updateClientAction.bind(null, client.id)
    : createClientAction;
  const form = useActionForm(action, {});
  const { state } = form;

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

  // Three states, not two, and the third is the one that matters: a
  // client nobody has asked yet is not a client who said no. They get
  // the same silence and they are owed different work, so the record
  // has to be able to say "unanswered" and the form has to be able to
  // leave it that way. Nothing is selected until someone selects it.
  //
  // `=== true` / `=== false` rather than a truthiness test, so that a
  // null arrives at the control as null instead of collapsing into
  // "declined" on its way through.
  const consent: ConsentAnswer | null =
    client?.notificationsOptIn === true
      ? "true"
      : client?.notificationsOptIn === false
        ? "false"
        : null;

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
              defaultValue={client?.firstName ?? defaultFirstName ?? ""}
              autoComplete="given-name"
              required
            />
          </Field>
          {/* The surname is the field the counter breaks on: an owner
              can be a regular without anyone knowing it. "I would put a
              full stop there and the record would be rubbish" is why
              the hint says what to do instead. */}
          <Field
            label={t("lastName")}
            error={state.fieldErrors?.lastName}
            hint={t("lastNameHint")}
          >
            <Input
              name="lastName"
              defaultValue={client?.lastName ?? defaultLastName ?? ""}
              autoComplete="family-name"
            />
          </Field>
        </div>
        {/* The phone comes up here out of the contact block, because at
            the counter it is not contact detail -- it is the key. The
            vet's own account: "if I do not take her number I will never
            find that animal again." */}
        <Field
          label={t("phone")}
          error={state.fieldErrors?.phone}
          hint={t("phoneHint")}
          required
        >
          <Input
            name="phone"
            type="tel"
            defaultValue={client?.phone ?? ""}
            autoComplete="tel"
            required
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

        The words are this form's and not the control's, and the split
        from the ones the client's own page uses to DISPLAY the same
        three states is on purpose. Here they are the question a
        receptionist reads out to the owner standing in front of them
        -- "may we send reminder messages?" / "yes, consented" -- and
        ux asked for exactly that: the sentence the vet says, not the
        name of our column. On a record's page there is nobody to ask
        and the same state is a fact being reported. One vocabulary
        answering both would be wrong in one of the two places. */}
        <ConsentChoice
          name="notificationsOptIn"
          defaultValue={consent}
          className="sm:col-span-2"
          legend={t("consent.legend")}
          labels={{
            true: t("consent.answer.granted"),
            false: t("consent.answer.declined"),
            "": t("consent.answer.unanswered"),
          }}
          hints={{
            true: t("consent.grantedHint"),
            false: t("consent.declinedHint"),
            "": t("consent.unansweredHint"),
          }}
        />

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
        hint={t("optionalDetailsHint", { count: FOLDED_FIELDS.length })}
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
            fields: [t("firstName"), t("phone")].join(", "),
          })}
        </span>
        <SubmitButton>{client ? t("update") : t("create")}</SubmitButton>
      </div>
    </ActionForm>
  );
}
