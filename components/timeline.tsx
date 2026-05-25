import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
import { formatDateTime, formatMoney, relativeTime } from "@/lib/format";

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

export async function Timeline({
  events,
  currency = "USD",
}: {
  events: TimelineEvent[];
  currency?: string;
}) {
  const t = await getTranslations("timeline");
  const tEnum = await getTranslations("enum");

  if (events.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t("empty")}
        description=""
      />
    );
  }

  return (
    <ol className="flex flex-col">
      {events.map((event) => {
        const Icon = KIND_ICONS[event.kind];
        const labelKey = `labels.${event.kind}` as const;
        return (
          <li key={`${event.kind}-${event.id}`} className="flex gap-4 py-3">
            <div className="relative flex flex-col items-center">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <span aria-hidden className="mt-1 h-full w-px bg-border" />
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
                {formatDateTime(event.at)} · {relativeTime(event.at)}
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
                  ? ` · next: ${formatDateTime(event.nextDueAt)}`
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
  );
}
