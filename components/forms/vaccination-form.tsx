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
import { ActionForm, useActionForm } from "@/components/forms/action-form";
import { addInterval } from "@/lib/vaccination-interval";
import { formatPlainDate } from "@/lib/format";
import { offerByName, type VaccineOffer } from "@/modules/vaccinations/catalogue";

export function VaccinationForm({
  petId,
  visitId,
  /**
   * This clinic's vaccine list for this animal's species: what the product
   * ships, minus what the clinic hid, plus what it added -- each line
   * already carrying WHOSE interval it will propose (#37).
   *
   * Empty for a species nobody dictated a list for, and that is the whole
   * of the empty case: the name stays free text, no chip, no default, no
   * date (backlog 20c).
   */
  offers = [],
  /** How many doses this animal already has of each offer, by key. */
  priorDoses = {},
}: {
  petId: string;
  visitId?: string;
  offers?: VaccineOffer[];
  priorDoses?: Record<string, number>;
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
  /**
   * Which dose the vet settled on, once they have touched the field. Null
   * means "still whatever the list proposed" -- the same distinction the
   * next-due field keeps, and for the same reason: a number nobody has
   * looked at must not be indistinguishable from one they chose.
   */
  const [dose, setDose] = useState<string | null>(null);
  /**
   * Where the date in the field came from, as the record will remember it.
   * Typing one by hand makes it MANUAL whatever the list said, because at
   * that point the list is not what the vet used.
   */
  const [dueSource, setDueSource] = useState<"HISTORY" | "CLINIC" | "LIST" | "MANUAL" | "">("");

  const savedMessage = tCommon("saved");

  // The message is resolved BEFORE the effect and the effect depends on
  // the string, not on the translator. `useTranslations` hands back a
  // new function identity on a re-render, so a dependency array holding
  // it re-runs the effect for a render that changed nothing -- and the
  // user gets a second toast for one save. A string is equal to itself.
  useEffect(() => {
    if (state.success) {
      reset();
      toast.success(savedMessage);
    }
  }, [state.success, savedMessage, reset]);

  // `reset()` clears the uncontrolled fields; these two are held up here, so
  // they have to follow. Adjusted during render rather than in an effect —
  // the same pattern `action-form.tsx` uses to re-arm its messages — because
  // an effect would paint the old vaccine name for a frame and then blank it.
  const [seenReset, setSeenReset] = useState(form.resetToken);
  if (seenReset !== form.resetToken) {
    setSeenReset(form.resetToken);
    setName("");
    setNextDue("");
    setDose(null);
    setDueSource("");
  }

  // The line of the clinic's list this name belongs to, matched through
  // every name the vaccine has ever been offered under -- a record written
  // under the old long name is the same vaccine, and the whole point of the
  // list is that it does not cut a clinic off from its own history.
  const offer = offerByName(offers, name);
  const interval = offer && offer.due.kind !== "ask" && offer.due.kind !== "none"
    ? offer.due.interval
    : null;
  // Dated from the administration date on screen, not from today: a dose
  // recorded three weeks late is due a year after it was given.
  const suggestedDate =
    interval && administered ? addInterval(administered.slice(0, 10), interval) : "";
  const intervalLabel = interval
    ? t(`interval.${interval.unit}`, { count: interval.value })
    : "";

  // Where the number comes from, as a sentence rather than a decoration.
  // The user chose this screen with that line in it ("365 gün, listeden
  // geldi"), and it is the difference between a clinic's own measurement
  // and our default -- which must never look the same (#37).
  const sourceLine =
    offer?.due.kind === "history"
      ? t("suggestionSource", {
          count: offer.due.sampleSize,
          name: offer.name,
          interval: intervalLabel,
        })
      : offer?.due.kind === "clinic"
        ? t("sourceClinic", { interval: intervalLabel })
        : offer?.due.kind === "list"
          ? t("sourceList", { interval: intervalLabel })
          : offer?.due.kind === "ask"
            ? t("sourceAsk")
            : "";

  // Which dose of the starting series this is, counted from what the animal
  // already has on record. A PROPOSAL like every other number here: shown,
  // editable, and never written without being seen.
  const given = offer ? (priorDoses[offer.key] ?? 0) : 0;
  const series = offer?.series;
  const proposedDose = series ? Math.min(given + 1, series.doses) : null;
  // What the sentence under the field counts: the number in the field, not
  // the number we proposed for it. They are the same until the vet changes
  // one, and after that the sentence has to follow, or the screen argues
  // with itself about which dose this is.
  const doseShown = Number(dose ?? "") || proposedDose;
  const seriesFinished = series ? given >= series.doses : false;

  // The clinic's own list, with the book's name beside the vet's where
  // there is one: "Karma (FVRCP)" is what the approved screen shows, and
  // the value written is still the name the vet says.
  // The proposed dose belongs to the vaccine, so choosing another vaccine
  // takes the vet's previous answer with it. Adjusted during render rather
  // than in an effect, the way `resetToken` above is handled: an effect
  // would paint the old number for a frame.
  //
  // The DATE goes with it too, but only if the date came from a proposal:
  // a proposed date is a claim about the vaccine that proposed it, and
  // leaving it behind would put one vaccine's schedule on another under
  // that vaccine's source. A date the vet typed themselves stays, because
  // it was never ours to withdraw -- and it is already MANUAL, so nothing
  // it says about where it came from becomes false.
  const [seenOffer, setSeenOffer] = useState(offer?.key ?? "");
  if (seenOffer !== (offer?.key ?? "")) {
    setSeenOffer(offer?.key ?? "");
    setDose(null);
    if (dueSource !== "" && dueSource !== "MANUAL") {
      setNextDue("");
      setDueSource("");
    }
  }

  const options = offers.map((entry) => ({
    value: entry.name,
    label: entry.bookName ? `${entry.name} (${entry.bookName})` : entry.name,
  }));

  return (
    <ActionForm form={form} className="grid gap-3 sm:grid-cols-2">

      <input type="hidden" name="petId" value={petId} />
      {visitId && <input type="hidden" name="visitId" value={visitId} />}

      <Field label={t("name")} error={state.fieldErrors?.name} required>
        <Combobox
          name="name"
          freeText
          required
          options={options}
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
            onValueChange={(value) => {
              setNextDue(value);
              // Whatever the list said, the vet typed this one.
              if (value !== suggestedDate) setDueSource(value ? "MANUAL" : "");
            }}
          />
        </Field>

        {suggestedDate && (
          <div className="flex flex-col gap-1">
            {/* A suggestion, never a default: the field stays empty until
                someone decides. One tap is cheap, but it is a decision, and
                a date that filled itself in is a medical claim nobody
                made (TEAM.md #14). */}
            <button
              type="button"
              onClick={() => {
                setNextDue(suggestedDate);
                setDueSource(
                  offer?.due.kind === "history"
                    ? "HISTORY"
                    : offer?.due.kind === "clinic"
                      ? "CLINIC"
                      : "LIST",
                );
              }}
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
                the app inventing a schedule -- and the user chose this
                screen with this line in it. The clinic's own measurement
                and our shipped default say different sentences on purpose. */}
            <p className="text-xs text-muted-foreground">{sourceLine}</p>
          </div>
        )}

        {/* The vaccine we will not date. Not a missing chip: a sentence,
            because the vet asked for the question rather than a guess --
            "bunun tarihini önermeyin, bana sorun." */}
        {offer?.due.kind === "ask" && (
          <p className="text-xs text-foreground">{sourceLine}</p>
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

      {/* What the record will remember about the number above. Hidden
          because it is not a question for the vet -- it is the answer to
          "where did this come from", and the screen already says it in
          words one line up. */}
      {nextDue && dueSource && (
        <input type="hidden" name="nextDueSource" value={dueSource} />
      )}

      {/* The starting series, and the question a single date cannot answer:
          not "when was the last one" but "which dose were we on". Shown
          only for the vaccines that have a series, because for the rest
          there is nothing to be on. */}
      {series && (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Field
            label={t("doseNumber")}
            hint={t("doseNumberHint")}
            error={state.fieldErrors?.doseNumber}
          >
            <Input
              name="doseNumber"
              type="number"
              min={1}
              max={series.doses}
              value={dose ?? String(proposedDose ?? "")}
              onChange={(e) => setDose(e.target.value)}
            />
          </Field>
          <input type="hidden" name="seriesOf" value={series.doses} />
          <p className="text-xs text-muted-foreground">
            {series.between.max
              ? t("seriesLine", {
                  doses: series.doses,
                  min: series.between.min,
                  max: series.between.max,
                })
              : t("seriesLineSingle", { doses: series.doses, min: series.between.min })}
          </p>
          {series.lastNotBeforeWeeks && (
            <p className="text-xs text-muted-foreground">
              {t("seriesLastNotBefore", { weeks: series.lastNotBeforeWeeks })}
            </p>
          )}
          {/* Counted from the animal's own record, including doses written
              under a name this product no longer offers. */}
          <p className="text-xs text-foreground">
            {seriesFinished
              ? t("seriesDone", { of: series.doses })
              : t("seriesPosition", { number: doseShown ?? 1, of: series.doses })}
          </p>
        </div>
      )}

      {/* What the list knows about this vaccine beyond its schedule. One
          line, in the vet's own terms, and only when there is one. */}
      {(offer?.note || offer?.startAt) && (
        <div className="flex flex-col gap-1 sm:col-span-2">
          {offer.note && (
            <p className="text-xs text-muted-foreground">
              {t(`note${offer.note[0].toUpperCase()}${offer.note.slice(1)}`)}
            </p>
          )}
          {offer.startAt && (
            <p className="text-xs text-muted-foreground">
              {offer.startAt.max
                ? t("startAtRange", { min: offer.startAt.min, max: offer.startAt.max })
                : t("startAtFrom", { min: offer.startAt.min })}
            </p>
          )}
        </div>
      )}

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
