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
// Never disabled, for anyone who cannot create the missing thing -- a
// technician has neither `clients.write` nor `pets.write`, and telling
// them to do something the server will refuse is worse than the empty
// dashboard they can already read. They get a sentence without a button
// instead of nothing at all; see `WAITING` below.
// Everything about a step in one row, and this is load-bearing rather
// than tidiness: ux is still deciding what this card should say and
// where it should send somebody, after the vet said the thing they sit
// down to do on a first evening is a visit, not data entry -- "ben veri
// girmek için oturmuyorum, iş yapıyorum". So the sentence, the route,
// the button's wording and the permission behind it are one row each.
// Whatever comes back is an edit here and a string in `messages/*.json`,
// not a hunt through the file, and no branch of this component can
// disagree with another about which of the four is being talked about.
//
// A third row is not a free addition. The card has exactly the two
// states of the mandatory chain, and the moment it can name a third
// thing it becomes a setup checklist -- which is the shape the vet said
// they would abandon in three days.
const STEPS = {
  // The first ask for a clinic with nothing at all, and it is not a
  // third step but a different first one: only ever one row renders.
  // The vet said what they sit down to do on a first evening -- "ben
  // veri girmek için oturmuyorum, iş yapıyorum" -- and the chain now
  // makes the other two records on the way there, so asking for the
  // work no longer costs the data.
  //
  // The sentence promises exactly that ("you can add them along the
  // way"), which is why it could not exist until `?next=` did: before
  // it, `/visits/new` sent a vet to the animal form and left them
  // there with no way back. Verified end to end -- `visits/new` offers
  // the animal, that offers the owner, `withCreated` returns with the
  // new animal already selected, and `/visits/new` is in
  // `ALLOWED_PATHS`.
  visit: {
    href: "/visits/new",
    namespace: "visit",
    permission: "visits.write",
  },
  client: {
    href: "/clients/new",
    namespace: "client",
    permission: "clients.write",
  },
  pet: {
    href: "/pets/new",
    namespace: "pet",
    permission: "pets.write",
  },
} as const;

// What the card says to somebody who cannot reach any of the three.
//
// It is deliberately not a fourth row of `STEPS`, and the difference is
// not filing. A row of that table is something to go and do, and the
// warning above -- that a third row turns this into a setup checklist --
// is about exactly that. This is the opposite: it has no route, no
// button and no permission, so it cannot become an item on a list. It is
// also not something a caller may ask for. `need` names the link of the
// chain that is missing, which is a fact about the clinic; whether the
// reader can act on it is a fact about the reader, and this component
// works that out itself.
//
// A technician holds `vaccinations.write`, `treatments.write`,
// `diagnostics.write`, `notes.write` and `reminders.write` -- every one
// of them writes onto an animal, and on the first morning there is no
// animal. So there is genuinely nothing for them to do yet, and the
// sentence says that by naming what their work attaches to rather than
// by refusing them or apologising.
const WAITING = "waiting";

export async function FirstStepCard({ need }: { need: keyof typeof STEPS }) {
  const session = await requireSession();

  // One fall-back, and only from the visit ask: somebody who cannot
  // write a visit may still be able to make a client, which is a
  // smaller but real first step. When even that is out of reach the
  // card drops its button rather than offering a disabled one --
  // telling a technician to do what the server will refuse is worse
  // than saying nothing about it.
  const resolved =
    need === "visit" && !can(session.user.role, STEPS.visit.permission)
      ? "client"
      : need;
  const step = STEPS[resolved];
  const reachable = can(session.user.role, step.permission);

  const [t, tAction] = await Promise.all([
    getTranslations("dashboard.firstStep"),
    getTranslations(step.namespace),
  ]);

  const namespace = reachable ? resolved : WAITING;
  const label = reachable ? tAction("new") : null;

  return (
    <Card className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Two lines and not one paragraph, and the reason is weight
          rather than length (ux). The first says what to do; the second
          says what will happen on the way. Run together they are read at
          the same weight, and a vet is made to take in two sentences of
          instruction before doing anything. Split, the first is an
          invitation and the second is a reassurance -- which is the pair
          `EmptyState` already draws with `title`/`description` and
          `Field` with its hint. Not a new shape; that shape applied
          here.

          `min-w-0` so the longer of the two catalogues wraps inside the
          card instead of pushing the button off a 390px screen. */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm text-foreground">{t(`${namespace}.title`)}</p>
        <p className="text-sm text-muted-foreground">{t(`${namespace}.hint`)}</p>
      </div>
      {label !== null && (
        <Link href={step.href} className={cn(buttonVariants(), "shrink-0")}>
          {label}
        </Link>
      )}
    </Card>
  );
}
