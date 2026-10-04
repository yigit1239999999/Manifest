"use client";

import { Send } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { useRefreshAction } from "@/components/forms/use-refresh-action";

/**
 * Turns a draft invoice into a sent one. No confirmation: it is reversible
 * in effect (the invoice can still be cancelled) and it is what the page's
 * one other path, recording a payment, would have assumed anyway.
 */
export function MarkSentButton({
  action,
  label,
}: {
  action: (formData: FormData) => Promise<unknown>;
  label: string;
}) {
  const formAction = useRefreshAction(action);
  return (
    <form action={formAction}>
      <SubmitButton>
        <Send />
        {label}
      </SubmitButton>
    </form>
  );
}
