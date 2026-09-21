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

    expect(screen.getByText(tr.dashboard.firstStep.client)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/clients/new");
  });

  it("moves to the second link once the first is filled", async () => {
    await renderAs("ADMIN", "pet");

    expect(screen.getByText(tr.dashboard.firstStep.pet)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/pets/new");
  });

  // Absent rather than button-less, which is the opposite of what
  // `MissingLink` does and the difference is the surface. There, the
  // sentence is the whole screen and explains why it is empty. Here it is
  // a row above six metric cards on a page with other things to read, and
  // "somebody should add a client" to a technician who cannot is a
  // standing instruction addressed to nobody in the room.
  it("stays away from a reader who cannot act on it", async () => {
    const container = await renderAs("VET_TECH", "client");

    expect(container).toBeEmptyDOMElement();
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

    expect(container.textContent).toContain(tr.dashboard.firstStep.visit);
    expect(container.querySelector("a")).toHaveAttribute("href", "/visits/new");
  });

  // One fall-back and only from here: somebody who cannot write a
  // visit may still be able to make a client, which is a smaller but
  // real first step.
  it("falls back to the client ask for someone who cannot write a visit", async () => {
    const container = await renderAs("RECEPTIONIST", "visit");

    expect(container.textContent).toContain(tr.dashboard.firstStep.client);
    expect(container.querySelector("a")).toHaveAttribute("href", "/clients/new");
  });
});
