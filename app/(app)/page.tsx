import Link from "next/link";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";
import {
  CalendarClock,
  ClipboardList,
  PawPrint,
  Pill,
  Receipt,
  Stethoscope,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { dashboardInsights } from "@/modules/dashboard/queries";
import { getClinicCurrency } from "@/modules/clinics/queries";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ColumnBars, HorizontalBars } from "@/components/charts";
import {
  currencySymbol,
  firstName,
  formatDate,
  formatDateTime,
  formatMoney,
  intlLocale,
} from "@/lib/format";

export default async function DashboardPage() {
  const session = await requireSession();
  const [t, tSpecies, tVisitType, insights, currency, fmt] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("enum.species"),
    getTranslations("enum.visitType"),
    dashboardInsights(session.user.clinicId),
    getClinicCurrency(session.user.clinicId),
    getFormatContext(),
  ]);

  const weekFmt = new Intl.DateTimeFormat(intlLocale(fmt.locale), {
    day: "numeric",
    month: "short",
    timeZone: fmt.timeZone,
  });
  const monthFmt = new Intl.DateTimeFormat(intlLocale(fmt.locale), {
    month: "short",
    timeZone: fmt.timeZone,
  });

  const metrics = [
    {
      key: "clients" as const,
      icon: Users,
      value: insights.counts.clients,
      href: "/clients",
      hint: undefined as string | undefined,
    },
    {
      key: "pets" as const,
      icon: PawPrint,
      value: insights.counts.pets,
      href: "/pets",
      hint: undefined,
    },
    {
      key: "visits" as const,
      icon: Stethoscope,
      value: insights.counts.visits,
      href: "/visits",
      hint: undefined,
    },
    {
      key: "upcomingAppointments" as const,
      icon: CalendarClock,
      value: insights.counts.upcomingAppointments,
      href: "/appointments",
      hint: undefined,
    },
    {
      key: "activePrescriptions" as const,
      icon: Pill,
      value: insights.counts.activePrescriptions,
      href: "/prescriptions",
      hint: undefined,
    },
    {
      key: "outstandingInvoices" as const,
      icon: Receipt,
      value: insights.counts.outstandingInvoices,
      href: "/invoices",
      // The count is currency-agnostic and stays whole. The amount beside
      // it is only what is owed in the clinic's own currency — adding
      // dollars to lira and printing one symbol was the defect — so when
      // there is debt in others, the hint says they exist. Not how much:
      // the size lives under the revenue chart, and this card has room for
      // the fact. Naming a screen to go and read it would be worse, since
      // `/invoices` has no total to read (TEAM.md #33).
      hint:
        formatMoney(fmt, insights.outstandingInvoiceCents, currency) +
        (insights.outstandingOtherCurrencies.length > 0
          ? ` · ${t("chart.otherCurrencyCount", {
              count: insights.outstandingOtherCurrencies.length,
            })}`
          : ""),
    },
    {
      key: "openReminders" as const,
      icon: ClipboardList,
      value: insights.counts.openReminders,
      href: "/reminders",
      hint: undefined,
    },
  ];

  const visitsLast12WeeksData = insights.visitsLast12Weeks.map((w) => ({
    label: weekFmt.format(w.weekStart),
    value: w.count,
  }));

  // Read once: the empty sentence and the footnote have to agree about
  // whether there is money elsewhere, and two reads of the same thing is
  // how they stop agreeing.
  const revenueOtherCurrencies = insights.revenueOtherCurrencies;

  const revenueLast6MonthsData = insights.revenueLast6Months.map((m) => ({
    label: monthFmt.format(m.monthStart),
    value: m.cents,
    display: formatMoney(fmt, m.cents, currency),
  }));

  const speciesBars = insights.petsBySpecies.map((g) => ({
    label: tSpecies(g.species as never),
    value: g.count,
  }));

  const visitTypeBars = insights.visitsByType.map((g) => ({
    label: tVisitType(g.type as never),
    value: g.count,
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("greeting", { name: firstName(session.user.name ?? "") })}
        description={t("subtitle")}
      />

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {metrics.map(({ key, icon: Icon, value, href, hint }) => (
          <Link
            key={key}
            href={href}
            className={cn(surface, "p-4 transition-colors hover:border-primary/30")}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(`metrics.${key}` as never)}
              </span>
              <Icon className="size-4 text-muted-foreground" />
            </div>
            {/* `tabular-nums` here and not on each card: six cards sit in
                one grid and their figures are read across as much as down.
                Proportional digits give "1" a narrower column than "8", so
                the six numbers start at six slightly different places. */}
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {value}
            </p>
            {hint && (
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                {hint}
              </p>
            )}
          </Link>
        ))}
      </div>

      {/* `[&>*]:min-w-0`, the same fix as the four detail pages in
          `462af2e` and found the same way — by measuring, not by
          reading. A grid item's `min-width` is `auto`, so it refuses
          to be narrower than its own min-content, and the card grew
          to 450px inside a 294px column: pm measured 140px of
          sideways page scroll at 390px.

          Only when the chart has bars to draw. On an empty clinic
          the card says "no visits yet" and everything fits, so a
          sweep signing up a fresh clinic reports this route clean —
          which is exactly what pm's did, on the same build, minutes
          apart from the run that found it. */}
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>{t("sections.visitsLast12Weeks")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ColumnBars
              data={visitsLast12WeeksData}
              emptyLabel={t("empty.visits")}
              partialLast={{
                note: t("chart.partialPeriod"),
                inProgress: t("chart.inProgress"),
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sections.revenueLast6Months")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ColumnBars
              data={revenueLast6MonthsData}
              // Two different pieces of news, and they were one: "nothing
              // was paid" and "nothing was paid in lira". The second is
              // what a clinic with four paid dollar invoices was being
              // told, and it sends a vet after money that is already
              // collected. Lists learned this distinction two releases
              // ago (`empty` against `emptyFiltered`); the chart had one
              // empty sentence and a filter nobody had told it about
              // (TEAM.md #19).
              emptyLabel={
                revenueOtherCurrencies.length > 0
                  ? t("empty.revenueCurrency", {
                      // The symbol, not the ISO code. ux measured the card
                      // saying "no invoices paid in TRY" directly above
                      // "$11,595.67" — two ways of naming money in one
                      // card, and the rest of the panel uses symbols.
                      // Turkish does not call it TRY either; a vet says
                      // TL. Read from the same formatter the amounts use,
                      // so the next currency arrives in one place.
                      currency: currencySymbol(fmt, currency),
                    })
                  : t("empty.revenue")
              }
              formatValue={(v) => formatMoney(fmt, v, currency)}
              partialLast={{
                note: t("chart.partialPeriod"),
                inProgress: t("chart.inProgress"),
              }}
              // What the chart cannot show, said in the chart's own card
              // and in its accessible name. The bars are only the clinic's
              // own currency, because adding dollars to lira and printing
              // one symbol is a number that exists nowhere; the rest is
              // reported at its real size, per currency, because "4
              // invoices elsewhere" does not say whether the chart is
              // missing pocket change or the entire total. In the case
              // that found this, it was the entire total.
              footnote={
                revenueOtherCurrencies.length > 0
                  ? revenueOtherCurrencies
                      .map((m) =>
                        t("chart.otherCurrency", {
                          amount: formatMoney(fmt, m.cents, m.currency),
                          count: m.invoices,
                        }),
                      )
                      .join(" · ")
                  : undefined
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sections.upcomingAppointments")}</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.upcomingAppointments.length === 0 ? (
              <EmptyState size="inline" title={t("empty.appointments")} />
            ) : (
              <ul className="flex flex-col gap-1">
                {insights.upcomingAppointments.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/appointments/${a.id}`}
                      className="flex items-center justify-between gap-3 rounded-control px-2 py-2 hover:bg-muted"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">
                          {a.pet.name} · {a.client.firstName} {a.client.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(fmt, a.startsAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sections.recentVisits")}</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.recentVisits.length === 0 ? (
              <EmptyState size="inline" title={t("empty.visits")} />
            ) : (
              <ul className="flex flex-col gap-1">
                {insights.recentVisits.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/visits/${v.id}`}
                      className="flex items-center justify-between gap-3 rounded-control px-2 py-2 hover:bg-muted"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">
                          {v.pet.name} · {v.client.firstName} {v.client.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(fmt, v.visitedAt)} · {tVisitType(v.type)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sections.petsBySpecies")}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Counts animals, not visits: `modules/dashboard/queries.ts`
                groups by pet. It said "no visits yet" to a clinic with a
                hundred animals and no visits on the books. */}
            <HorizontalBars data={speciesBars} emptyLabel={t("empty.pets")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sections.visitsByType")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars data={visitTypeBars} emptyLabel={t("empty.visits")} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("sections.upcomingVaccinations")}</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.upcomingVaccinations.length === 0 ? (
              <EmptyState size="inline" title={t("empty.vaccinations")} />
            ) : (
              <ul className="flex flex-col gap-1">
                {insights.upcomingVaccinations.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between rounded-control px-2 py-2"
                  >
                    {/* Not `v.pet?.name ?? "?"`. `Vaccination.petId` is
                        non-null in the schema and the query includes the
                        relation, so the guard defended a case that cannot
                        happen — and printed a made-up "?" for it, which is
                        the thing TEAM.md #21 is about. ux read the `?.` as
                        evidence the field was nullable; defensive code had
                        become the documentation. */}
                    <span className="text-sm font-medium">
                      {v.pet.name} · {v.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(fmt, v.nextDueAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
