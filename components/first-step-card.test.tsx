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

async function renderAs(role: string, need: "client" | "pet") {
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
