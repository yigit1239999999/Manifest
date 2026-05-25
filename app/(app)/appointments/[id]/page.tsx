import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit3 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getAppointmentById } from "@/modules/appointments/queries";
import { cancelAppointmentAction } from "@/modules/appointments/actions";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { DeleteButton } from "@/components/delete-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export default async function AppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const [appointment, t, tCommon, tType, tStatus] = await Promise.all([
    getAppointmentById(session.user.clinicId, id),
    getTranslations("appointment"),
    getTranslations("common"),
    getTranslations("enum.visitType"),
    getTranslations("enum.appointmentStatus"),
  ]);
  if (!appointment) notFound();

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/appointments" label={tCommon("back")} />
      <PageHeader
        title={`${appointment.pet.name} · ${appointment.client.firstName} ${appointment.client.lastName}`}
        description={formatDateTime(appointment.startsAt)}
      >
        <Badge variant="secondary">{tType(appointment.type as never)}</Badge>
        <Badge variant="secondary">
          {tStatus(appointment.status as never)}
        </Badge>
        <Link
          href={`/appointments/${appointment.id}/edit`}
          className={buttonVariants({ variant: "secondary" })}
        >
          <Edit3 />
          {tCommon("edit")}
        </Link>
        {appointment.status !== "CANCELLED" && (
          <DeleteButton
            action={cancelAppointmentAction.bind(null, appointment.id)}
            label={t("cancel")}
            confirmText={t("cancel") + "?"}
          />
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>{tCommon("details")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label={t("startsAt")} value={formatDateTime(appointment.startsAt)} />
          <Row
            label={t("durationMinutes")}
            value={`${appointment.durationMinutes} min`}
          />
          <Row label={t("reason")} value={appointment.reason ?? "—"} />
          <Row label="Vet" value={appointment.vet?.name ?? "—"} />
          {appointment.notes && (
            <div className="sm:col-span-2 mt-2 rounded-lg bg-muted/40 p-3 text-sm">
              {appointment.notes}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
