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
// client's animal." A clinic with nothing on file met "search or type"
// over a box where searching cannot succeed, then -- on focus alone --
// a refusal to a search nobody had run, and the offer that opens the
// record only existed once a name was already in there.
//
// One sentence, in both places it can be read, because ui's screenshot
// showed they are never readable together: the list is `absolute
// top-full` and covers the line under the label the instant it opens.
// So each of the two places says what is missing AND what to do, and
// the test that matters is the one that reads them as the vet does --
// the box's placeholder before any focus, the list's body after it.

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

const box = (name: RegExp) => screen.getByRole("combobox", { name });

/** The list's body, read the way the vet meets it: by focus alone. */
const listBody = (name: RegExp) => {
  const input = box(name);
  fireEvent.focus(input);
  return document.getElementById(input.getAttribute("aria-controls")!)!
    .textContent;
};

/** What a screen reader is handed when focus lands on the picker. */
const described = (name: RegExp) =>
  (box(name).getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)
    .join(" ");

describe("a clinic with nothing on file", () => {
  it("asks for a name rather than offering a search that cannot win", () => {
    wrap(<VisitForm pets={[]} vets={VETS} canCreatePet />);

    expect(box(/hayvan/i).getAttribute("placeholder")).toEqual(
      tr.pet.typeNamePlaceholder,
    );
    expect(box(/hayvan/i).getAttribute("placeholder")).not.toMatch(/ara/i);
  });

  it("says what is missing AND what to do, in each place separately", () => {
    wrap(<VisitForm pets={[]} vets={VETS} canCreatePet />);

    // Under the label, before anything is touched.
    expect(described(/hayvan/i)).toContain(tr.pet.noneYetTypeToOpen);
    // And in the list, which covers that line as it opens -- so it
    // carries the whole sentence rather than only the half about the
    // clinic's state.
    const body = listBody(/hayvan/i);
    expect(body).toContain(tr.pet.noneYetTypeToOpen);
    expect(body).not.toContain(tr.common.noResults);
    // The half that would be lost if the two were split.
    expect(body).toMatch(/aynı formda açarsınız/);
  });

  it("says the same thing one block in, where the owner is asked for", () => {
    wrap(<VisitForm pets={[]} vets={VETS} canCreatePet canCreateOwner />);

    // The way the vet gets there: a name nobody has on file, and the
    // offer that grows the block rather than changing the address.
    const input = box(/hayvan/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Limon" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: /Limon/ }));

    expect(box(/sahibi/i).getAttribute("placeholder")).toEqual(
      tr.client.typeNamePlaceholder,
    );
    expect(described(/sahibi/i)).toContain(tr.client.noneYetTypeToOpen);
    expect(listBody(/sahibi/i)).toContain(tr.client.noneYetTypeToOpen);
  });

  it("promises a form rather than this form where the address changes", () => {
    wrap(<PetForm owners={[]} />);

    // `/pets/new` walks to `/clients/new`, so "on this form" would be
    // a lie. Same shape, different promise.
    expect(described(/sahibi/i)).toContain(tr.client.noneYetTypeToOpenForm);
    expect(listBody(/sahibi/i)).toContain(tr.client.noneYetTypeToOpenForm);
    expect(screen.queryByText(tr.client.noneYetTypeToOpen)).toBeNull();
    expect(box(/sahibi/i).getAttribute("placeholder")).toEqual(
      tr.client.typeNamePlaceholder,
    );
  });
});

describe("the sentence goes away as soon as it is not true", () => {
  it("is gone once the block it asks for is open", () => {
    wrap(<VisitForm pets={[]} vets={VETS} canCreatePet canCreateOwner />);

    const input = box(/hayvan/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Limon" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: /Limon/ }));

    // The vet has just done the thing it asked for. Left up, it asks
    // again.
    expect(screen.queryByText(tr.pet.noneYetTypeToOpen)).toBeNull();
    expect(box(/hayvan/i).getAttribute("placeholder")).toEqual(
      tr.common.searchOrType,
    );
  });

  it("is gone one block in too, once that block is open", () => {
    wrap(<VisitForm pets={[]} vets={VETS} canCreatePet canCreateOwner />);

    const animal = box(/hayvan/i);
    fireEvent.focus(animal);
    fireEvent.change(animal, { target: { value: "Limon" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: /Limon/ }));

    const owner = box(/sahibi/i);
    fireEvent.focus(owner);
    fireEvent.change(owner, { target: { value: "Ayşe Çelik" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: /Ayşe Çelik/ }));

    expect(screen.queryByText(tr.client.noneYetTypeToOpen)).toBeNull();
    expect(box(/sahibi/i).getAttribute("placeholder")).toEqual(
      tr.common.searchOrType,
    );
  });

  it("is absent once the clinic has an animal", () => {
    wrap(<VisitForm pets={ONE_PET} vets={VETS} canCreatePet />);

    expect(screen.queryByText(tr.pet.noneYetTypeToOpen)).toBeNull();
    expect(box(/hayvan/i).getAttribute("placeholder")).toEqual(
      tr.common.searchOrType,
    );
    // And the list is the list again: a query that matches nothing is a
    // search that really did run.
    expect(listBody(/hayvan/i)).not.toContain(tr.pet.noneYetTypeToOpen);
  });

  it("is absent for a reader the server would refuse", () => {
    // A receptionist who may record a visit but may not open an animal
    // (`lib/permissions.ts`). Telling them to type a new name is worse
    // than saying nothing.
    wrap(<VisitForm pets={[]} vets={VETS} />);

    expect(screen.queryByText(tr.pet.noneYetTypeToOpen)).toBeNull();
    expect(box(/hayvan/i).getAttribute("placeholder")).toEqual(
      tr.common.searchOrType,
    );
  });

  it("is absent on an edit, where no record can be opened", () => {
    wrap(<PetForm owners={[]} pet={{ id: "p-1", name: "Zeytin" } as never} />);

    expect(screen.queryByText(tr.client.noneYetTypeToOpenForm)).toBeNull();
  });
});
