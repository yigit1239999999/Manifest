import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  Pin,
  Pill,
  Receipt,
  Stethoscope,
  Syringe,
  TestTube,
} from "lucide-react";
import type { TimelineEvent } from "@/modules/timeline/queries";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatTime, relativeTime } from "@/lib/format";

const KIND_ICONS = {
  visit: Stethoscope,
  appointment: CalendarClock,
  vaccination: Syringe,
  prescription: Pill,
  treatment: ClipboardList,
  diagnostic: TestTube,
  note: FileText,
  invoice: Receipt,
} as const;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function Timeline({
  events,
  currency = "USD",
}: {
  events: TimelineEvent[];
  currency?: string;
}) {
  const t = await getTranslations("timeline");
  const tEnum = await getTranslations("enum");
  const locale = await getLocale();

  if (events.length === 0) {
    return <EmptyState icon={ClipboardList} title={t("empty")} description="" />;
  }

  // Group by date (UTC day). Iteration preserves the input order which is
  // already sorted by date desc (with pinned notes floated to the top).
  const groups = new Map<string, { label: string; events: TimelineEvent[] }>();
  const dayLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  for (const event of events) {
    const key = dayKey(event.at);
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = { label: dayLabel.format(event.at), events: [] };
      groups.set(key, bucket);
    }
    bucket.events.push(event);
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(groups.values()).map((group, gi) => (
        <section key={gi} className="flex flex-col gap-1">
          <h3 className="sticky top-16 z-[1] -mx-2 bg-background/85 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
            {group.label}
            <span className="ml-2 text-muted-foreground/60">
              · {relativeTime(group.events[0].at)}
            </span>
          </h3>
          <ol className="flex flex-col">
            {group.events.map((event) => {
              const Icon = KIND_ICONS[event.kind];
              const labelKey = `labels.${event.kind}` as const;
              return (
                <li
                  key={`${event.kind}-${event.id}`}
                  className="flex gap-4 py-3 animate-in fade-in"
                >
                  <div className="relative flex flex-col items-center">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span
                      aria-hidden
                      className="mt-1 h-full w-px bg-border"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 pb-3">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {t(labelKey)}
                      </Badge>
                      <p className="text-sm font-semibold text-foreground">
                        {event.title}
                      </p>
                      {event.kind === "note" && event.pinned && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600"
                          aria-label="pinned"
                        >
                          <Pin className="size-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(event.at)}
                      {event.kind === "visit" && event.vet
                        ? ` · ${event.vet.name}`
                        : ""}
                      {event.kind === "appointment"
                        ? ` · ${tEnum(`appointmentStatus.${event.status}` as never)}`
                        : ""}
                      {event.kind === "diagnostic"
                        ? ` · ${tEnum(`diagnosticType.${event.type}` as never)}`
                        : ""}
                      {event.kind === "prescription"
                        ? ` · ${tEnum(`prescriptionStatus.${event.status}` as never)}`
                        : ""}
                      {event.kind === "vaccination" && event.nextDueAt
                        ? ` · next: ${dayLabel.format(event.nextDueAt)}`
                        : ""}
                      {event.kind === "note" && event.author
                        ? ` · ${event.author.name}`
                        : ""}
                      {event.kind === "invoice"
                        ? ` · ${formatMoney(event.totalCents, currency)}`
                        : ""}
                    </p>
                    {event.summary && (
                      <p className="whitespace-pre-wrap text-sm text-foreground/80">
                        {event.summary}
                      </p>
                    )}
                    {event.kind === "visit" && (
                      <Link
                        href={`/visits/${event.id}`}
                        className="w-fit text-xs font-medium text-primary hover:underline"
                      >
                        →
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
