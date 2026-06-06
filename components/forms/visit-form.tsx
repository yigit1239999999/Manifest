"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { Pet, User, Visit } from "@/generated/prisma/client";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { VISIT_TYPES } from "@/modules/appointments/schema";
import {
  createVisitAction,
  updateVisitAction,
} from "@/modules/visits/actions";
import { toDateTimeInput } from "@/lib/format";

interface Props {
  visit?: Visit;
  pets: Pick<Pet, "id" | "name">[];
  vets: Pick<User, "id" | "name">[];
  defaultPetId?: string;
}

export function VisitForm({ visit, pets, vets, defaultPetId }: Props) {
  const t = useTranslations("visit");
  const tType = useTranslations("enum.visitType");
  const tPet = useTranslations("pet");
  const action = visit
    ? updateVisitAction.bind(null, visit.id)
    : createVisitAction;
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tPet("title")} error={state.fieldErrors?.petId} required>
          <Select
            name="petId"
            defaultValue={visit?.petId ?? defaultPetId ?? ""}
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
        <Field label={t("type")} error={state.fieldErrors?.type} required>
          <Select
            name="type"
            defaultValue={visit?.type ?? "WELLNESS_CHECK"}
            required
          >
            {VISIT_TYPES.map((v) => (
              <option key={v} value={v}>
                {tType(v)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("visitedAt")} error={state.fieldErrors?.visitedAt} required>
          <Input
            type="datetime-local"
            name="visitedAt"
            defaultValue={toDateTimeInput(visit?.visitedAt ?? new Date())}
            required
          />
        </Field>
        <Field label={t("vet")} error={state.fieldErrors?.vetId}>
          <Select name="vetId" defaultValue={visit?.vetId ?? ""}>
            <option value="">—</option>
            {vets.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label={t("chiefComplaint")}
        error={state.fieldErrors?.chiefComplaint}
      >
        <Textarea
          name="chiefComplaint"
          rows={2}
          defaultValue={visit?.chiefComplaint ?? ""}
        />
      </Field>

      <fieldset className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <legend className="px-2 text-sm font-semibold text-foreground">
          {t("soap")}
        </legend>
        <Field label={t("subjective")} error={state.fieldErrors?.subjective}>
          <Textarea
            name="subjective"
            rows={4}
            defaultValue={visit?.subjective ?? ""}
          />
        </Field>
        <Field label={t("objective")} error={state.fieldErrors?.objective}>
          <Textarea
            name="objective"
            rows={4}
            defaultValue={visit?.objective ?? ""}
          />
        </Field>
        <Field label={t("assessment")} error={state.fieldErrors?.assessment}>
          <Textarea
            name="assessment"
            rows={4}
            defaultValue={visit?.assessment ?? ""}
          />
        </Field>
        <Field label={t("plan")} error={state.fieldErrors?.plan}>
          <Textarea
            name="plan"
            rows={4}
            defaultValue={visit?.plan ?? ""}
          />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4">
        <legend className="px-2 text-sm font-semibold text-foreground">
          {t("vitals")}
        </legend>
        <Field label={t("weightKg")} error={state.fieldErrors?.weightKg}>
          <Input
            type="number"
            step="0.01"
            name="weightKg"
            defaultValue={visit?.weightKg ?? ""}
          />
        </Field>
        <Field
          label={t("temperatureC")}
          error={state.fieldErrors?.temperatureC}
        >
          <Input
            type="number"
            step="0.1"
            name="temperatureC"
            defaultValue={visit?.temperatureC ?? ""}
          />
        </Field>
        <Field
          label={t("heartRateBpm")}
          error={state.fieldErrors?.heartRateBpm}
        >
          <Input
            type="number"
            name="heartRateBpm"
            defaultValue={visit?.heartRateBpm ?? ""}
          />
        </Field>
        <Field
          label={t("respiratoryRateBpm")}
          error={state.fieldErrors?.respiratoryRateBpm}
        >
          <Input
            type="number"
            name="respiratoryRateBpm"
            defaultValue={visit?.respiratoryRateBpm ?? ""}
          />
        </Field>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("followupAt")} error={state.fieldErrors?.followupAt}>
          <Input
            type="datetime-local"
            name="followupAt"
            defaultValue={toDateTimeInput(visit?.followupAt)}
          />
        </Field>
        <Field label={t("totalCost")} error={state.fieldErrors?.totalCents}>
          <Input
            name="totalCents"
            placeholder="0.00"
            defaultValue={
              visit?.totalCents != null ? (visit.totalCents / 100).toFixed(2) : ""
            }
          />
        </Field>
      </div>

      <SubmitButton>{visit ? t("update") : t("create")}</SubmitButton>
    </form>
  );
}
