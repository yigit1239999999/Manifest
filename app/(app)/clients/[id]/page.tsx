import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit3, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getClientById } from "@/modules/clients/queries";
import { clientTimeline } from "@/modules/timeline/queries";
import {
  archiveClientAction,
  restoreClientAction,
} from "@/modules/clients/actions";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { DeleteButton } from "@/components/delete-button";
import { RestoreButton } from "@/components/restore-button";
import { PetCard } from "@/components/pet-card";
import { Timeline } from "@/components/timeline";
import { NoteForm } from "@/components/forms/note-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DescriptionList } from "@/components/ui/description-list";
import { Callout } from "@/components/ui/callout";
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
  const fmt = await getFormatContext();
  const { id } = await params;
  const session = await requireSession();

  const [client, t, tCommon, tNav, tTimeline, timeline] =
    await Promise.all([
      getClientById(session.user.clinicId, id),
      getTranslations("client"),
      getTranslations("common"),
      getTranslations("nav"),
      getTranslations("timeline"),
      clientTimeline(session.user.clinicId, id),
    ]);

  if (!client) notFound();

  // The service refuses either way; hiding the button keeps the refusal
  // from arriving as a click that silently does nothing (lib/permissions.ts).
  // The service refuses either way; hiding the action keeps the refusal
  // from arriving as a click that silently does nothing.
  const canEdit = can(session.user.role, "clients.write");
  const canArchive = can(session.user.role, "clients.archive");
  // "Add" in the pets card creates an animal, so it asks what the pet
  // service asks, not what this page's own actions ask. Editing a client
  // and adding one of their animals are different permissions and a role
  // can hold either without the other.
  const canAddPet = can(session.user.role, "pets.write");

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/clients" label={tCommon("back")} />

      <PageHeader
        title={`${client.firstName} ${client.lastName}`}
        description={client.email ?? client.phone ?? ""}
      >
        {canEdit && (
          <Link
            href={`/clients/${client.id}/edit`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <Edit3 />
            {tCommon("edit")}
          </Link>
        )}
        {/* The archive button goes away while the record is archived: the
            action that undoes it lives in the notice below, where the state
            it undoes is stated. */}
        {canArchive && !client.archivedAt && (
          <DeleteButton
            // Archived, not deleted: reversible, so it is neither red nor
            // marked with a bin (TEAM.md #25). The notice this puts on the
            // page carries the way back.
            action={archiveClientAction.bind(null, client.id)}
            label={tCommon("archive")}
            tone="default"
            mark="archive"
            confirmText={t("archiveConfirm")}
            description={tCommon("archiveUndoHint")}
          />
        )}
      </PageHeader>

      {client.archivedAt && (
        <Callout variant="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {tCommon("archivedOn", {
                date: formatDate(fmt, client.archivedAt),
              })}
            </span>
            {canArchive && (
              <RestoreButton
                action={restoreClientAction.bind(null, client.id)}
                label={tCommon("restore")}
              />
            )}
          </div>
        </Callout>
      )}

      {/* See `/invoices/[id]`: a grid item will not shrink below its own
          content, and these four pages share this line. */}
      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t("details")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <DescriptionList
              items={[
                { label: t("email"), value: client.email },
                { label: t("phone"), value: client.phone },
                { label: t("secondaryPhone"), value: client.secondaryPhone },
                { label: t("address"), value: client.address },
                { label: t("city"), value: client.city },
                { label: t("postalCode"), value: client.postalCode },
                { label: t("country"), value: client.country },
              ]}
            />
            {client.notes && (
              <div className="mt-2 rounded-control bg-muted/40 p-3 text-sm">
                {client.notes}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{tNav("pets")}</CardTitle>
              {canAddPet && (
                <Link
                  href={`/pets/new?ownerId=${client.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <Plus className="size-4" /> {tCommon("add")}
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {client.pets.length === 0 ? (
                <EmptyState
                  size="inline"
                  title={t("petsCount", { count: 0 })}
                />
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
            <CardContent>
              {/* The visit count used to be a fourth copy of the pair,
                  written inline because its value is a badge rather than
                  text — and it had drifted to `gap-1`. A value is a node. */}
              <DescriptionList
                className="grid gap-2 sm:grid-cols-3"
                items={[
                  {
                    label: tCommon("createdAt"),
                    value: formatDate(fmt, client.createdAt),
                  },
                  {
                    label: tCommon("updatedAt"),
                    value: formatDate(fmt, client.updatedAt),
                  },
                  {
                    label: tNav("visits"),
                    value: <Badge className="w-fit">{client._count.visits}</Badge>,
                  },
                ]}
              />
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
        <Timeline events={timeline} />
      </div>
    </div>
  );
}
