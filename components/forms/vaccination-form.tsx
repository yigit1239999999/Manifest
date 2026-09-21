"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { createVaccinationAction } from "@/modules/vaccinations/actions";
import { VACCINES } from "@/lib/procedures";
import { ActionForm, useActionForm } from "@/components/forms/action-form";
import { addInterval, type IntervalSuggestion } from "@/lib/vaccination-interval";
import { formatPlainDate } from "@/lib/format";

const VACCINE_OPTIONS = VACCINES.map((v) => ({ value: v, label: v }));

export function VaccinationForm({
  petId,
  visitId,
  /**
   * What this clinic usually does, per vaccine name, for this animal's
   * species. Empty for a clinic with no history, and that is the whole of
   * the empty case: no chip, no default, no date (backlog 20c).
   */
  suggestions = {},
}: {
  petId: string;
  visitId?: string;
  suggestions?: Record<string, IntervalSuggestion>;
}) {
  const t = useTranslations("vaccination");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const form = useActionForm(createVaccinationAction, {});
  const { state, reset } = form;

  // The three fields that talk to each other. The rest of the form keeps its
  // own state, as before.
  const [name, setName] = useState("");
  const [administered, setAdministered] = useState("");
  const [nextDue, setNextDue] = useState("");

  useEffect(() => {
    if (state.success) {
      reset();
      toast.success(tCommon("saved"));
    }
    if (state.error) toast.error(state.error);
  }, [state.success, state.error, tCommon, reset]);

  // `reset()` clears the uncontrolled fields; these two are held up here, so
  // they have to follow. Adjusted during render rather than in an effect —
  // the same pattern `action-form.tsx` uses to re-arm its messages — because
  // an effect would paint the old vaccine name for a frame and then blank it.
  const [seenReset, setSeenReset] = useState(form.resetToken);
  if (seenReset !== form.resetToken) {
    setSeenReset(form.resetToken);
    setName("");
    setNextDue("");
  }

  const suggestion = suggestions[name.trim().toLowerCase()];
  // Dated from the administration date on screen, not from today: a dose
  // recorded three weeks late is due a year after it was given.
  const suggestedDate =
    suggestion && administered
      ? addInterval(administered.slice(0, 10), suggestion)
      : "";
  const intervalLabel = suggestion
    ? t(`interval.${suggestion.unit}`, { count: suggestion.value })
    : "";

  return (
    <ActionForm form={form} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="petId" value={petId} />
      {visitId && <input type="hidden" name="visitId" value={visitId} />}

      <Field label={t("name")} error={state.fieldErrors?.name} required>
        <Combobox
          name="name"
          freeText
          required
          options={VACCINE_OPTIONS}
          placeholder={t("namePlaceholder")}
          noResultsLabel={tCommon("noResults")}
          onValueChange={setName}
        />
      </Field>
      <Field
        label={t("administeredAt")}
        error={state.fieldErrors?.administeredAt}
        required
      >
        <DateTimeInput
          name="administeredAt"
          defaultValue={new Date()}
          onValueChange={setAdministered}
          required
        />
      </Field>

      {/* Directly under the vaccine, across the whole form, because this is
          the field the return loop is made of — it used to sit fifth, between
          the lot number and the injection site, at the same visual weight as
          both (backlog 20a). The suggestion depends on the vaccine, so it can
          only appear after one has been chosen, which is the other reason it
          belongs here rather than further down. */}
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Field label={t("nextDueAt")} error={state.fieldErrors?.nextDueAt}>
          <DateTimeInput
            name="nextDueAt"
            granularity="day"
            value={nextDue}
            onValueChange={setNextDue}
          />
        </Field>

        {suggestion && suggestedDate && (
          <div className="flex flex-col gap-1">
            {/* A suggestion, never a default: the field stays empty until
                someone decides. One tap is cheap, but it is a decision, and
                a date that filled itself in is a medical claim nobody
                made (TEAM.md #14). */}
            <button
              type="button"
              onClick={() => setNextDue(suggestedDate)}
              className="inline-flex w-fit items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Sparkles className="size-3.5 text-muted-foreground" />
              {t("suggestionChip", {
                interval: intervalLabel,
                date: formatPlainDate(locale, suggestedDate),
              })}
            </button>
            {/* Where the number came from. Required, not decoration: a
                suggestion with no visible basis is indistinguishable from
                the app inventing a schedule. */}
            <p className="text-xs text-muted-foreground">
              {t("suggestionSource", {
                count: suggestion.sampleSize,
                name: name.trim(),
                interval: intervalLabel,
              })}
            </p>
          </div>
        )}

        {/* What filling the field in actually does — the strongest reason to
            fill one in is seeing its consequence (TEAM.md #22). It says
            "appears under Upcoming vaccinations" and not "a reminder is
            sent", because today the first is true and the second is not
            (TEAM.md #33). It becomes the reminder sentence when the code
            behind it lands (backlog 21). */}
        <p className="text-xs text-muted-foreground">
          {nextDue ? t("nextDueResult") : t("nextDueEmpty")}
        </p>
      </div>

      <Field label={t("manufacturer")} error={state.fieldErrors?.manufacturer}>
        <Input name="manufacturer" />
      </Field>
      <Field label={t("lotNumber")} error={state.fieldErrors?.lotNumber}>
        <Input name="lotNumber" />
      </Field>
      <Field label={t("site")} error={state.fieldErrors?.site}>
        <Input name="site" />
      </Field>
      <div className="sm:col-span-2">
        <Field label={t("notes")} error={state.fieldErrors?.notes}>
          <Textarea name="notes" rows={2} />
        </Field>
      </div>
      <SubmitButton size="sm" className="sm:col-span-2 w-fit">
        {t("create")}
      </SubmitButton>
    </ActionForm>
  );
}
