import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** The day being shown, as "YYYY-MM-DD" in the clinic's zone. */
  date: string;
  previousDate: string;
  nextDate: string;
  todayDate: string;
  /** Rendered heading for `date`, e.g. "Wednesday, 23 September 2026". */
  label: string;
  /** Builds the href for a day (or for every day, when `date` is null). */
  href: (date: string | null) => string;
  labels: {
    previous: string;
    next: string;
    today: string;
    allDates: string;
  };
}

/** Moves a day at a time, keeping the chosen day in the URL so the view
 *  can be refreshed and shared. */
export function DayNav({
  date,
  previousDate,
  nextDate,
  todayDate,
  label,
  href,
  labels,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Link
          href={href(previousDate)}
          aria-label={labels.previous}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <Link
          href={href(nextDate)}
          aria-label={labels.next}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>

      <h2 className="min-w-0 flex-1 text-sm font-semibold text-foreground">
        {label}
      </h2>

      <div className="flex items-center gap-1.5">
        <Pill href={href(todayDate)} active={date === todayDate}>
          {labels.today}
        </Pill>
        <Pill href={href(null)} active={false}>
          {labels.allDates}
        </Pill>
      </div>
    </div>
  );
}

function Pill({
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
