"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Client } from "@/generated/prisma/client";
import { centsToInputValue } from "@/lib/money";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { INVOICE_STATUSES } from "@/modules/invoices/schema";
import { createInvoiceAction } from "@/modules/invoices/actions";
import { searchClientsAction } from "@/modules/clients/actions";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

interface Line {
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
}

const emptyLine: Line = { description: "", quantity: "1", unitPrice: "" };

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
  defaultNumber?: string;
  /**
   * The first line, already filled in — today, a visit being billed.
   *
   * The visit page offers to bill a visit and this is what it hands
   * over. It opens the form rather than creating the invoice, which is
   * value's call and the right one: an invoice is a demand for money,
   * and a screen that raises one without the vet reading the amount is
   * the most expensive version of "it did something you did not see".
   */
  prefilledLine?: Line;
}

export function InvoiceForm({
  clients,
  clientsCapped,
  defaultClientId,
  defaultClientLabel,
  defaultNumber,
  prefilledLine,
}: Props) {
  const t = useTranslations("invoice");
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
  const [lines, setLines] = useState<Line[]>([
    { ...emptyLine, ...prefilledLine },
  ]);
  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: c.id,
        label: `${c.firstName} ${c.lastName}`,
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

  return (
    <ActionForm form={form} className="flex flex-col gap-6">
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
        <Field label={t("number")} error={state.fieldErrors?.number} required>
          <Input name="number" defaultValue={defaultNumber} required />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("status")} error={state.fieldErrors?.status} required>
          <Select name="status" defaultValue="DRAFT" required>
            {INVOICE_STATUSES.map((s) => (
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

      <Field
        label={t("tax")}
        error={state.fieldErrors?.tax}
        hint={amountHint}
      >
        <Input name="tax" inputMode="decimal" placeholder={amountPlaceholder} />
      </Field>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">{t("lines")}</p>
        {lines.map((line, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-control border border-border p-3 sm:grid-cols-[1fr_80px_120px_auto]"
          >
            <Input
              name={`lines[${i}].description`}
              placeholder={t("description")}
              value={line.description}
              onChange={(e) => updateLine(i, { description: e.target.value })}
              required={i === 0}
            />
            <Input
              name={`lines[${i}].quantity`}
              type="number"
              min="1"
              placeholder={t("quantity")}
              value={line.quantity}
              onChange={(e) => updateLine(i, { quantity: e.target.value })}
              required={i === 0}
            />
            <Input
              name={`lines[${i}].unitPrice`}
              placeholder={t("unitPrice")}
              inputMode="decimal"
              value={line.unitPrice}
              onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
              required={i === 0}
            />
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
            {lines.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeLine(i)}
              >
                {t("removeLine")}
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={addLine}>
          + {t("addLine")}
        </Button>
      </div>

      <Field label={t("notes")} error={state.fieldErrors?.notes}>
        <Textarea name="notes" rows={3} />
      </Field>

      <SubmitButton>{t("create")}</SubmitButton>
    </ActionForm>
  );
}
