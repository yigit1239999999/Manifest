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

async function renderAs(role: string, need: "visit" | "client" | "pet") {
  session.user.role = role;
  const { container } = render(await FirstStepCard({ need }));
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
  it("does not hand the waiting reader an errand", async () => {
    await renderAs("VET_TECH", "client");

    const said =
      tr.dashboard.firstStep.waiting.title + tr.dashboard.firstStep.waiting.hint;

    expect(said).not.toMatch(/yetki|izin|yönetici|rica|isteyiniz|söyleyiniz/i);
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
