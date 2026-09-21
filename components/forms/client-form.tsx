"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Client } from "@/generated/prisma/client";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
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
}

export function ClientForm({ client }: Props) {
  const t = useTranslations("client");
  const tEnum = useTranslations("enum.contactMethod");
  const tCommon = useTranslations("common");
  const tLang = useTranslations("enum.language");

  const action = client
    ? updateClientAction.bind(null, client.id)
    : createClientAction;
  const form = useActionForm(action, {});
  const { state } = form;

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  return (
    <ActionForm form={form} className="flex flex-col gap-8">
      {state.error && <Callout variant="danger">{state.error}</Callout>}

      <FormSection title={t("sections.identity")} description={t("sections.identityHint")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("firstName")} error={state.fieldErrors?.firstName} required>
            <Input
              name="firstName"
              defaultValue={client?.firstName}
              autoComplete="given-name"
              required
            />
          </Field>
          <Field label={t("lastName")} error={state.fieldErrors?.lastName} required>
            <Input
              name="lastName"
              defaultValue={client?.lastName}
              autoComplete="family-name"
              required
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title={t("sections.contact")} description={t("sections.contactHint")}>
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
          <Field label={t("phone")} error={state.fieldErrors?.phone}>
            <Input
              name="phone"
              type="tel"
              defaultValue={client?.phone ?? ""}
              autoComplete="tel"
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

      <FormSection title={t("sections.address")} description={t("sections.addressHint")}>
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

      <FormSection
        title={t("sections.preferences")}
        description={t("sections.preferencesHint")}
      >
        {/* Consent is a record of something the client said, so the box
            starts empty and the copy says what ticking it means. */}
        <label className="flex items-start gap-3 rounded-control border border-border bg-muted/20 p-3 text-sm">
          <input
            type="checkbox"
            name="notificationsOptIn"
            defaultChecked={client?.notificationsOptIn ?? false}
            className="mt-0.5 size-4 rounded border-border"
          />
          <span className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{t("notificationsOptIn")}</span>
            <span className="text-xs text-muted-foreground">{t("notificationsOptInHint")}</span>
          </span>
        </label>
        <Field label={t("notes")} error={state.fieldErrors?.notes}>
          <Textarea name="notes" rows={4} defaultValue={client?.notes ?? ""} />
        </Field>
      </FormSection>

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
