import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getAppointmentById } from "@/modules/appointments/queries";
import { listPets } from "@/modules/pets/queries";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { AppointmentForm } from "@/components/forms/appointment-form";

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const [appointment, pets, vets, t, tCommon] = await Promise.all([
    getAppointmentById(session.user.clinicId, id),
    listPets({ clinicId: session.user.clinicId }),
    prisma.user.findMany({
      where: { clinicId: session.user.clinicId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getTranslations("appointment"),
    getTranslations("common"),
  ]);
  if (!appointment) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href={`/appointments/${appointment.id}`} label={tCommon("back")} />
      <PageHeader title={t("edit")} />
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <AppointmentForm
          appointment={appointment}
          pets={pets.map((p) => ({ id: p.id, name: p.name }))}
          vets={vets}
        />
      </div>
    </div>
  );
}
