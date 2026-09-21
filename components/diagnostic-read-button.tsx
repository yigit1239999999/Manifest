"use client";

import { Eye } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { useRefreshAction } from "@/components/forms/use-refresh-action";

/**
 * "I have read this result", pressed where the result is.
 *
 * The placement is the requirement, not a preference. The vet who
 * asked for this reads results on a phone between patients: "put the
 * button on the screen where I read the result, one tap. If I have to
 * go to another page for it, I will not go." So the dashboard line
 * takes them to the animal; the job finishes here, beside the text
 * they just read.
 *
 * It says nothing about the owner, and that is deliberate. A result
 * can be read and deliberately not passed on yet — a bad one held
 * until there is time to say it properly — and that is a choice, not
 * an omission. A product that asked "told the owner?" here would file
 * that choice as a missing step. `readAt` carries no such field
 * either, so the screen cannot imply one.
 *
 * One way only, which is the service's shape rather than mine: there
 * is no un-read. The state stays visible on the result afterwards, so
 * a mis-tap is at least findable — but it cannot be reversed, and
 * that is raised rather than hidden behind a button that looks
 * reversible.
 */
export function DiagnosticReadButton({
  action,
  label,
  name,
}: {
  /** Bound to the diagnostic id on the server. */
  action: (formData: FormData) => Promise<unknown>;
  /** What the button reads. Short: it sits inside a dense list. */
  label: string;
  /**
   * What it is called out loud. A page of results carries one of
   * these per row, and by voice they are the same button repeated
   * until the row is in the name.
   */
  name: string;
}) {
  const formAction = useRefreshAction(action);
  return (
    <form action={formAction}>
      <SubmitButton variant="secondary" size="sm" aria-label={name}>
        <Eye />
        {label}
      </SubmitButton>
    </form>
  );
}
