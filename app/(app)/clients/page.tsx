import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listClientsPage } from "@/modules/clients/queries";
import { PageHeader } from "@/components/page-header";
import { SearchForm } from "@/components/search-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/pagination";
import { FilterTabs } from "@/components/filter-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { buttonVariants } from "@/components/ui/button";
import { ownerLabel } from "@/lib/pet-label";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; archived?: string }>;
}) {
  const session = await requireSession();

  // A button the server will refuse is worse than no button: the click
  // looks like it did nothing. The permission is the same one the service
  // enforces, read from one place (`lib/permissions.ts`).
  const canCreate = can(session.user.role, "clients.write");
  const { q, page: pageParam, archived } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const includeArchived = archived === "1";
  const [t, tCommon, result] = await Promise.all([
    getTranslations("client"),
    getTranslations("common"),
    listClientsPage({
      clinicId: session.user.clinicId,
      search: q ?? null,
      includeArchived,
      page,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        {canCreate && (
          <Link href="/clients/new" className={buttonVariants()}>
            <Plus />
            {t("new")}
          </Link>
        )}
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchForm
          action="/clients"
          placeholder={t("search")}
          defaultValue={q}
        />
        {/* An archived client is not gone, so the way back to it is a filter
            on the list it left, not a second screen. */}
        <FilterTabs
          basePath="/clients"
          param="archived"
          label={tCommon("archiveFilter")}
          active={includeArchived ? "1" : undefined}
          allLabel={tCommon("activeOnly")}
          options={[{ value: "1", label: tCommon("withArchived") }]}
          params={{ q }}
        />
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? t("emptySearch") : t("empty")}
          description={q ? t("emptySearchHint") : t("emptyHint")}
          // The root of the chain, and the only button on a new
          // clinic's seven list screens that leads to a form which can
          // actually be filled in: everything else wants a client or an
          // animal that does not exist yet.
          //
          // Yes, this is the second "New client" on the screen, and it
          // stays. The rule, which is the one the other six screens were
          // just fixed against (ux):
          //
          //   A screen may offer more than one way forward. They must
          //   all go to the same place.
          //
          // The defect on /pets was never that there were two buttons.
          // It was that the header's went to /pets/new while the body
          // said an owner had to exist first -- two buttons, two
          // destinations, one of them a dead end. Here both go to
          // /clients/new, and they are not the same thing said twice:
          // the header is the standing capability, in the place it will
          // still be once the list fills; this one is the answer in the
          // reading path, directly under "there is nothing here".
          //
          // The other half of the rule, for whoever arrives next: when a
          // screen's own action is impossible, the header's button goes
          // too. An empty state cannot say "not yet" while the header
          // says "go ahead".
          //
          // Not under a search: "no client named Y" is answered by
          // trying another name, and a create button there invites
          // registering a client who is already on the books under a
          // different spelling.
          action={
            !q && canCreate ? (
              <Link href="/clients/new" className={buttonVariants()}>
                <Plus />
                {t("new")}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <DataTable
            rows={result.items}
            rowKey={(c) => c.id}
            caption={t("title")}
            columns={[
              {
                key: "name",
                header: t("firstName"),
                cellClassName: "font-medium text-foreground",
                cell: (c) => (
                  <>
                    <Link href={`/clients/${c.id}`} className="hover:underline">
                      {ownerLabel(c)}
                    </Link>
                    {/* The animals, where a count used to be.
                        A vet rang eleven people called Ayşe looking for
                        the one whose cat they had seen, and said the
                        quiet part: "I was never scanning for a name, I
                        was scanning for whose cat it was." A `[2]` badge
                        answers neither question -- and most of those
                        eleven rows said `[2]`.
                        The names carry the count as well: up to two by
                        being readable, beyond that as `+N`. So the badge
                        is gone, and NOT because it was pointless -- it
                        is gone because something better arrived, which
                        is the answer to "why is there no number here".
                        Deceased animals are included on purpose: the
                        person on the phone may be asking about the one
                        that died, and this row is for recognising them.
                        Same filter as the count, so the two names and
                        the `+N` can never come from different sets. */}
                    <span className="ms-2 text-muted-foreground">
                      {c.pets.length === 0
                        ? // Said, not left blank. Scanning eleven people
                          // called Ayşe for the one with a cat, "no
                          // animals" rules a row OUT, which is half of
                          // what the scan is for -- and an empty space
                          // reads as "not loaded" rather than "none".
                          // The `=0` branch of the count key, which the
                          // client page still uses, so nothing is
                          // orphaned by the badge leaving.
                          t("petsCount", { count: 0 })
                        : c.pets.map((p) => p.name).join(", ")}
                      {c._count.pets > c.pets.length &&
                        ` +${c._count.pets - c.pets.length}`}
                    </span>
                    {c.archivedAt && (
                      <StatusBadge
                        kind="archive"
                        status="archived"
                        label={tCommon("archived")}
                        className="ms-2"
                      />
                    )}
                  </>
                ),
              },
              {
                key: "email",
                header: t("email"),
                cellClassName: "text-muted-foreground",
                cell: (c) => c.email ?? "-",
              },
              {
                key: "phone",
                header: t("phone"),
                cellClassName: "text-muted-foreground",
                cell: (c) => c.phone ?? "-",
              },
            ]}
          />
          <Pagination
            basePath="/clients"
            total={result.total}
            page={result.page}
            perPage={result.perPage}
            params={{ q, archived }}
          />
        </>
      )}
    </div>
  );
}
