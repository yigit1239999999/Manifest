// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/pets/actions", () => ({
  createPetAction: async () => ({}),
  updatePetAction: async () => ({}),
}));
vi.mock("@/modules/clients/actions", () => ({
  searchClientsAction: async () => [],
}));

import { OptionalDetails } from "@/components/ui/optional-details";
import { PetForm } from "@/components/forms/pet-form";

const OWNERS = [{ id: "c-1", firstName: "Ayşe", lastName: "Yılmaz" }];

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      {ui}
    </NextIntlClientProvider>,
  );

describe("the fold that keeps a form to its first minute", () => {
  it("says what is behind it without being opened", () => {
    wrap(
      <OptionalDetails title="İsteğe bağlı detaylar" hint="Doğum tarihi, ağırlık ve notlar.">
        <input name="color" />
      </OptionalDetails>,
    );

    // The hint is the whole difference between a fold and a drawer with
    // no label. Without it the reader has to open the thing to learn
    // whether they needed it, which costs more than the fold saves.
    expect(screen.getByText("Doğum tarihi, ağırlık ve notlar.")).toBeInTheDocument();
  });

  it("opens on arrival when the record already has some of it filled", () => {
    const { container } = wrap(
      <OptionalDetails title="t" hint="h" defaultOpen>
        <input name="color" />
      </OptionalDetails>,
    );

    // Editing must never hide data that exists: a vet who opens an
    // animal with a microchip number and sees no microchip field will
    // reasonably conclude the product lost it.
    expect(container.querySelector("details")).toHaveAttribute("open");
  });

  it("is closed by default, because the point is the fields you do not see", () => {
    const { container } = wrap(
      <OptionalDetails title="t" hint="h">
        <input name="color" />
      </OptionalDetails>,
    );

    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });
});

/**
 * The rule the fold has to keep, checked where it is actually used.
 *
 * A required field behind a fold is a form that refuses to submit for a
 * reason the reader cannot see: the browser blocks on an element it
 * cannot scroll to, and nothing on screen explains it. This is asserted
 * against the rendered form rather than by reading the source, because
 * the defect is about what a reader can reach, not about how the file
 * is written.
 *
 * It lives here rather than in `pet-form`'s own tests because the rule
 * belongs to the fold. `client-form` is the next caller -- the form a
 * receptionist meets FIRST at the counter, and today the only one on
 * that path with nothing folded at all -- and this test is what will
 * catch the same mistake there.
 */
describe("what may not be folded away", () => {
  it("hides nothing the form will refuse to submit without", () => {
    const { container } = wrap(<PetForm owners={OWNERS} enabledSpecies={["DOG"]} />);

    const fold = container.querySelector("details");
    expect(fold).not.toBeNull();

    // Counted first, so that the assertion below cannot pass by the fold
    // being empty -- which is how a guard quietly stops guarding.
    expect(fold!.querySelectorAll("input, select, textarea").length).toBeGreaterThan(0);
    expect(fold!.querySelectorAll("[required]")).toHaveLength(0);
  });
});
