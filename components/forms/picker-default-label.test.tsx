// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/visits/actions", () => ({
  createVisitAction: async () => ({}),
  updateVisitAction: async () => ({}),
}));
vi.mock("@/modules/appointments/actions", () => ({
  createAppointmentAction: async () => ({}),
  updateAppointmentAction: async () => ({}),
}));
vi.mock("@/modules/pets/actions", () => ({
  createPetAction: async () => ({}),
  updatePetAction: async () => ({}),
  searchPetsAction: async () => [],
}));
vi.mock("@/modules/clients/actions", () => ({
  searchClientsAction: async () => [],
}));
vi.mock("@/modules/invoices/actions", () => ({ createInvoiceAction: async () => ({}) }));

import { VisitForm } from "@/components/forms/visit-form";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { PetForm } from "@/components/forms/pet-form";
import { InvoiceForm } from "@/components/forms/invoice-form";

// A picker is handed the clinic's first `PAGE_SIZES.DROPDOWN` records, so
// the record a form opens on can sit outside the list it was given: the
// 87th animal of a 120-animal clinic, or an owner reached from a link.
//
// The field then rendered *empty* while the hidden input still carried the
// id — a required field that looks unanswered above a form that submits
// happily, and a vet who retypes the animal they already chose. The half
// that fixes it is here, at the call sites, and it is the half that can go
// missing without anything turning red: `Combobox` grew `defaultLabel`
// first and nothing passed it for a day (TEAM.md: a prop with no call site
// is not a feature). These four assertions are the call sites.

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      {ui}
    </NextIntlClientProvider>,
  );

/** What the user sees in the picker, not what the form will submit. */
const shown = (name: RegExp) =>
  (screen.getByRole("combobox", { name }) as HTMLInputElement).value;

/** What the form will submit for `name`. */
const submitted = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)
    ?.value;

const VETS = [{ id: "u-1", name: "Dr. Ayşe Demir" }];

describe("a record the picker's list does not contain", () => {
  it("shows the animal a visit is already about", () => {
    const { container } = wrap(
      <VisitForm
        visit={{ id: "v-1", petId: "p-87", vetId: "u-1" } as never}
        pets={[{ id: "p-1", name: "Karabaş" }]}
        petsCapped
        vets={VETS}
        defaultPetLabel="Boncuk"
      />,
    );

    expect(shown(/hayvan/i)).toBe("Boncuk");
    expect(submitted(container, "petId")).toBe("p-87");
  });

  it("shows the animal an appointment is already about", () => {
    wrap(
      <AppointmentForm
        appointment={{ id: "a-1", petId: "p-87", vetId: "u-1" } as never}
        pets={[{ id: "p-1", name: "Karabaş" }]}
        petsCapped
        vets={VETS}
        defaultPetLabel="Boncuk"
      />,
    );

    expect(shown(/hayvan/i)).toBe("Boncuk");
  });

  it("shows the owner an animal already belongs to", () => {
    wrap(
      <PetForm
        pet={{ id: "p-1", name: "Boncuk", ownerId: "c-87" } as never}
        owners={[{ id: "c-1", firstName: "Ayşe", lastName: "Demir" }]}
        ownersCapped
        defaultOwnerLabel="Zeynep Yıldız"
      />,
    );

    expect(shown(/sahibi/i)).toBe("Zeynep Yıldız");
  });

  it("shows the client a new invoice was opened for", () => {
    // The only one of the four that never has a record to read the name
    // off: the id arrives in the URL, so the page has to look it up.
    wrap(
      <InvoiceForm
        clients={[{ id: "c-1", firstName: "Ayşe", lastName: "Demir" }]}
        clientsCapped
        defaultClientId="c-87"
        defaultClientLabel="Zeynep Yıldız"
      />,
    );

    expect(shown(/müşteri/i)).toBe("Zeynep Yıldız");
  });
});

// The hidden-species props are the other half of a fix whose first half
// is on the server: typing "Kedi" records CAT even when the clinic has
// switched CAT off. The picker knows how to offer it; this is the
// assertion that anything ever hands it the list. A prop with no call
// site is the shape this session has now closed a dozen times.
describe("a species the clinic switched off", () => {
  const HIDDEN = [
    {
      value: "RABBIT",
      label: "Tavşan",
      names: ["Tavşan", "Rabbit"],
      note: "Tavşan yerleşik bir tür. Bu klinikte kapalı, ama bu hayvan için kullanıldı.",
    },
  ];

  it("is offered by the name the vet typed, in either language", () => {
    const { container } = wrap(
      <PetForm
        owners={[{ id: "c-1", firstName: "Ayşe", lastName: "Demir" }]}
        enabledSpecies={["DOG", "CAT", "OTHER"]}
        hiddenBuiltIns={HIDDEN}
        hiddenQualifier="bu klinikte kapalı"
      />,
    );

    // The field only exists once "New species" is open -- which is the
    // path a vet takes when the list does not show what is on the
    // table, and exactly the path that used to invent a duplicate.
    fireEvent.click(screen.getByRole("button", { name: /Yeni tür/ }));

    // The English name, typed into the Turkish interface, because that
    // is the case the folding exists for.
    const draft = container.querySelector<HTMLInputElement>(
      'input[placeholder="Tür adı (örn. Kirpi)"]',
    )!;
    fireEvent.change(draft, { target: { value: "Rabbit" } });

    expect(screen.getByRole("button", { name: /Tavşan/ })).toBeTruthy();
    expect(screen.getByText(/bu klinikte kapalı/)).toBeTruthy();
  });
});
