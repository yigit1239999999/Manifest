// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/modules/visits/actions", () => ({
  createVisitIntakeAction: async () => ({}),
  updateVisitAction: async () => ({}),
}));
vi.mock("@/modules/pets/actions", () => ({
  createPetAction: async () => ({}),
  updatePetAction: async () => ({}),
  searchPetsAction: async () => ({ options: [], hasMore: false }),
}));
vi.mock("@/modules/clients/actions", () => ({
  searchClientsAction: async () => ({ options: [], hasMore: false }),
}));

import { VisitForm } from "@/components/forms/visit-form";
import { PetForm } from "@/components/forms/pet-form";

// "Nothing typed, and I do not understand that typing lets me add a
// client's animal." The picker said "Ara veya yaz…", which names the
// gesture but not what it buys, and the offer only existed once a name
// was already in the box -- so the product's newest ability was the one
// thing a clinic on its first morning could not find.
//
// Two sentences answer two different questions and this file's job is
// to keep them different: the line under the label says WHAT TO DO, the
// list's body says WHAT THE CLINIC HOLDS. Saying either one twice
// spends both.

const VETS = [{ id: "u-1", name: "Dr. Ayşe Demir" }];
const ONE_PET = [
  {
    id: "p-1",
    name: "Zeytin",
    ownerId: "c-1",
    ownerName: "Ayşe Yılmaz",
    speciesLabel: "Kedi",
    lastSeen: "2 gün önce",
  },
];

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      {ui}
    </NextIntlClientProvider>,
  );

/** The list's body, read the way the vet meets it: by focus alone. */
const listBody = (name: RegExp) => {
  const input = screen.getByRole("combobox", { name });
  fireEvent.focus(input);
  return document.getElementById(input.getAttribute("aria-controls")!)!
    .textContent;
};

/** What a screen reader is handed when focus lands on the picker. */
const described = (name: RegExp) => {
  const input = screen.getByRole("combobox", { name });
  return (input.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)
    .join(" ");
};

describe("a clinic with nothing on file", () => {
  it("says what typing does before the vet touches anything", () => {
    wrap(<VisitForm pets={[]} vets={VETS} canCreatePet />);

    expect(
      screen.getByText(tr.common.typeToOpenHere),
    ).toBeTruthy();
    // Not merely on screen: the same sentence is what the picker points
    // a screen reader at, and `Field` does that without new code here.
    expect(described(/hayvan/i)).toContain(tr.common.typeToOpenHere);
  });

  it("says what the clinic holds when the list opens, not 'no results'", () => {
    wrap(<VisitForm pets={[]} vets={VETS} canCreatePet />);

    const body = listBody(/hayvan/i);
    expect(body).toContain(tr.pet.noneYet);
    expect(body).not.toContain(tr.common.noResults);
  });

  it("says the same thing one block in, where the owner is asked for", () => {
    wrap(<VisitForm pets={[]} vets={VETS} canCreatePet canCreateOwner />);

    // The way the vet gets there: a name nobody has on file, and the
    // offer that grows the block rather than changing the address.
    const box = screen.getByRole("combobox", { name: /hayvan/i });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "Limon" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: /Limon/ }));

    // Same sentence, because the promise is the same one: this form.
    expect(described(/sahibi/i)).toContain(tr.common.typeToOpenHere);
    expect(listBody(/sahibi/i)).toContain(tr.client.noneYet);
  });

  it("keeps the two sentences about two different things", () => {
    expect(tr.pet.noneYet).not.toEqual(tr.common.typeToOpenHere);
    // `/pets/new` changes the address, so it cannot borrow the promise
    // the two inline pickers make.
    expect(tr.client.typeToOpenForm).not.toEqual(tr.common.typeToOpenHere);
  });

  it("promises a form rather than this form where the address changes", () => {
    wrap(<PetForm owners={[]} />);

    expect(described(/sahibi/i)).toContain(tr.client.typeToOpenForm);
    expect(screen.queryByText(tr.common.typeToOpenHere)).toBeNull();
    expect(listBody(/sahibi/i)).toContain(tr.client.noneYet);
  });
});

describe("the line goes away as soon as it is not true", () => {
  it("is absent once the clinic has an animal", () => {
    wrap(<VisitForm pets={ONE_PET} vets={VETS} canCreatePet />);

    expect(screen.queryByText(tr.common.typeToOpenHere)).toBeNull();
    // And the list is the list again: a query that matches nothing is a
    // search that really did run.
    expect(listBody(/hayvan/i)).not.toContain(tr.pet.noneYet);
  });

  it("is absent for a reader the server would refuse", () => {
    // A receptionist who may record a visit but may not open an animal
    // (`lib/permissions.ts`). Telling them to type a new name is worse
    // than saying nothing.
    wrap(<VisitForm pets={[]} vets={VETS} />);

    expect(screen.queryByText(tr.common.typeToOpenHere)).toBeNull();
  });

  it("is absent on an edit, where no record can be opened", () => {
    wrap(<PetForm owners={[]} pet={{ id: "p-1", name: "Zeytin" } as never} />);

    expect(screen.queryByText(tr.client.typeToOpenForm)).toBeNull();
  });
});
