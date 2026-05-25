import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listAppointments } from "@/modules/appointments/queries";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export default async function AppointmentsPage() {
  const session = await requireSession();
  const [t, tType, tStatus, appointments] = await Promise.all([
    getTranslations("appointment"),
    getTranslations("enum.visitType"),
    getTranslations("enum.appointmentStatus"),
    listAppointments({
      clinicId: session.user.clinicId,
      // eslint-disable-next-line react-hooks/purity -- server component, evaluated once per request
      from: new Date(Date.now() - 30 * 86400 * 1000),
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Link href="/appointments/new" className={buttonVariants()}>
          <Plus />
          {t("new")}
        </Link>
      </PageHeader>

      {appointments.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t("empty")} description="" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("startsAt")}</th>
                <th className="px-4 py-3 font-medium">Pet · Client</th>
                <th className="px-4 py-3 font-medium">{t("type")}</th>
                <th className="px-4 py-3 font-medium">{t("status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {appointments.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/appointments/${a.id}`}
                      className="hover:underline"
                    >
                      {formatDateTime(a.startsAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {a.pet.name} · {a.client.firstName} {a.client.lastName}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {tType(a.type as never)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {tStatus(a.status as never)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
