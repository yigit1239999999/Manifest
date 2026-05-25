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
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 text-xs",
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
            "rounded-md px-2 py-1 font-semibold transition-colors",
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
