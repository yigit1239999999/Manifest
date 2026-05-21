import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { initials } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { SearchForm } from "@/components/search-form";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const owners = await prisma.owner.findMany({
    where: {
      clinicId: session.user.clinicId,
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: { _count: { select: { pets: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description="Pet owners registered with your clinic."
      >
        <Link href="/clients/new" className={buttonVariants()}>
          <Plus />
          New client
        </Link>
      </PageHeader>

      <SearchForm
        action="/clients"
        placeholder="Search by name, email, phone…"
        defaultValue={query}
      />

      {owners.length === 0 ? (
        query ? (
          <EmptyState
            icon={Users}
            title="No matching clients"
            description={`Nothing matches “${query}”. Try a different search.`}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Add your first pet owner to start building your clinic's records."
            action={
              <Link href="/clients/new" className={buttonVariants()}>
                <Plus />
                New client
              </Link>
            }
          />
        )
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {owners.map((owner) => (
            <Link
              key={owner.id}
              href={`/clients/${owner.id}`}
              className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/60"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {initials(`${owner.firstName} ${owner.lastName}`)}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {owner.firstName} {owner.lastName}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {owner.email || owner.phone || "No contact details"}
                </span>
              </div>
              <Badge variant="primary" className="ml-auto shrink-0">
                {owner._count.pets} {owner._count.pets === 1 ? "pet" : "pets"}
              </Badge>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
