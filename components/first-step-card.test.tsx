// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: never) =>
    createTranslator({ locale: "tr", messages: tr, namespace }),
}));

const { session } = vi.hoisted(() => ({ session: { user: { role: "ADMIN" } } }));
vi.mock("@/lib/session", () => ({ requireSession: async () => session }));

import { FirstStepCard } from "@/components/first-step-card";

async function renderAs(
  role: string,
  need: "visit" | "client" | "pet",
  size: "page" | "inline" = "inline",
) {
  session.user.role = role;
  const { container } = render(await FirstStepCard({ need, size }));
  return container;
}

/**
 * The one line at the top of an empty dashboard. `MissingLink` covers the
 * other half of the same idea, on the screens somebody has already walked
 * into; the two differ on purpose where a technician is reading, so both
 * choices are pinned here and there rather than left to whoever edits next.
 */
describe("the first step card", () => {
  it("names the missing link and sends the reader to the form that fills it", async () => {
    await renderAs("ADMIN", "client");

    expect(
      screen.getByText(tr.dashboard.firstStep.client.title),
    ).toBeInTheDocument();
    // The second line carries the promise, so it is checked rather than
    // assumed: without it the first line is an instruction with no
    // reassurance under it (ux).
    expect(
      screen.getByText(tr.dashboard.firstStep.client.hint),
    ).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/clients/new");
  });

  it("moves to the second link once the first is filled", async () => {
    await renderAs("ADMIN", "pet");

    expect(screen.getByText(tr.dashboard.firstStep.pet.title)).toBeInTheDocument();
    expect(screen.getByText(tr.dashboard.firstStep.pet.hint)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/pets/new");
  });

  // Speaks to a reader who cannot act, but never asks them to. Until
  // pm opened the dashboard as a technician this branch rendered
  // nothing at all, and the screen answered "what am I meant to do
  // here" with silence -- which is the right fact, since every
  // permission a technician holds writes onto an animal and there is no
  // animal yet, but it leaves them unable to tell an empty product from
  // a broken one.
  //
  // The button is what must not be there. "Somebody should add a
  // client", said to a technician who cannot, is a standing instruction
  // addressed to nobody in the room, and a link the server would refuse
  // is worse than no link.
  it("tells a reader who cannot act what their work waits on", async () => {
    const container = await renderAs("VET_TECH", "client");

    expect(
      screen.getByText(tr.dashboard.firstStep.waiting.title),
    ).toBeInTheDocument();
    expect(
      screen.getByText(tr.dashboard.firstStep.waiting.hint),
    ).toBeInTheDocument();
    expect(container.querySelector("a")).toBeNull();
  });

  // The sentence is the one place in this card that may not carry an
  // ask, so it is checked for one rather than trusted to stay calm: a
  // later edit that made it say "ask your vet to add a client" would
  // turn a statement of fact into an errand handed to someone who
  // cannot run it.
  //
  // What is forbidden is the imperative, not the role. This used to
  // reject "yönetici" outright and so rejected ux's approved wording,
  // which names the clinic administrator on purpose: a reader who is
  // told only that nothing is on file does not learn who can change
  // that, and leaving it out is the omission TEAM.md #21 is about.
  // "Your administrator can add them" is a fact about the product;
  // "ask your administrator" is a job handed to somebody who did not
  // come here for one. The line between the two is the mood of the
  // verb, so that is what is measured.
  it("does not hand the waiting reader an errand", async () => {
    await renderAs("VET_TECH", "client");

    const said =
      tr.dashboard.firstStep.waiting.title + tr.dashboard.firstStep.waiting.hint;

    expect(said).not.toMatch(/görüşünüz|isteyiniz|söyleyiniz|rica ed|talep ed/i);
  });
});

/**
 * The first ask for a clinic with nothing in it is the work, not the
 * data entry.
 *
 * "Ben veri girmek için oturmuyorum, iş yapıyorum." The chain makes
 * the owner and the animal on the way to the visit, so asking for the
 * visit no longer costs the records — and the sentence says so, which
 * is why it could not exist before `?next=` did.
 */
describe("the first ask of an empty clinic", () => {
  it("asks for a visit, and promises the chain the product now keeps", async () => {
    const container = await renderAs("VETERINARIAN", "visit");

    expect(container.textContent).toContain(tr.dashboard.firstStep.visit.title);
    expect(container.textContent).toContain(tr.dashboard.firstStep.visit.hint);
    expect(container.querySelector("a")).toHaveAttribute("href", "/visits/new");
  });

  // One fall-back and only from here: somebody who cannot write a
  // visit may still be able to make a client, which is a smaller but
  // real first step.
  it("falls back to the client ask for someone who cannot write a visit", async () => {
    const container = await renderAs("RECEPTIONIST", "visit");

    expect(container.textContent).toContain(tr.dashboard.firstStep.client.title);
    expect(container.textContent).toContain(tr.dashboard.firstStep.client.hint);
    expect(container.querySelector("a")).toHaveAttribute("href", "/clients/new");
  });
});

/**
 * The two shapes this card has, and why one component has both.
 *
 * On the first-run screen it is the only thing anyone can act on, so it
 * is the subject: the heaviest text in the content area, its button
 * under its own sentence. On every later dashboard it is read on the
 * way past, above six counter tiles and four lists, and the same shape
 * would outweigh the page it introduces -- which is the trade written
 * at the top of the component and the reason the caller chooses.
 *
 * Held here because the first shape was invented to fix an inversion
 * that had already happened three times in two days: the one thing the
 * product was asking for was drawn lighter than the example text beside
 * it. A rule that has been broken three times does not survive on being
 * written down.
 */
describe("the two shapes of the card", () => {
  const ask = (container: HTMLElement) =>
    container.querySelectorAll("p")[0] as HTMLElement;
  const hint = (container: HTMLElement) =>
    container.querySelectorAll("p")[1] as HTMLElement;

  it("gives the ask weight when the card is the screen", async () => {
    const container = await renderAs("VETERINARIAN", "visit", "page");

    // Heavier than the sentence under it, and by weight rather than by
    // colour alone -- the two used to differ only in `--muted-fg`.
    expect(ask(container).className).toContain("font-semibold");
    expect(hint(container).className).not.toMatch(/font-(semibold|bold)/);

    // And still under the greeting. The `h1` on that screen is
    // `text-2xl`: the card says what to do, the heading says whose
    // screen this is, and levelling them loses that.
    expect(ask(container).className).toContain("text-lg");
    expect(ask(container).className).not.toContain("text-2xl");
  });

  it("keeps the button under the sentence it belongs to", async () => {
    const container = await renderAs("VETERINARIAN", "visit", "page");
    const card = container.firstElementChild as HTMLElement;

    // Two things at once, and they are the same class. The row form put
    // the button ~1100px from its own sentence at 1280px; and a
    // `text-lg` heading beside an `h-10` button in one
    // `flex items-center` row lets the taller child set the row, which
    // is the drift `field.tsx` records for its required `*`.
    expect(card.className).not.toContain("sm:flex-row");
    expect(card.className).toContain("flex-col");
  });

  it("stays an object rather than a band when it is the screen", async () => {
    const container = await renderAs("VETERINARIAN", "visit", "page");
    const card = container.firstElementChild as HTMLElement;

    // Measured at 976x166 without this: forty characters in a card as
    // wide as the cabinet, the right 60% empty and the button alone at
    // the far left. A width inherited from the container is how a card
    // stops reading as one thing.
    expect(card.className).toMatch(/\bmax-w-/);
  });

  it("leaves the later dashboard exactly as it was", async () => {
    const container = await renderAs("VETERINARIAN", "pet", "inline");
    const card = container.firstElementChild as HTMLElement;

    // The second call site is not in this change's scope, and this is
    // what says so out loud: a line and a button in a row, the ask at
    // the same size as its hint.
    expect(ask(container).className).toContain("text-sm");
    expect(ask(container).className).not.toMatch(/font-(semibold|bold)/);
    expect(card.className).toContain("sm:flex-row");
    // And no cap: the strip takes the dashboard's width on purpose, so
    // it lines up with the tiles under it.
    expect(card.className).not.toMatch(/\bmax-w-/);
  });
});
