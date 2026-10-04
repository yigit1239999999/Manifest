// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/visits/actions", () => ({
  createVisitIntakeAction: async () => ({}),
  updateVisitAction: async () => ({}),
}));
vi.mock("@/modules/clients/actions", () => ({
  searchClientsAction: async () => ({ options: [], hasMore: false }),
}));
vi.mock("@/modules/pets/actions", () => ({
  searchPetsAction: async () => ({ options: [], hasMore: false }),
}));

import { VisitForm } from "@/components/forms/visit-form";

const VETS = [{ id: "u-1", name: "Selin Aydın" }];

const PETS = [
  { id: "p-1", name: "Zeytin", ownerId: "c-1", ownerName: "Ayşe Yılmaz", speciesLabel: "Kedi" },
  { id: "p-2", name: "Karabaş", ownerId: "c-2", ownerName: "Mehmet Kaya", speciesLabel: "Köpek" },
];

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      {ui}
    </NextIntlClientProvider>,
  );

const pick = (name: string) => {
  const input = screen.getByRole("combobox", { name: /hayvan/i });
  fireEvent.focus(input);
  const listId = input.getAttribute("aria-controls")!;
  const row = Array.from(
    document.getElementById(listId)!.querySelectorAll('[role="option"]'),
  ).find((o) => o.textContent?.startsWith(name))!;
  fireEvent.mouseDown(row);
};

const weight = () => screen.getByLabelText(/ağırlık/i) as HTMLInputElement;

// The vet's words: "Penisilin alerjisi" has to be on the first screen of
// the examination, not on the animal's page they did not pass through.
describe("the animal's medical alerts on a new visit", () => {
  it("are shown when the page already knew the animal", () => {
    wrap(
      <VisitForm
        pets={PETS}
        vets={VETS}
        defaultPetId="p-1"
        defaultPetAlerts="Penisilin alerjisi"
      />,
    );

    expect(screen.getByText("Tıbbi uyarılar")).toBeTruthy();
    expect(screen.getByText("Penisilin alerjisi")).toBeTruthy();
  });

  it("go away when another animal is picked, rather than sit over it", () => {
    wrap(
      <VisitForm
        pets={PETS}
        vets={VETS}
        defaultPetId="p-1"
        defaultPetAlerts="Penisilin alerjisi"
      />,
    );

    pick("Karabaş");

    expect(screen.queryByText("Penisilin alerjisi")).toBeNull();
  });
});

describe("an implausible weight", () => {
  it("is questioned under the box for a cat at 42 kg, without blocking the save", () => {
    wrap(
      <VisitForm pets={PETS} vets={VETS} defaultPetId="p-1" defaultPetSpecies="CAT" />,
    );

    fireEvent.change(weight(), { target: { value: "42" } });

    const hint = screen.getByText(
      "Bir kedi için 42 kg alışılmışın dışında. Lütfen kontrol edin.",
    );
    expect(weight().getAttribute("aria-describedby")).toContain(hint.id);
    expect(weight().getAttribute("aria-invalid")).not.toBe("true");
    expect(
      (screen.getByRole("button", { name: /viziti kaydet/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("is not questioned at 4,2 kg", () => {
    wrap(
      <VisitForm pets={PETS} vets={VETS} defaultPetId="p-1" defaultPetSpecies="CAT" />,
    );

    fireEvent.change(weight(), { target: { value: "4,2" } });

    expect(screen.queryByText(/alışılmışın dışında/)).toBeNull();
  });

  it("is not judged when the species is not known up front", () => {
    wrap(<VisitForm pets={PETS} vets={VETS} />);

    fireEvent.change(weight(), { target: { value: "42" } });

    expect(screen.queryByText(/alışılmışın dışında/)).toBeNull();
  });
});

describe("a visit started from an appointment", () => {
  it("opens with the appointment's reason and carries its id", () => {
    const { container } = wrap(
      <VisitForm
        pets={PETS}
        vets={VETS}
        defaultPetId="p-1"
        appointmentId="appt-1"
        defaultChiefComplaint="Kusma, iki gündür"
      />,
    );

    expect(
      (screen.getByLabelText(/ana şikayet/i) as HTMLTextAreaElement).value,
    ).toBe("Kusma, iki gündür");
    expect(
      (container.querySelector('input[name="appointmentId"]') as HTMLInputElement)
        .value,
    ).toBe("appt-1");
  });

  it("carries no appointment when it was not started from one", () => {
    const { container } = wrap(<VisitForm pets={PETS} vets={VETS} />);

    expect(container.querySelector('input[name="appointmentId"]')).toBeNull();
  });
});
