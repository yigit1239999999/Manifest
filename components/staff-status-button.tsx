"use client";

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
  confirmText?: string;
}) {
  return (
    <form
      action={action as (formData: FormData) => Promise<void>}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className={buttonVariants({
          variant: active ? "ghost" : "secondary",
          size: "sm",
        })}
      >
        {label}
      </button>
    </form>
  );
}
