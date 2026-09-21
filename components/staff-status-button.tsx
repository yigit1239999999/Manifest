"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buttonVariants } from "@/components/ui/button";
import type { FormState } from "@/lib/action";

export function StaffStatusButton({
  action,
  active,
  label,
  confirmText,
}: {
  action: (formData: FormData) => Promise<FormState | void>;
  active: boolean;
  label: string;
  /** Only deactivating asks; switching someone back on does not. */
  confirmText?: string;
}) {
  const tCommon = useTranslations("common");
  const router = useRouter();

  // The server can refuse: a clinic may not switch off its last
  // administrator. The action returns that message instead of throwing it
  // into a form with nowhere to show it, and without this the click would
  // look like it did nothing. On success the list is refreshed here, which
  // is why the action does not call revalidatePath.
  const run = async (formData: FormData) => {
    const result = await action(formData);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  };

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
        action={run}
      >
        {(open) => trigger(open)}
      </ConfirmDialog>
    );
  }

  return (
    <form action={run}>{trigger()}</form>
  );
}
