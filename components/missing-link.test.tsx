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

import { MissingLink } from "@/components/missing-link";

async function renderAs(role: string, need: "client" | "pet") {
  session.user.role = role;
  render(await MissingLink({ need }));
}

/**
 * The screen somebody walks into when the chain above them is missing a
 * link. Reached from two kinds of place, and that is what makes the
 * permission question real: the `/new` routes check their own before
 * rendering anything, the list screens do not.
 */
describe("the missing link", () => {
  it("offers the way out to somebody who can take it", async () => {
    await renderAs("ADMIN", "pet");

    expect(screen.getByRole("link")).toHaveAttribute("href", "/pets/new");
  });

  // A technician can open `/appointments` and `/visits` and find them
  // empty for exactly this reason, so the explanation is as true for
  // them as for anyone. What they cannot do is create the animal:
  // `/pets/new` answers them with a refusal, and a button that leads
  // there is worse than none.
  it("keeps the reason and drops the button for somebody who cannot", async () => {
    await renderAs("VET_TECH", "pet");

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(tr.common.missingPet)).toBeInTheDocument();
    expect(screen.getByText(tr.common.missingPetHint)).toBeInTheDocument();
  });

  // The walk down the chain has to remember what it was for. Without
  // it the vet saves the new record, lands on its page, and has to
  // reconstruct the errand -- two manual steps on an empty clinic.
  it("carries the errand down to the next form", async () => {
    await renderAs("ADMIN", "client");
    render(await MissingLink({ need: "pet", next: "/visits/new" }));

    const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/pets/new?next=%2Fvisits%2Fnew");
  });

  // Validated here as well as in the action that redirects: this value
  // decides where a browser goes, and neither side may assume the
  // other looked.
  it("drops an errand that leads off the site", async () => {
    await renderAs("ADMIN", "pet");
    render(await MissingLink({ need: "client", next: "https://ornek.test" }));

    const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    // The button still works; it just goes where it would have gone
    // with nobody asking.
    expect(hrefs).toContain("/clients/new");
    expect(hrefs.some((h) => h?.includes("ornek.test"))).toBe(false);
  });

  // The two links are separate permissions and a technician holds
  // neither, but they are asked separately so that a role holding one
  // and not the other gets the right answer on each screen.
  it("asks about the link it names, not the screen it is on", async () => {
    await renderAs("RECEPTIONIST", "client");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/clients/new");

    screen.getByRole("link").remove();
    await renderAs("RECEPTIONIST", "pet");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/pets/new");
  });
});
