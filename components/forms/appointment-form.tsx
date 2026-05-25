"use client";

import { useActionState, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Appointment, Pet, User } from "@/generated/prisma/client";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import {
  APPOINTMENT_STATUSES,
  VISIT_TYPES,
} from "@/modules/appointments/schema";
import {
  createAppointmentAction,
  updateAppointmentAction,
} from "@/modules/appointments/actions";
import { toDateTimeInput } from "@/lib/format";

interface Props {
  appointment?: Appointment;
  pets: Pick<Pet, "id" | "name">[];
  vets: Pick<User, "id" | "name">[];
  defaultPetId?: string;
}

export function AppointmentForm({
  appointment,
  pets,
  vets,
  defaultPetId,
}: Props) {
  const t = useTranslations("appointment");
  const tType = useTranslations("enum.visitType");
  const tStatus = useTranslations("enum.appointmentStatus");
  const tPet = useTranslations("pet");

  const action = appointment
    ? updateAppointmentAction.bind(null, appointment.id)
    : createAppointmentAction;
  const [state, formAction] = useActionState(action, {});
  const defaultStart = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/purity -- one-shot initial value, never recomputed
      appointment?.startsAt ?? new Date(Date.now() + 3600 * 1000),
    [appointment?.startsAt],
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tPet("title")} error={state.fieldErrors?.petId} required>
          <Select
            name="petId"
            defaultValue={appointment?.petId ?? defaultPetId ?? ""}
            required
          >
            <option value="" disabled>
              —
            </option>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("startsAt")} error={state.fieldErrors?.startsAt} required>
          <Input
            type="datetime-local"
            name="startsAt"
            defaultValue={toDateTimeInput(defaultStart)}
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label={t("durationMinutes")}
          error={state.fieldErrors?.durationMinutes}
        >
          <Input
            type="number"
            min="5"
            max="480"
            name="durationMinutes"
            defaultValue={appointment?.durationMinutes ?? 30}
          />
        </Field>
        <Field label={t("type")} error={state.fieldErrors?.type} required>
          <Select
            name="type"
            defaultValue={appointment?.type ?? "WELLNESS_CHECK"}
            required
          >
            {VISIT_TYPES.map((v) => (
              <option key={v} value={v}>
                {tType(v)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("status")} error={state.fieldErrors?.status} required>
          <Select
            name="status"
            defaultValue={appointment?.status ?? "SCHEDULED"}
            required
          >
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label={tPet("title")} error={state.fieldErrors?.vetId}>
        <Select name="vetId" defaultValue={appointment?.vetId ?? ""}>
          <option value="">—</option>
          {vets.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t("reason")} error={state.fieldErrors?.reason}>
        <Input name="reason" defaultValue={appointment?.reason ?? ""} />
      </Field>
      <Field label={t("notes")} error={state.fieldErrors?.notes}>
        <Textarea
          name="notes"
          rows={3}
          defaultValue={appointment?.notes ?? ""}
        />
      </Field>

      <SubmitButton>{appointment ? t("update") : t("create")}</SubmitButton>
    </form>
  );
}
