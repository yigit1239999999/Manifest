"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const STEPS = ["upload", "map", "preview", "import"] as const;
export type Step = (typeof STEPS)[number];

/**
 * Where the clinic is in the four steps. Not a navigation: going back is
 * done with each step's own "Back", because jumping ahead past a step
 * that has not been answered has nothing to show.
 *
 * On a phone only the current step keeps its name; four names do not fit
 * in 358px, and the numbered circles still say how far there is to go.
 */
export function Stepper({ current }: { current: Step }) {
  const t = useTranslations("import.steps");
  const index = STEPS.indexOf(current);

  return (
    <nav aria-label={t("name")}>
      <ol className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((step, i) => {
          const done = i < index;
          const active = i === index;
          return (
            // `relative` on the visible label: the sr-only suffixes are absolutely
            // positioned, and the label truncates; without being their containing
            // block they escaped the clip and gave the page 8px of sideways scroll.
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className={cn("flex min-w-0 items-center gap-2 sm:gap-3", i < STEPS.length - 1 && "sm:flex-1", active && "max-sm:flex-1")}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-pill border text-xs font-semibold tabular-nums transition-colors",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary bg-accent text-accent-foreground",
                    !done && !active && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "truncate text-sm",
                    active ? "relative font-medium text-foreground" : "sr-only text-muted-foreground sm:not-sr-only",
                  )}
                >
                  {t(step)}
                  {done && <span className="sr-only"> ({t("done")})</span>}
                  {active && <span className="sr-only"> ({t("current")})</span>}
                </span>
              </span>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn("h-px w-3 shrink-0 sm:w-auto sm:min-w-3 sm:flex-1", done ? "bg-primary" : "bg-border")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
