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
  createClientAction: async () => ({}),
  updateClientAction: async () => ({}),
}));

import { OptionalDetails } from "@/components/ui/optional-details";
import { PetForm } from "@/components/forms/pet-form";
import { ClientForm } from "@/components/forms/client-form";

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

  it("hides nothing the client form will refuse to submit without", () => {
    const { container } = wrap(<ClientForm />);

    const fold = container.querySelector("details");
    expect(fold).not.toBeNull();
    expect(fold!.querySelectorAll("input, select, textarea").length).toBeGreaterThan(0);
    expect(fold!.querySelectorAll("[required]")).toHaveLength(0);
  });

  // The hint promises a number, so the number is checked against the
  // thing it counts. ux asked for it to be derived rather than typed --
  // "today it is nine, tomorrow it is eight, and a hand-written 9 will
  // lie one day" -- and a derived number is only honest while its source
  // still matches the form. This is that check: the list the hint counts
  // against the controls the fold actually contains.
  it("counts the fields it is hiding, and counts the right ones", () => {
    const { container } = wrap(<ClientForm />);

    const fold = container.querySelector("details")!;
    const rendered = [...fold.querySelectorAll("input, select, textarea")]
      .map((el) => el.getAttribute("name"))
      .filter((n): n is string => Boolean(n));

    expect(new Set(rendered)).toEqual(
      new Set([
        "email",
        "secondaryPhone",
        "preferredContact",
        "preferredLanguage",
        "address",
        "city",
        "postalCode",
        "country",
        "notes",
      ]),
    );

    // And the sentence says that number out loud, in the reader's own
    // language rather than as a bare digit in the markup.
    expect(
      screen.getByText(tr.client.optionalDetailsHint.replace("{count}", "9")),
    ).toBeInTheDocument();
  });

  // The constraint that does not follow from "required", and the one
  // that would have been lost first. Notification consent is optional,
  // so nothing above catches it -- but its unanswered value is acted
  // on: null means no automatic message ever goes to that owner, and
  // the dashboard counts exactly those owners. Folded, every client
  // opened at the counter would be born silent, and the counter is the
  // cheapest moment the question will ever be asked.
  it("leaves the consent question where the counter will answer it", () => {
    const { container } = wrap(<ClientForm />);

    const fold = container.querySelector("details")!;
    const consent = container.querySelectorAll(
      'input[name="notificationsOptIn"]',
    );

    expect(consent.length).toBeGreaterThan(0);
    for (const radio of consent) {
      expect(fold.contains(radio)).toBe(false);
    }
  });
});
