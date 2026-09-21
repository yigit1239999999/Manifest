"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

const OPTIONS: { value: "en" | "tr"; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "tr", label: "TR" },
];

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-control border border-border bg-card p-0.5 text-xs",
        className,
      )}
      role="group"
      aria-label={t("language")}
      // While the change is in flight, rather than disabling the
      // buttons. Disabling the one that was just pressed drops focus to
      // `body`, and it does not come back when the transition ends —
      // the next Tab starts from the top of the document.
      aria-busy={pending}
    >
      {OPTIONS.map((option) => {
        const selected = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            // Selected, not disabled, and this is the whole of the fix.
            //
            // `disabled` says a control cannot be used. What was meant
            // here is that it is already chosen, which is a state. The
            // three costs of saying it the wrong way: the selected
            // language could not be reached by keyboard at all, so a
            // two-option group behaved like a one-button control; a
            // screen reader heard "dimmed" and never heard "selected",
            // and being unusable does not explain being current; and
            // `bg-accent` was left as the only channel carrying which
            // language is on.
            //
            // `ThemeToggle` had it right already. There is one model for
            // a segmented control, not two.
            aria-pressed={selected}
            onClick={() => {
              // Pressing the one already chosen does nothing, on purpose.
              // That is what makes leaving it enabled safe.
              if (selected || pending) return;
              startTransition(() => setLocale(option.value));
            }}
            className={cn(
              // See `ThemeToggle`: a segment inside a bordered group takes
              // the mark at offset 0, because an outset one would cross
              // its neighbour.
              "rounded-control px-2 py-1 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-0",
              selected
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
