"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Appointment, Pet, User } from "@/generated/prisma/client";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
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
import { ActionForm, useActionForm } from "@/components/forms/action-form";
import { searchPetsAction } from "@/modules/pets/actions";
import { petRowCaption, petRowLabel } from "@/lib/pet-label";

interface Props {
  appointment?: Appointment;
  /** The owner travels with the animal: see `lib/pet-label.ts`. */
  pets: (Pick<Pet, "id" | "name"> & {
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
   * The label for the selected animal (`appointment.petId` or
   * `defaultPetId`) when that record is not in `pets`.
   *
   * The list is capped (`lib/pagination.ts`), so an id that comes from
   * the record being edited, or from a link that carried one, can sit
   * outside it. Passed unconditionally: a label that matches an option
   * changes nothing, and a missing one leaves a required field looking
   * empty over a hidden input that is not.
   */
  defaultPetLabel?: string;
  /**
   * The signed-in user, when they are somebody an appointment may be
   * booked against. Absent for everyone else, and absent is not a
   * fallback: "not recorded" is a better answer than a name nobody
   * chose.
   *
   * The same prop, the same word and the same rule as `VisitForm`.
   * They were two forms behaving two ways in one clinic -- the visit
   * opened with the vet's own name and the appointment opened empty --
   * and a reader cannot tell a deliberate difference from an oversight.
   */
  defaultVetId?: string;
}

export function AppointmentForm({
  appointment,
  pets,
  petsCapped,
  vets,
  defaultPetId,
  defaultPetLabel,
  defaultVetId,
}: Props) {
  const petOptions = useMemo(
    () =>
      pets.map((p) => ({
        value: p.id,
        label: petRowLabel(p.name, p.speciesLabel),
        caption: petRowCaption(p.ownerName, p.lastSeen),
      })),
    [pets],
  );
  const t = useTranslations("appointment");
  const tCommon = useTranslations("common");
  const tStaff = useTranslations("staff");
  const tType = useTranslations("enum.visitType");
  const tStatus = useTranslations("enum.appointmentStatus");
  const tPet = useTranslations("pet");

  const action = appointment
    ? updateAppointmentAction.bind(null, appointment.id)
    : createAppointmentAction;
  const form = useActionForm(action, {});
  const { state } = form;
  const defaultStart = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/purity -- one-shot initial value, never recomputed
      appointment?.startsAt ?? new Date(Date.now() + 3600 * 1000),
    [appointment?.startsAt],
  );

  return (
    <ActionForm
      form={form}
      focusFirstEmpty={Boolean(defaultPetId)}
      className="flex flex-col gap-4"
    >
      {/* Part-filled arrivals only: the chain a new clinic walks, or a
          deep link from a record's own page. See `focusFirstEmpty`. */}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tPet("one")} error={state.fieldErrors?.petId} required>
          {/* See `InvoiceForm`: searchable only once the list is short
              of the whole clinic. */}
          <Combobox
            name="petId"
            required
            options={petOptions}
            defaultValue={appointment?.petId ?? defaultPetId ?? ""}
            defaultLabel={defaultPetLabel}
            placeholder={tCommon("searchOrType")}
            noResultsLabel={tCommon("noResults")}
            onSearch={petsCapped ? searchPetsAction : undefined}
            hasMore={petsCapped}
            searchHintLabel={tCommon("searchMinChars")}
            searchingLabel={tCommon("searching")}
            searchFailedLabel={tCommon("searchFailed")}
            hasMoreLabel={tCommon("searchMore")}
          />
        </Field>
        <Field label={t("startsAt")} error={state.fieldErrors?.startsAt} required>
          <DateTimeInput
            name="startsAt"
            defaultValue={defaultStart}
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

      <Field label={t("vet")} error={state.fieldErrors?.vetId}>
        {/* Only a new appointment takes the default: on an edit the
            field already says who it was booked with, and a blank
            there is a decision somebody made rather than a question
            nobody reached. */}
        <Select
          name="vetId"
          defaultValue={appointment?.vetId ?? defaultVetId ?? ""}
        >
          <option value="">{tCommon("none")}</option>
          {vets.map((v) => (
            <option key={v.id} value={v.id}>
              {v.id === defaultVetId ? tStaff("youNamed", { name: v.name }) : v.name}
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
    </ActionForm>
  );
}
