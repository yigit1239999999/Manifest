"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Client } from "@/generated/prisma/client";
import type { InvoiceLineKind } from "@/generated/prisma/enums";
import { centsToInputValue, parseMoneyToCents } from "@/lib/money";
import { formatMoney } from "@/lib/format";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import {
  DEFAULT_VAT_RATE,
  VAT_RATES,
  vatCents,
  type InvoiceStatus,
  type VatRate,
} from "@/modules/invoices/schema";
import { createInvoiceAction } from "@/modules/invoices/actions";
import { searchClientsAction } from "@/modules/clients/actions";
import { ActionForm, useActionForm } from "@/components/forms/action-form";
import { ownerLabel } from "@/lib/pet-label";

export interface Line {
  description: string;
  quantity: string;
  unitPrice: string;
  /**
   * What this line is for, when it came from somewhere.
   *
   * Carried as hidden inputs rather than held only in React state: the
   * link between a visit and the line that bills it is the thing that
   * stops the same visit being billed twice, and a value that never
   * reaches the FormData is a link that silently is not made. The
   * server already accepts both (`modules/invoices/schema.ts`).
   */
  petId?: string;
  visitId?: string;
  /**
   * What the line bills, when it came from the visit's record. The kind
   * is named on screen in the reader's language; a VISIT line loses it
   * the moment its description is edited, because from then on the words
   * are the vet's and not the visit's type and date.
   */
  kind?: InvoiceLineKind;
}

const emptyLine: Line = { description: "", quantity: "1", unitPrice: "" };

/**
 * The statuses a new invoice can be saved in. "Paid" and "partly paid" are
 * what recorded payments make an invoice, and saving one as paid with no
 * payment behind it is money the month-end count never sees.
 */
const CREATE_STATUSES = ["DRAFT", "SENT"] as const satisfies readonly InvoiceStatus[];

interface Props {
  clients: Pick<Client, "id" | "firstName" | "lastName">[];
  /**
   * True when the list was cut off at its cap.
   *
   * Without it the picker is indistinguishable from a complete one, and a
   * clinic past the cap is told nothing while its last records quietly
   * cannot be chosen. The hint does not promise a way round it, because
   * there is not one yet — it says the list is short so that a missing
   * record reads as a limit rather than as a record that does not exist.
   */
  clientsCapped?: boolean;
  defaultClientId?: string;
  /**
   * The label for `defaultClientId` when that record is not in `clients`.
   *
   * The list is capped (`lib/pagination.ts`), so an id that comes from
   * the record being edited, or from a link that carried one, can sit
   * outside it. Passed unconditionally: a label that matches an option
   * changes nothing, and a missing one leaves a required field looking
   * empty over a hidden input that is not.
   */
  defaultClientLabel?: string;
  /**
   * The lines, already filled in — today, a visit being billed: the visit
   * itself and then each thing done in it (vaccinations, treatments,
   * tests, prescriptions), every price editable.
   *
   * It opens the form rather than creating the invoice, which is value's
   * call and the right one: an invoice is a demand for money, and a
   * screen that raises one without the vet reading the amount is the most
   * expensive version of "it did something you did not see".
   */
  prefilledLines?: Line[];
  /** The clinic's currency, for the live totals. */
  currency: string;
  /** The VAT rate the form opens on: the clinic's last one, or the default. */
  defaultVatRate?: VatRate;
  /**
   * The status the form opens on. Draft unless the caller knows better:
   * billing a visit is billing work already done, so that arrival opens
   * on SENT and the fee counts as owed from the moment it is saved.
   */
  defaultStatus?: InvoiceStatus;
}

export function InvoiceForm({
  clients,
  clientsCapped,
  defaultClientId,
  defaultClientLabel,
  prefilledLines,
  currency,
  defaultVatRate = DEFAULT_VAT_RATE,
  defaultStatus = "DRAFT",
}: Props) {
  const t = useTranslations("invoice");
  const tKind = useTranslations("enum.invoiceLineKind");
  const locale = useLocale();
  const tCommon = useTranslations("common");
  // Both are written the way this locale writes money, so nobody has to
  // guess whether the field wants "1234.50" or "1.234,50".
  const amountPlaceholder = centsToInputValue(locale, 0);
  const amountHint = tCommon("amountExample", {
    example: centsToInputValue(locale, 123_456),
  });
  const tStatus = useTranslations("enum.invoiceStatus");
  const tClient = useTranslations("client");
  const [lines, setLines] = useState<Line[]>(
    prefilledLines && prefilledLines.length > 0 ? prefilledLines : [{ ...emptyLine }],
  );
  const [vatRate, setVatRate] = useState<number>(defaultVatRate);
  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: c.id,
        // See `ReminderForm`: a surname may be absent, and joining the
        // two by hand renders that absence as the word "null".
        label: ownerLabel(c),
      })),
    [clients],
  );
  const form = useActionForm(createInvoiceAction, {});
  const { state } = form;

  const addLine = () => setLines((ls) => [...ls, { ...emptyLine }]);
  const removeLine = (i: number) =>
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  // The same arithmetic the server does (`createInvoice`), shown as the
  // vet types: what a line comes to, the subtotal, the VAT at the chosen
  // rate and the total. A figure that only appears after saving is a
  // figure nobody checked (B9).
  const lineCents = lines.map((l) => {
    const unit = parseMoneyToCents(l.unitPrice, locale);
    const qty = Number(l.quantity);
    return unit !== null && Number.isInteger(qty) && qty > 0 ? unit * qty : null;
  });
  const subtotal = lineCents.reduce<number>((acc, c) => acc + (c ?? 0), 0);
  const tax = vatCents(subtotal, vatRate);
  const money = (cents: number) => formatMoney(locale, cents, currency);

  return (
    // `wide`: the line editor below is a grid that behaves like a
    // table, not a column of labelled fields, and the form cap squeezes
    // columns that need the room. The only opt-out in the app.
    <ActionForm
      form={form}
      wide
      focusFirstEmpty={Boolean(defaultClientId)}
      className="flex flex-col gap-6"
    >
      {/* Part-filled arrivals only: the chain a new clinic walks, or a
          deep link from a record's own page. See `focusFirstEmpty`. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tClient("one")} error={state.fieldErrors?.clientId} required>
          {/* Searchable only once the list is actually short of the whole
              clinic. Attaching the search unconditionally would make every
              small clinic type two letters to reach a list of twelve they
              can already see — fixing the 51st client by taxing the first.
              When `onSearch` is absent the picker browses `options`, which
              is the complete list in that case. */}
          <Combobox
            name="clientId"
            required
            options={clientOptions}
            defaultValue={defaultClientId ?? ""}
            defaultLabel={defaultClientLabel}
            placeholder={tCommon("searchOrType")}
            noResultsLabel={tCommon("noResults")}
            onSearch={clientsCapped ? searchClientsAction : undefined}
            hasMore={clientsCapped}
            searchHintLabel={tCommon("searchMinChars")}
            searchingLabel={tCommon("searching")}
            searchFailedLabel={tCommon("searchFailed")}
            hasMoreLabel={tCommon("searchMore")}
          />
        </Field>
        {/* No number to type: the server gives the clinic's next one in
            sequence when the invoice is saved (B9), so two people
            invoicing at once cannot take the same number. */}
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">{t("number")}</span>
          <span className="text-muted-foreground">{t("numberAssigned")}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("status")} error={state.fieldErrors?.status} required>
          <Select name="status" defaultValue={defaultStatus} required>
            {CREATE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("dueAt")} error={state.fieldErrors?.dueAt}>
          <DateTimeInput name="dueAt" granularity="day" />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">{t("lines")}</p>
        {lines.map((line, i) => {
          const id = (field: string) => `invoice-line-${i}-${field}`;
          const priced = lineCents[i];
          return (
            <div
              key={i}
              className="grid gap-3 rounded-control border border-border p-3 sm:grid-cols-[minmax(0,1fr)_5rem_8rem_7rem_auto] sm:items-end"
            >
              {/* Labelled fields on every line: a placeholder disappears
                  the moment the field is filled, and a column of bare
                  boxes is a form only its author can read (B9). */}
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={id("description")} className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {t("description")}
                  {line.kind && line.kind !== "VISIT" && (
                    <span className="rounded-pill bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                      {tKind(line.kind)}
                    </span>
                  )}
                </label>
                <Input
                  id={id("description")}
                  name={`lines[${i}].description`}
                  value={line.description}
                  onChange={(e) =>
                    updateLine(i, {
                      description: e.target.value,
                      ...(line.kind === "VISIT" ? { kind: undefined } : {}),
                    })
                  }
                  required={i === 0}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={id("quantity")} className="text-sm font-medium">
                  {t("quantity")}
                </label>
                <Input
                  id={id("quantity")}
                  name={`lines[${i}].quantity`}
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: e.target.value })}
                  required={i === 0}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={id("unitPrice")} className="text-sm font-medium">
                  {t("unitPrice")}
                </label>
                <Input
                  id={id("unitPrice")}
                  name={`lines[${i}].unitPrice`}
                  inputMode="decimal"
                  placeholder={amountPlaceholder}
                  value={line.unitPrice}
                  onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                  required={i === 0 || line.description.trim() !== ""}
                />
              </div>
              <div className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{t("lineTotal")}</span>
                <span className="flex h-10 items-center tabular-nums text-foreground">
                  {priced === null ? "-" : money(priced)}
                </span>
              </div>
              {/* Not rendered when absent: an empty hidden input submits
                  an empty string, and the server would read that as "this
                  line is about nothing" rather than "nothing was said". */}
              {line.petId && (
                <input type="hidden" name={`lines[${i}].petId`} value={line.petId} />
              )}
              {line.visitId && (
                <input
                  type="hidden"
                  name={`lines[${i}].visitId`}
                  value={line.visitId}
                />
              )}
              {line.kind && <input type="hidden" name={`lines[${i}].kind`} value={line.kind} />}
              {lines.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-self-start"
                  aria-label={`${t("removeLine")}: ${line.description || t("description")}`}
                  onClick={() => removeLine(i)}
                >
                  {t("removeLine")}
                </Button>
              ) : (
                <span aria-hidden="true" className="hidden sm:block" />
              )}
            </div>
          );
        })}
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={addLine}>
          + {t("addLine")}
        </Button>
        <p className="text-xs text-muted-foreground">{amountHint}</p>
      </div>

      {/* The totals, live, with VAT chosen as a rate rather than typed as
          an amount: the vet knows the rate, and the amount is arithmetic
          the screen should do. */}
      <div className="flex w-full flex-col gap-3 rounded-control border border-border bg-muted/30 p-4 sm:ms-auto sm:w-80">
        <Field label={t("vatRate")} error={state.fieldErrors?.taxRate}>
          <Select name="taxRate" value={String(vatRate)} onChange={(e) => setVatRate(Number(e.target.value))}>
            {VAT_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {t("vatOption", { rate })}
              </option>
            ))}
          </Select>
        </Field>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm" aria-live="polite">
          <dt className="text-muted-foreground">{t("subtotal")}</dt>
          <dd className="text-end tabular-nums">{money(subtotal)}</dd>
          <dt className="text-muted-foreground">{t("taxAt", { rate: vatRate })}</dt>
          <dd className="text-end tabular-nums">{money(tax)}</dd>
          <dt className="font-semibold">{t("total")}</dt>
          <dd className="text-end font-semibold tabular-nums">{money(subtotal + tax)}</dd>
        </dl>
      </div>

      <Field label={t("notes")} error={state.fieldErrors?.notes}>
        <Textarea name="notes" rows={3} />
      </Field>

      <SubmitButton>{t("create")}</SubmitButton>
    </ActionForm>
  );
}
