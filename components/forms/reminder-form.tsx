"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Client, Pet } from "@/generated/prisma/client";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { REMINDER_TYPES } from "@/modules/reminders/schema";
import { createReminderAction } from "@/modules/reminders/actions";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

interface Props {
  clients: Pick<Client, "id" | "firstName" | "lastName">[];
  pets?: Pick<Pet, "id" | "name" | "ownerId">[];
  defaultClientId?: string;
  defaultPetId?: string;
}

export function ReminderForm({
  clients,
  pets,
  defaultClientId,
  defaultPetId,
}: Props) {
  const t = useTranslations("reminder");
  const tType = useTranslations("enum.reminderType");
  const tClient = useTranslations("client");
  const tPet = useTranslations("pet");
  const tCommon = useTranslations("common");
  const form = useActionForm(createReminderAction, {});
  const { state, reset } = form;
  const defaultDue = useMemo(
    // eslint-disable-next-line react-hooks/purity -- one-shot initial value, never recomputed
    () => new Date(Date.now() + 7 * 86400 * 1000),
    [],
  );

  useEffect(() => {
    if (state.success) {
      reset();
      toast.success(tCommon("saved"));
    }
    // No `toast.error` here: a submission error belongs inline, where the
    // user is looking and where it stays until they fix it. A toast on a
    // long form scrolls past someone who is at the bottom of it, and the
    // `Callout` below is already `role="alert"` — two channels announce
    // the same sentence twice.
  }, [state.success, tCommon, reset]);

  return (
    <ActionForm
      form={form}
      className="grid gap-4 sm:grid-cols-2"
    >
      {state.error && (
        <Callout variant="danger" className="sm:col-span-2">
          {state.error}
        </Callout>
      )}
      <Field label={tClient("one")} error={state.fieldErrors?.clientId} required>
        <Select name="clientId" defaultValue={defaultClientId ?? ""} required>
          <option value="" disabled>
              {tCommon("select")}
            </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </Select>
      </Field>
      {pets && (
        <Field label={tPet("one")} error={state.fieldErrors?.petId}>
          <Select name="petId" defaultValue={defaultPetId ?? ""}>
            <option value="">{tCommon("none")}</option>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={t("type")} error={state.fieldErrors?.type} required>
        <Select name="type" defaultValue="CHECKUP" required>
          {REMINDER_TYPES.map((r) => (
            <option key={r} value={r}>
              {tType(r)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("dueAt")} error={state.fieldErrors?.dueAt} required>
        <DateTimeInput
          name="dueAt"
          defaultValue={defaultDue}
          granularity="day"
          required
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label={t("name")} error={state.fieldErrors?.title} required>
          <Input name="title" required />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label={t("body")} error={state.fieldErrors?.body}>
          <Textarea name="body" rows={3} />
        </Field>
      </div>
      <SubmitButton size="sm" className="sm:col-span-2 w-fit">
        {t("create")}
      </SubmitButton>
    </ActionForm>
  );
}
