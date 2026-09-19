"use client";

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
  return (
    <form
      action={action as unknown as (formData: FormData) => Promise<void>}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        {label}
      </button>
    </form>
  );
}
