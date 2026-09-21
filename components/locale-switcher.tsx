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
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={pending || locale === option.value}
          onClick={() => startTransition(() => setLocale(option.value))}
          className={cn(
            // See `ThemeToggle`: a segment inside a bordered group takes
            // the mark at offset 0, because an outset one would cross
            // its neighbour.
            "rounded-control px-2 py-1 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-0",
            locale === option.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
