import Link from "next/link";
import { formatPhone } from "@/lib/phone";
import { PhoneLink } from "@/components/phone-link";
import { ClientMerge } from "@/components/client-merge";
import { notFound } from "next/navigation";
import { Edit3, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getClientById } from "@/modules/clients/queries";
import { clientBalance } from "@/modules/invoices/queries";
import { OwnerBalance } from "@/components/invoices/owner-balance";
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
import { ownerLabel } from "@/lib/pet-label";

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ merged?: string }>;
}) {
  const fmt = await getFormatContext();
  const { id } = await params;
  const { merged } = await searchParams;
  const session = await requireSession();

  const [client, t, tCommon, tNav, tTimeline, timeline, balance] =
    await Promise.all([
      getClientById(session.user.clinicId, id),
      getTranslations("client"),
      getTranslations("common"),
      getTranslations("nav"),
      getTranslations("timeline"),
      clientTimeline(session.user.clinicId, id),
      clientBalance(session.user.clinicId, id),
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
        title={ownerLabel(client)}
        description={client.email ?? formatPhone(client.phone)}
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
        {/* Last and quiet: a rare, administrative act, not the page's
            work. The duplicate it is for is found by the warning on the
            client form; this is where two records already made become
            one (pm B6). */}
        {can(session.user.role, "clients.merge") && !client.archivedAt && (
          <ClientMerge sourceId={client.id} />
        )}
      </PageHeader>

      {merged && (
        <Callout variant="info" live>
          {t("merge.done")}
        </Callout>
      )}
      {/* What this owner still owes, and the way to those invoices (vet's
          job #7: "sahibin borcu" had no answer on this page). */}
      <OwnerBalance clientId={client.id} balance={balance} fmt={fmt} />

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
                {
                  label: t("phone"),
                  value: client.phone ? <PhoneLink phone={client.phone} /> : null,
                },
                {
                  label: t("secondaryPhone"),
                  value: client.secondaryPhone ? (
                    <PhoneLink phone={client.secondaryPhone} />
                  ) : null,
                },
                { label: t("address"), value: client.address },
                { label: t("city"), value: client.city },
                { label: t("postalCode"), value: client.postalCode },
                { label: t("country"), value: client.country },
                {
                  // Here rather than in a card of its own, because
                  // consent is a condition of contact: the answer to
                  // "may we message them" belongs beside the numbers
                  // we would message. ux's call.
                  label: t("consent.label"),
                  // Named, never a tick or a dash. A dash would put
                  // "not asked" back where it was before v0.9.0 — an
                  // absence indistinguishable from a no — and the
                  // whole of that release was separating those two.
                  // So the third state is a string like the other two.
                  //
                  // The reason used to be written here as
                  // "`DescriptionList` prints nothing for a null value",
                  // and that is not what it does: it prints "-" and
                  // KEEPS the row (`description-list.tsx`, `EMPTY`), so
                  // an empty field says nobody filled it. The decision
                  // was right and the reason was wrong, which is worse
                  // than no reason -- the next reader takes it for a
                  // fact about the component, and the fact it states is
                  // the opposite of the one the animal page now relies
                  // on to show a missing number.
                  // A fact, in the words a vet would use, and nothing
                  // about our plumbing. The three read flat on purpose:
                  // "not asked yet" is work still on the list, not a
                  // reproach, and the same tone rules the count of
                  // unasked clients when that lands (ux, value).
                  value: t(
                    client.notificationsOptIn === true
                      ? "consent.granted"
                      : client.notificationsOptIn === false
                        ? "consent.declined"
                        : "consent.unanswered",
                  ),
                },
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
