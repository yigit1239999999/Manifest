"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/action";

/**
 * Reports what the server said, then shows the page again. The dialog does
 * not report errors itself (see `ConfirmDialog`), and a refusal here -- a
 * date in the future, a date before the animal was born -- has to be said.
 */
async function runAndReload(
  action: (formData: FormData) => Promise<FormState | void>,
  formData: FormData,
) {
  const result = await action(formData);
  const message =
    result?.error ?? Object.values(result?.fieldErrors ?? {}).flat()[0];
  if (message) {
    toast.error(message);
    return;
  }
  window.location.reload();
}

/**
 * "Vefat etti olarak işaretle", on the animal's page.
 *
 * `default` tone, not `destructive`: it is reversible ("yanlışlıkla
 * işaretlendi" sits on the notice it leaves), and an undoable action
 * dressed as a deletion teaches people to fear it (TEAM.md #25). The
 * dialog says what changes, because that is the reason to mark it at all:
 * no message about this animal goes out again.
 */
export function MarkDeceasedButton({
  action,
  petName,
}: {
  action: (formData: FormData) => Promise<FormState | void>;
  petName: string;
}) {
  const t = useTranslations("pet.deceasedMark");
  const tCommon = useTranslations("common");
  return (
    <ConfirmDialog
      title={t("title", { name: petName })}
      description={t("description")}
      confirmLabel={t("confirm")}
      cancelLabel={tCommon("nevermind")}
      tone="default"
      action={(formData) => runAndReload(action, formData)}
      fields={
        <>
          <Field label={t("date")} required>
            <DateTimeInput
              name="deceasedAt"
              granularity="day"
              defaultValue={new Date()}
              required
            />
          </Field>
          <Field label={t("note")} hint={t("noteHint")}>
            <Textarea name="deceasedNote" rows={2} maxLength={500} />
          </Field>
        </>
      }
    >
      {(open) => (
        <button
          type="button"
          onClick={open}
          className={buttonVariants({ variant: "ghost" })}
        >
          {t("button")}
        </button>
      )}
    </ConfirmDialog>
  );
}

/** "Yanlışlıkla işaretlendi": the way back, on the deceased notice. */
export function UnmarkDeceasedButton({
  action,
}: {
  action: (formData: FormData) => Promise<FormState | void>;
}) {
  const t = useTranslations("pet.deceasedMark");
  const tCommon = useTranslations("common");
  return (
    <ConfirmDialog
      title={t("undoTitle")}
      description={t("undoDescription")}
      confirmLabel={t("undoConfirm")}
      cancelLabel={tCommon("nevermind")}
      tone="default"
      action={(formData) => runAndReload(action, formData)}
    >
      {(open) => (
        <button
          type="button"
          onClick={open}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <Undo2 />
          {t("undo")}
        </button>
      )}
    </ConfirmDialog>
  );
}
