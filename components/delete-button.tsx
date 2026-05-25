"use client";

import { Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function DeleteButton({
  action,
  label = "Delete",
  confirmText,
}: {
  action: (formData: FormData) => Promise<unknown>;
  label?: string;
  confirmText: string;
}) {
  return (
    <form
      action={action as (formData: FormData) => Promise<void>}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className={buttonVariants({ variant: "destructive", size: "md" })}
      >
        <Trash2 />
        {label}
      </button>
    </form>
  );
}
