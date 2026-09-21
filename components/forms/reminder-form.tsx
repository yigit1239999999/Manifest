"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Client, Pet } from "@/generated/prisma/client";
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
  /** See `InvoiceForm`: true when the list was cut off at its cap. */
  clientsCapped?: boolean;
  pets?: Pick<Pet, "id" | "name" | "ownerId">[];
  petsCapped?: boolean;
  defaultClientId?: string;
  defaultPetId?: string;
}

export function ReminderForm({
  clients,
  clientsCapped,
  pets,
  petsCapped,
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
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [petId, setPetId] = useState(defaultPetId ?? "");

  // Who owns what, for the two jobs below: narrowing the list and naming an
  // owner beside an animal.
  const ownerNames = useMemo(
    () =>
      new Map(clients.map((c) => [c.id, `${c.firstName} ${c.lastName}`])),
    [clients],
  );

  // With a client chosen, only their animals — the reminder is refused
  // otherwise (`createReminder` checks `ownerId`), so offering the rest is
  // offering work that will be thrown away after it is typed.
  //
  // With none chosen, all of them, because a vet thinks in animals: "remind
  // them about Karabaş" comes before remembering whose Karabaş it is.
  // Choosing one then fills the client in. This is the only state where the
  // owner's name earns its place in the option — once the list is narrowed
  // every row would carry the same name, which is noise, not confirmation.
  const choosablePets = clientId
    ? (pets ?? []).filter((p) => p.ownerId === clientId)
    : (pets ?? []);

  // Adjusted during render rather than in an effect: an effect would paint
  // the stale animal for a frame and then blank it. Same pattern as
  // `action-form.tsx`.
  if (petId && !choosablePets.some((p) => p.id === petId)) setPetId("");

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
    // No `toast.error`: the rule and its reasoning live in
    // `action-form.tsx`, which owns the box a failure goes into.
  }, [state.success, tCommon, reset]);

  // These two are held up here, so `reset()` — which clears the
  // uncontrolled fields — cannot reach them. Adjusted during render for the
  // reason above, and keyed on the token `reset()` increments.
  const [seenReset, setSeenReset] = useState(form.resetToken);
  if (seenReset !== form.resetToken) {
    setSeenReset(form.resetToken);
    setClientId(defaultClientId ?? "");
    setPetId(defaultPetId ?? "");
  }

  return (
    <ActionForm
      form={form}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field
        label={tClient("one")}
        error={state.fieldErrors?.clientId}
        hint={
          clientsCapped
            ? tCommon("listCapped", { count: clients.length })
            : undefined
        }
        required
      >
        <Select
          name="clientId"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          required
        >
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
        <Field
          label={tPet("one")}
          error={state.fieldErrors?.petId}
          hint={
            petsCapped && !clientId
              ? // Only while the list is unnarrowed: once a client is
                // chosen the list is their animals, complete, whatever
                // the cap did to the one it was filtered from.
                tCommon("listCapped", { count: pets.length })
              : undefined
          }
        >
          <Select
            name="petId"
            value={petId}
            onChange={(e) => {
              const next = e.target.value;
              setPetId(next);
              // Picking the animal first is the natural order, so it
              // answers the client question rather than leaving it to be
              // answered twice.
              const owner = pets.find((p) => p.id === next)?.ownerId;
              if (owner) setClientId(owner);
            }}
          >
            <option value="">{tCommon("none")}</option>
            {choosablePets.map((p) => (
              <option key={p.id} value={p.id}>
                {clientId
                  ? p.name
                  : `${p.name} · ${ownerNames.get(p.ownerId) ?? ""}`}
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
