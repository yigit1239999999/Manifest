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
  // The sentence used to promise a WALK -- "you will add the owner and
  // the animal first, and what you have typed comes with you" -- and
  // that was true and still cost the thing the vet complained about:
  // the address changed twice while an examination sat half typed.
  // There is no walk now. The animal box opens the animal inside the
  // visit form and the owner box opens the owner inside that, one save
  // writes all three, and the sentence says the shape rather than the
  // itinerary: the animal and its owner go on the same form.
  //
  // It could not have said this before the block existed, and it must
  // not say it again if the block ever goes: this card is the product
  // making a promise, and `e2e/first-run.spec.ts` is where the promise
  // is kept or broken.
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
// animal. So there is genuinely nothing for them to do yet.
//
// This contradicts an earlier decision here -- that a row with nothing
// to do is noise, so draw nothing -- and the boundary is worth writing
// down, because it is the second time the argument has been had (ux):
//
//   "A line with no action is noise" is a rule about screens that have
//   OTHER CONTENT. On the first-run screen this card is the only
//   content, and silence there reads as a product that is broken.
//
// The two lines divide the work the same way the other three do, and
// each carries a rule that the other one broke on its own:
//
//   title -- states what the reader's work waits on, and states it
//   POSITIVELY. This screen may not open with a negation; "there is
//   nothing here" is the whole of what an empty product already says,
//   and saying it in words as well is the apology the first-run screen
//   exists to avoid.
//
//   hint -- names WHO can act. Without it the reader is correctly
//   informed and still stuck, which is the omission TEAM.md #21 is
//   about. It says the clinic administrator in the words
//   `reminder.delivery.askAdmin` already uses, so one situation is not
//   described in two vocabularies, and it stays in the indicative:
//   "your administrator can add them" is a fact about the product,
//   "ask your administrator" is a job handed to somebody who did not
//   come here for one.
//
// Both rules held all along; the pair went through a version that met
// one at the cost of the other, in each direction, before anybody
// noticed that the sentence being dropped to make room was saying the
// title's fact a second time. It promises no button, because there is
// none for them.
const WAITING = "waiting";

export async function FirstStepCard({
  need,
  size,
}: {
  need: keyof typeof STEPS;
  /**
   * How much of the screen this card is.
   *
   * Two call sites and two different jobs, which is why the caller says
   * it rather than the component guessing from `need`.
   *
   * `page` is the first-run dashboard, where this card is the ONLY
   * thing anyone can act on. It is the subject of the screen: the
   * heaviest text in the content area, its button directly under its
   * own sentence.
   *
   * `inline` is every later dashboard, where the card sits above six
   * counter tiles, two charts and four lists. Here it is read on the
   * way past, and the shape is deliberately a line and a button --
   * given the other one it would outweigh the page it introduces.
   * That trade is recorded at the top of this file and is the reason
   * this prop exists instead of one card growing for everybody.
   *
   * Required rather than defaulted: a third caller picking a size by
   * accident is exactly the mistake the two sentences above are about.
   */
  size: "page" | "inline";
}) {
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

  // Vertical on the first-run screen, and this is a trap rather than a
  // taste: a `text-lg` heading and an `h-10` button in one
  // `flex items-center` row leave the taller child setting the row, and
  // the row's height stops matching the block beside it -- the same
  // failure `field.tsx` records for its required `*`, which pm measured
  // as +8/+12px of drift. Stacking removes the question, and it is what
  // the criterion asks for anyway: the button belongs under the sentence
  // that explains it, not 1100px to its right (ui).
  const page = size === "page";

  return (
    <Card
      className={
        page
          ? // Capped, because a card that takes whatever width the
            // cabinet gives it stops being an object and becomes a
            // band. ui measured the first version at 976x166 with
            // roughly forty characters in it: the right 60% was empty
            // and the button sat alone at the left end. The screen read
            // as one that wants something, and not as a composition.
            //
            // The criterion is ui's: the space left inside the card,
            // from the right edge of the text to the card's edge, may
            // not exceed half the width of the text. Measured on the
            // stamped ground at 1280, the text is 364px in Turkish and
            // 356 in English, one line each. It was 1.54 and 1.61
            // before any cap.
            //
            // THE VALUE IS 512 BECAUSE 512 PASSES ON EITHER READING OF
            // THAT SENTENCE, and this class has already been changed
            // three times over exactly that ambiguity. Two people
            // measured the same card and reported 0.45 and 0.52,
            // because one subtracted the card's right padding from the
            // span and the other did not -- neither was careless, the
            // criterion simply did not say which edge it meant. At 576
            // the two readings straddle the threshold (0.45/0.48
            // against 0.52/0.55), so the card's width depended on who
            // held the ruler. At 512 they are 0.28/0.30 and 0.34/0.37:
            // under the line whichever end of the span is used.
            //
            // It also buys the margin ui asked for. At 576 English
            // cleared by 4%, so one longer translation would have
            // turned the criterion red before anything looked wrong.
            // The ratio gets worse as the text gets SHORTER, too --
            // the gap grows while the divisor shrinks -- so a one-word
            // ask would want a narrower card, not a longer sentence.
            "flex w-full max-w-lg flex-col items-start gap-5 p-6"
          : "flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
      }
    >
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
      <div className="flex min-w-0 flex-col gap-1">
        {/* The ask carries the weight of the screen it is on. It used to
            be `text-sm` with no weight at all, while the example block
            beside it drew its four lines at `font-medium` -- so the one
            thing the product wanted was the lightest text in the content
            area. Third time this inversion has been found in two days,
            and the rule it produced: on any screen the primary ask may
            not be drawn lighter than any secondary text near it (ui).

            Under the greeting's `text-2xl`, not level with it. The card
            is what to do; the `h1` is whose screen this is.

            Unchanged in `inline`, where the card is not the subject and
            the tiles below it are. */}
        <p
          className={
            page
              ? "text-lg font-semibold tracking-tight text-foreground"
              : "text-sm text-foreground"
          }
        >
          {t(`${namespace}.title`)}
        </p>
        <p className="text-sm text-muted-foreground">{t(`${namespace}.hint`)}</p>
      </div>
      {label !== null && (
        <Link
          href={step.href}
          className={cn(buttonVariants({ size: page ? "lg" : "md" }), "shrink-0")}
        >
          {label}
        </Link>
      )}
    </Card>
  );
}
