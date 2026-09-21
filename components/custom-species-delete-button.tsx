"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buttonVariants } from "@/components/ui/button";

export function CustomSpeciesDeleteButton({
  action,
  label,
  confirmText,
  disabled,
  disabledTitle,
}: {
  action: () => Promise<unknown>;
  label: string;
  confirmText: string;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const tCommon = useTranslations("common");

  // The one real deletion left in the app: a species the clinic added by
  // hand, with no animals on it, disappears for good.
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledTitle}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        {label}
      </button>
    );
  }

  return (
    <ConfirmDialog
      title={confirmText}
      confirmLabel={label}
      cancelLabel={tCommon("nevermind")}
      tone="destructive"
      action={action as unknown as (formData: FormData) => Promise<unknown>}
    >
      {(open) => (
        <button
          type="button"
          onClick={open}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {label}
        </button>
      )}
    </ConfirmDialog>
  );
}
