import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

// The one sentence a clinic with nothing in it needs on its first
// morning, at the top of the dashboard.
//
// It says exactly one thing: the link of the mandatory chain that is
// missing right now. There are two links, client then animal, and
// everything else the product records hangs off one of them; the second
// disappears the moment it is filled and then this card is gone for
// good. That bound is the whole design and not an implementation
// detail -- a third state, "now switch on reminders" or "now add your
// staff", turns a single prompt into a setup wizard, and the thing a
// vet's first four hours actually produced was one real animal on the
// books, not a completed checklist (vet's field measurement).
//
// `MissingLink` (components/missing-link.tsx) says the same two facts
// where a reader has already walked into the dead end and is looking at
// a whole empty screen. This one is read on the way past, above six
// metric cards, so it is a line and a button rather than a dashed frame
// and a 56px icon: given that shape it would outweigh the page it
// introduces.
//
// Absent, not disabled, for anyone who cannot create the missing thing
// -- a technician has neither `clients.write` nor `pets.write`, and
// telling them to do something the server will refuse is worse than the
// empty dashboard they can already read.
export async function FirstStepCard({ need }: { need: "client" | "pet" }) {
  const session = await requireSession();
  if (!can(session.user.role, need === "client" ? "clients.write" : "pets.write")) {
    return null;
  }

  const [t, tClient, tPet] = await Promise.all([
    getTranslations("dashboard.firstStep"),
    getTranslations("client"),
    getTranslations("pet"),
  ]);

  const href = need === "client" ? "/clients/new" : "/pets/new";
  const label = need === "client" ? tClient("new") : tPet("new");

  return (
    <Card className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      {/* `min-w-0` so the longer of the two catalogues wraps inside the
          card instead of pushing the button off a 390px screen. */}
      <p className="min-w-0 text-sm text-foreground">{t(need)}</p>
      <Link href={href} className={cn(buttonVariants(), "shrink-0")}>
        {label}
      </Link>
    </Card>
  );
}
