import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getVisitById } from "@/modules/visits/queries";
import { listPets } from "@/modules/pets/queries";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { VisitForm } from "@/components/forms/visit-form";

export default async function EditVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const [visit, pets, vets, t, tCommon] = await Promise.all([
    getVisitById(session.user.clinicId, id),
    listPets({ clinicId: session.user.clinicId }),
    prisma.user.findMany({
      where: { clinicId: session.user.clinicId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getTranslations("visit"),
    getTranslations("common"),
  ]);
  if (!visit) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <BackLink href={`/visits/${visit.id}`} label={tCommon("back")} />
      <PageHeader title={t("edit")} />
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <VisitForm
          visit={visit}
          pets={pets.map((p) => ({ id: p.id, name: p.name }))}
          vets={vets}
        />
      </div>
    </div>
  );
}
