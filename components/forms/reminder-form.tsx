"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import type { Client, Pet } from "@/generated/prisma/client";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { REMINDER_TYPES } from "@/modules/reminders/schema";
import { createReminderAction } from "@/modules/reminders/actions";
import { toDateTimeInput } from "@/lib/format";

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
  const [state, formAction] = useActionState(createReminderAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const defaultDue = useMemo(
    // eslint-disable-next-line react-hooks/purity -- one-shot initial value, never recomputed
    () => new Date(Date.now() + 7 * 86400 * 1000),
    [],
  );

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      action={formAction}
      ref={formRef}
      className="grid gap-4 sm:grid-cols-2"
    >
      {state.error && (
        <p className="sm:col-span-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Field label={tClient("title")} error={state.fieldErrors?.clientId} required>
        <Select name="clientId" defaultValue={defaultClientId ?? ""} required>
          <option value="" disabled>
            —
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </Select>
      </Field>
      {pets && (
        <Field label={tPet("title")} error={state.fieldErrors?.petId}>
          <Select name="petId" defaultValue={defaultPetId ?? ""}>
            <option value="">—</option>
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
        <Input
          type="datetime-local"
          name="dueAt"
          defaultValue={toDateTimeInput(defaultDue)}
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
    </form>
  );
}
