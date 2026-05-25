import Link from "next/link";
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
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dashboardInsights } from "@/modules/dashboard/queries";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { firstName, formatDateTime, formatMoney } from "@/lib/format";

export default async function DashboardPage() {
  const session = await requireSession();
  const [t, tSpecies, tVisitType, insights, clinic] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("enum.species"),
    getTranslations("enum.visitType"),
    dashboardInsights(session.user.clinicId),
    prisma.clinic.findUnique({
      where: { id: session.user.clinicId },
      select: { currency: true },
    }),
  ]);
  const currency = clinic?.currency ?? "USD";

  const metrics = [
    { key: "clients" as const, icon: Users, value: insights.counts.clients, href: "/clients", hint: undefined as string | undefined },
    { key: "pets" as const, icon: PawPrint, value: insights.counts.pets, href: "/pets", hint: undefined },
    { key: "visits" as const, icon: Stethoscope, value: insights.counts.visits, href: "/visits", hint: undefined },
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
      hint: formatMoney(insights.outstandingInvoiceCents, currency),
    },
    {
      key: "pendingReminders" as const,
      icon: ClipboardList,
      value: insights.counts.pendingReminders,
      href: "/reminders",
      hint: undefined,
    },
  ];

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
            className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(`metrics.${key}` as never)}
              </span>
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
            {hint && (
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            )}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("sections.upcomingAppointments")}</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.upcomingAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("empty.appointments")}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {insights.upcomingAppointments.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/appointments/${a.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-muted"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">
                          {a.pet.name} · {a.client.firstName} {a.client.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(a.startsAt)}
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
              <p className="text-sm text-muted-foreground">{t("empty.visits")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {insights.recentVisits.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/visits/${v.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-muted"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">
                          {v.pet.name} · {v.client.firstName} {v.client.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(v.visitedAt)} · {tVisitType(v.type)}
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
            <CardTitle>{t("sections.upcomingVaccinations")}</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.upcomingVaccinations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("empty.vaccinations")}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {insights.upcomingVaccinations.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between rounded-xl px-2 py-2"
                  >
                    <span className="text-sm font-medium">
                      {v.pet?.name ?? "?"} — {v.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {v.nextDueAt ? formatDateTime(v.nextDueAt) : "—"}
                    </span>
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
            <ul className="flex flex-col gap-1">
              {insights.petsBySpecies.map((g) => (
                <li
                  key={g.species}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm">{tSpecies(g.species as never)}</span>
                  <Badge variant="secondary">{g.count}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
