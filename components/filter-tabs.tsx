import Link from "next/link";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  basePath: string;
  param: string;
  active?: string;
  allLabel: string;
  options: FilterOption[];
}

export function FilterTabs({
  basePath,
  param,
  active,
  allLabel,
  options,
}: Props) {
  const buildHref = (value?: string) =>
    value ? `${basePath}?${param}=${encodeURIComponent(value)}` : basePath;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label={param}
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
