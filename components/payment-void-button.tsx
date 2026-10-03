"use client";

import { Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buttonVariants } from "@/components/ui/button";
import type { FormState } from "@/lib/action";

/**
 * Takes back one payment on the invoice page.
 *
 * `destructive`, because there is no way back from it (TEAM.md #25): the
 * correction for a wrong void is a new payment, not an undo. The dialog
 * says what happens to the row and what the invoice will owe afterwards,
 * since "void" alone does not tell a receptionist whether the money
 * disappears from the record.
 *
 * Small and quiet on the row, because it is a correction and not the
 * thing the list is for; the accessible name says which payment it
 * belongs to, which the visible word cannot (TEAM.md #26).
 */
export function PaymentVoidButton({
  action,
  label,
  name,
  confirmText,
  description,
}: {
  action: (formData: FormData) => Promise<FormState | void>;
  label: string;
  name: string;
  confirmText: string;
  description: string;
}) {
  const tCommon = useTranslations("common");

  // The server can refuse (permission, a payment already gone), and the
  // dialog does not report errors itself. A refusal is said here; success
  // loads the page again, for the reason `reloadAfter` gives on
  // ConfirmDialog.
  const run = async (formData: FormData) => {
    const result = await action(formData);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    window.location.reload();
  };

  return (
    <ConfirmDialog
      title={confirmText}
      description={description}
      confirmLabel={label}
      cancelLabel={tCommon("nevermind")}
      tone="destructive"
      action={run}
    >
      {(open) => (
        <button
          type="button"
          onClick={open}
          aria-label={name}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <Undo2 />
          {label}
        </button>
      )}
    </ConfirmDialog>
  );
}
