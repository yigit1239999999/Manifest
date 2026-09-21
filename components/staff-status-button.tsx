"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserCheck, UserX } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buttonVariants } from "@/components/ui/button";
import type { FormState } from "@/lib/action";

export function StaffStatusButton({
  action,
  active,
  label,
  name,
  confirmText,
}: {
  action: (formData: FormData) => Promise<FormState | void>;
  active: boolean;
  label: string;
  /**
   * What the button is called to a screen reader, which has to say whose
   * account it turns off.
   *
   * Five rows carried five buttons all named "Deactivate" — the row was
   * identified only by where it happened to be on the screen, which is
   * the one thing a screen reader user does not have. Hiding the word
   * below `sm` made it worse: the name became the only channel.
   *
   * Built from the visible label at the call site, not written beside it,
   * so "Deactivate" stays sayable out loud (TEAM.md #26).
   */
  name: string;
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

  // The word is hidden on a phone, not the button.
  //
  // `/staff` is the widest list in the app — five columns, one of them an
  // e-mail address — and ux measured that even three do not fit 292px. Two
  // columns moved under the name; this is the last 49px, and it is all
  // label. The word comes back at `sm`, and the accessible name carries it
  // at every width, so nothing is lost to anyone (TEAM.md #27: an action
  // off the edge and a hidden one are the same thing — an action that is
  // still there and still named is neither).
  const Icon = active ? UserX : UserCheck;
  const trigger = (onClick?: () => void) => (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      aria-label={name}
      className={buttonVariants({
        variant: active ? "ghost" : "secondary",
        size: "sm",
      })}
    >
      <Icon />
      <span className="sr-only sm:not-sr-only">{label}</span>
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
