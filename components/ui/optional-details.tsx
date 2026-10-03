import { ChevronDown } from "lucide-react";

/**
 * The part of a form that can wait, folded away until somebody wants it.
 *
 * This exists because of a measurement rather than a preference. At the
 * counter an owner is standing in front of the receptionist, and the
 * vet's own account of how a record gets made is "she asks for their
 * phone, asks about the animal -- it took a minute". `pet-form` was
 * written for that minute: four fields up front and nine folded. The
 * client form, which is the one reached FIRST on that path, showed all
 * thirteen. So the pattern was already right and simply had not
 * travelled; this is the travelling, not a new idea.
 *
 * What may NOT go in here is the harder half. A folded field is a field
 * that will usually be left empty, so the fold is a decision about what
 * the clinic will end up not knowing -- not about tidiness. Two rules
 * hold today:
 *
 * - Nothing required. A required field behind a fold is a form that
 *   refuses to submit for a reason the reader cannot see.
 * - Nothing whose EMPTY value carries a meaning the clinic will act on.
 *   Notification consent is the live case (value's constraint): unasked
 *   is stored as `null` and silently means "send this owner nothing",
 *   so folding it would make every client created at the counter
 *   silently unreachable -- while the dashboard is gaining a count of
 *   exactly those owners. Asking costs three seconds at the counter and
 *   is far more expensive at every later moment.
 *
 * `title` and `hint` are passed in rather than read from a namespace
 * here: the hint names the fields behind the fold, so it belongs to the
 * form, not to the primitive. The title happens to read the same in both
 * forms today; if a third caller appears it is worth one shared key.
 */
export function OptionalDetails({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** Names what is behind the fold. A fold with no hint is a drawer with
   *  no label: the reader has to open it to find out whether they need
   *  it, which costs more than the fold saves. */
  hint: string;
  /** Open on arrival when the record already has some of these filled,
   *  so editing never hides data that exists.
   *
   *  React does not track `<details>` toggling, so this is read as an
   *  initial value: it is derived from the loaded record and does not
   *  change while the form is open, which is what keeps a re-render
   *  (a failed submit, say) from folding the reader's own work away. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-surface border border-border bg-muted/20 open:bg-transparent"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col">
          <span className="font-semibold text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="flex flex-col gap-8 px-4 pb-5 pt-2">{children}</div>
    </details>
  );
}
