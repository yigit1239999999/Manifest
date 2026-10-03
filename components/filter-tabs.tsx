import Link from "next/link";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  basePath: string;
  param: string;
  /**
   * The accessible name of the group, translated.
   *
   * Required rather than defaulted to `param`, which is what it used to be:
   * a screen reader announced the visits filter as "archived" and "type",
   * raw query-string keys, in English, on a Turkish screen.
   */
  label: string;
  active?: string;
  allLabel: string;
  options: FilterOption[];
  /** Other query params to carry along, so filters combine. */
  params?: Record<string, string | undefined>;
}

export function FilterTabs({
  basePath,
  param,
  label,
  active,
  allLabel,
  options,
  params,
}: Props) {
  const buildHref = (value?: string) => {
    const query = new URLSearchParams();
    for (const [key, v] of Object.entries(params ?? {})) {
      if (v) query.set(key, v);
    }
    if (value) query.set(param, value);
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label={label}
    >
      <FilterPill href={buildHref()} active={!active}>
        {allLabel}
      </FilterPill>
      {options.map((o) => (
        <FilterPill
          key={o.value}
          href={buildHref(o.value)}
          active={active === o.value}
        >
          {o.label}
        </FilterPill>
      ))}
    </div>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-pill border px-3 py-1 text-xs font-medium transition-colors-no-focus-delay",
        // The ring is stated, not inherited, and the selected chip is
        // why. A browser's default focus ring takes its colour from the
        // element's own text, and this chip's text is
        // `--primary-foreground` -- near-black in dark, white in light.
        // With `outline-offset: 2px` the ring is drawn two pixels
        // OUTSIDE the chip, on the page rather than on the fill it was
        // borrowed from, so it measured 1.01 against the page in dark
        // and 1.10 in light: invisible in both (pm). Somebody moving
        // through the filters by keyboard could not see where they
        // were.
        //
        // Every other control here states `--ring` for the same reason;
        // this one had no focus style at all, so it was the only place
        // the default's colour rule could bite. `--ring` measures 4.74
        // on the page in light and 8.20 in dark, either side of the
        // 3:1 a focus indicator needs.
        "focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-2",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
