"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const THEMES = ["light", "dark", "system"] as const;
type Theme = (typeof THEMES)[number];

const THEME_COOKIE = "theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function ThemeToggle({
  className,
  initialTheme = "system",
}: {
  className?: string;
  initialTheme?: Theme;
}) {
  const t = useTranslations("common");
  // Seeded from the server-read cookie so SSR and hydration agree.
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  function setTheme(next: Theme) {
    setThemeState(next);
    // eslint-disable-next-line react-hooks/immutability -- document.cookie is the persistence mechanism
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    // The `data-theme` value is written verbatim (incl. "system"); CSS
    // resolves "system" via a prefers-color-scheme media query.
    document.documentElement.setAttribute("data-theme", next);
  }

  const icons = { light: Sun, dark: Moon, system: Monitor } as const;
  const labels = { light: "Light", dark: "Dark", system: "Auto" };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5",
        className,
      )}
      role="group"
      aria-label={t("theme")}
    >
      {THEMES.map((option) => {
        const Icon = icons[option];
        const active = theme === option;
        return (
          <button
            key={option}
            type="button"
            aria-label={labels[option]}
            aria-pressed={active}
            onClick={() => setTheme(option)}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
