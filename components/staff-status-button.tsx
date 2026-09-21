"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buttonVariants } from "@/components/ui/button";

export function StaffStatusButton({
  action,
  active,
  label,
  confirmText,
}: {
  action: (formData: FormData) => Promise<unknown>;
  active: boolean;
  label: string;
  /** Only deactivating asks; switching someone back on does not. */
  confirmText?: string;
}) {
  const tCommon = useTranslations("common");

  const trigger = (onClick?: () => void) => (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      className={buttonVariants({
        variant: active ? "ghost" : "secondary",
        size: "sm",
      })}
    >
      {label}
    </button>
  );

  // Turning an account off and on again is reversible, so the dialog is the
  // `default` tone: it asks, it does not warn.
  if (confirmText) {
    return (
      <ConfirmDialog
        title={confirmText}
        confirmLabel={label}
        cancelLabel={tCommon("nevermind")}
        tone="default"
        action={action}
      >
        {(open) => trigger(open)}
      </ConfirmDialog>
    );
  }

  return (
    <form action={action as (formData: FormData) => Promise<void>}>
      {trigger()}
    </form>
  );
}
