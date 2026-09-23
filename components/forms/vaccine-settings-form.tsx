"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { FormState } from "@/lib/action";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

/**
 * The clinic's own version of the vaccine list.
 *
 * THE CHECKBOX SAYS "ON MY LIST", NOT "HIDE". A screen of boxes where
 * ticking one REMOVES something is a screen people get wrong, and getting
 * it wrong here costs a vet a vaccine they cannot find and cannot explain.
 * Hiding is also not deleting: the name stays typable and every record
 * already written under it is untouched. A list is what gets offered.
 *
 * THE INTERVAL BOX IS EMPTY BY DEFAULT, AND THAT IS THE POINT. Empty means
 * "whatever my own records say, or failing that whatever the list says" --
 * the precedence the form screen shows in a sentence. Pre-filling it with
 * the shipped number would turn every clinic into one that has overruled
 * us, and their own measured interval would stop reaching the form.
 */
export interface VaccineSettingsRow {
  key: string;
  species: string;
  name: string;
  bookName?: string;
  shown: boolean;
  override?: { unit: string; value: number };
  /** What the list says, shown as the placeholder rather than as a value. */
  listLabel: string;
}

export interface AddedRow {
  species: string;
  name: string;
  interval?: { unit: string; value: number };
}

const UNITS = ["week", "month", "year"] as const;

export function VaccineSettingsForm({
  action,
  rows,
  added,
  speciesOptions,
  unitLabels,
  labels,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  rows: VaccineSettingsRow[];
  added: AddedRow[];
  speciesOptions: { value: string; label: string }[];
  unitLabels: Record<(typeof UNITS)[number], string>;
  labels: {
    onList: string;
    interval: string;
    intervalHint: string;
    addTitle: string;
    addName: string;
    addSpecies: string;
    remove: string;
    save: string;
    saved: string;
  };
}) {
  const form = useActionForm(action, {});
  const { state } = form;

  useEffect(() => {
    if (state.success) toast.success(labels.saved);
  }, [state.success, labels.saved]);

  const bySpecies = speciesOptions
    .map((option) => ({
      ...option,
      rows: rows.filter((row) => row.species === option.value),
    }))
    .filter((group) => group.rows.length > 0);

  return (
    <ActionForm form={form} className="flex flex-col gap-6">
      {bySpecies.map((group) => (
        <div key={group.value} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
          <ul className="flex flex-col gap-2">
            {group.rows.map((row) => (
              <li
                key={row.key}
                className="flex flex-wrap items-center gap-3 rounded-control border border-border bg-card px-3 py-2.5"
              >
                <input type="hidden" name="catalogueKey" value={row.key} />
                <label className="flex flex-1 items-center gap-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    name="shown"
                    value={row.key}
                    defaultChecked={row.shown}
                    className="size-4 rounded border-border"
                  />
                  <span className="font-medium">
                    {row.name}
                    {row.bookName ? (
                      <span className="text-muted-foreground"> ({row.bookName})</span>
                    ) : null}
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    name={`interval-${row.key}`}
                    type="number"
                    min={1}
                    className="w-20"
                    defaultValue={row.override?.value ?? ""}
                    // What the list would say, shown as a placeholder so it
                    // reads as "this is what happens if you leave it" rather
                    // than as an answer already given.
                    placeholder={row.listLabel}
                    aria-label={labels.interval}
                  />
                  <Select
                    name={`unit-${row.key}`}
                    defaultValue={row.override?.unit ?? "year"}
                    className="w-28"
                    aria-label={labels.interval}
                  >
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unitLabels[unit]}
                      </option>
                    ))}
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="text-xs text-muted-foreground">{labels.intervalHint}</p>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{labels.addTitle}</h3>
        {/* The clinic's own entries, and one empty row under them. The empty
            row is how "add" works here: no button that reveals a form, no
            dialog, and nothing to dismiss -- the row is already there. */}
        {[...added, { species: "", name: "", interval: undefined }].map((entry, index) => (
          <div
            key={`${entry.name}-${index}`}
            className="flex flex-wrap items-center gap-2 rounded-control border border-border bg-card px-3 py-2.5"
          >
            <Select
              name="addedSpecies"
              defaultValue={entry.species}
              className="w-40"
              aria-label={labels.addSpecies}
            >
              <option value="">{labels.addSpecies}</option>
              {speciesOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              name="addedName"
              defaultValue={entry.name}
              placeholder={labels.addName}
              className="flex-1 min-w-40"
              aria-label={labels.addName}
            />
            <Input
              name="addedValue"
              type="number"
              min={1}
              className="w-20"
              defaultValue={entry.interval?.value ?? ""}
              aria-label={labels.interval}
            />
            <Select
              name="addedUnit"
              defaultValue={entry.interval?.unit ?? "year"}
              className="w-28"
              aria-label={labels.interval}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unitLabels[unit]}
                </option>
              ))}
            </Select>
            {/* Removing one is emptying its name, which is also how it was
                added. A delete button here would be a second mechanism for
                the same act, and the two would drift. */}
            {entry.name ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Trash2 className="size-3.5" aria-hidden />
                {labels.remove}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <SubmitButton className="w-fit">{labels.save}</SubmitButton>
    </ActionForm>
  );
}
