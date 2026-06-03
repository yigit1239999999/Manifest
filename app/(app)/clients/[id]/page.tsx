import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit3, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getClientById } from "@/modules/clients/queries";
import { clientTimeline } from "@/modules/timeline/queries";
import { archiveClientAction } from "@/modules/clients/actions";
import { getClinicCurrency } from "@/modules/clinics/queries";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { DeleteButton } from "@/components/delete-button";
import { PetCard } from "@/components/pet-card";
import { Timeline } from "@/components/timeline";
import { NoteForm } from "@/components/forms/note-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [client, t, tCommon, tNav, tTimeline, timeline, currency] =
    await Promise.all([
      getClientById(session.user.clinicId, id),
      getTranslations("client"),
      getTranslations("common"),
      getTranslations("nav"),
      getTranslations("timeline"),
      clientTimeline(session.user.clinicId, id),
      getClinicCurrency(session.user.clinicId),
    ]);

  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/clients" label={tCommon("back")} />

      <PageHeader
        title={`${client.firstName} ${client.lastName}`}
        description={client.email ?? client.phone ?? ""}
      >
        <Link
          href={`/clients/${client.id}/edit`}
          className={buttonVariants({ variant: "secondary" })}
        >
          <Edit3 />
          {tCommon("edit")}
        </Link>
        <DeleteButton
          action={archiveClientAction.bind(null, client.id)}
          label={tCommon("archive")}
          confirmText={t("archiveConfirm")}
        />
      </PageHeader>

      {client.archivedAt && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          {t("archivedTitle")}: {formatDate(client.archivedAt)}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t("details")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Detail label={t("email")} value={client.email} />
            <Detail label={t("phone")} value={client.phone} />
            <Detail label={t("secondaryPhone")} value={client.secondaryPhone} />
            <Detail label={t("address")} value={client.address} />
            <Detail label={t("city")} value={client.city} />
            <Detail label={t("postalCode")} value={client.postalCode} />
            <Detail label={t("country")} value={client.country} />
            {client.notes && (
              <div className="mt-2 rounded-lg bg-muted/40 p-3 text-sm">
                {client.notes}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{tNav("pets")}</CardTitle>
              <Link
                href={`/pets/new?ownerId=${client.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Plus className="size-4" /> {tCommon("add")}
              </Link>
            </CardHeader>
            <CardContent>
              {client.pets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("petsCount", { count: 0 })}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {client.pets.map((p) => (
                    <PetCard key={p.id} pet={p} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tCommon("details")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
              <Detail
                label={tCommon("createdAt")}
                value={formatDate(client.createdAt)}
              />
              <Detail
                label={tCommon("updatedAt")}
                value={formatDate(client.updatedAt)}
              />
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {tNav("visits")}
                </span>
                <Badge variant="secondary" className="w-fit">
                  {client._count.visits}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{(await getTranslations("note"))("new")}</CardTitle>
        </CardHeader>
        <CardContent>
          <NoteForm clientId={client.id} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          {tTimeline("title")}
        </h2>
        <Timeline events={timeline} currency={currency} />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}
