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
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
