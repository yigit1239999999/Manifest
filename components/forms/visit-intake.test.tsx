// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

// What the server says back, set per test. The real wrapper attaches
// `values` to any state that reports a problem (`lib/action.ts`), which
// is what a rejected submit has to put back into the block.
const server = vi.hoisted(() => ({ next: {} as Record<string, unknown> }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/visits/actions", () => ({
  createVisitAction: async () => ({}),
  createVisitIntakeAction: async () => server.next,
  updateVisitAction: async () => ({}),
}));
vi.mock("@/modules/clients/actions", () => ({
  searchClientsAction: async () => ({ options: [], hasMore: false }),
}));
vi.mock("@/modules/pets/actions", () => ({
  searchPetsAction: async () => ({ options: [], hasMore: false }),
}));

import { VisitForm } from "@/components/forms/visit-form";

const VETS = [
  { id: "u-1", name: "Selin Aydın" },
  { id: "u-2", name: "Deniz Arslan" },
];

const PETS = [
  {
    id: "p-1",
    name: "Zeytin",
    ownerName: "Ayşe Yılmaz",
    speciesLabel: "Kedi",
    lastSeen: "7 ay önce",
  },
];

const OWNERS = [
  { id: "c-1", firstName: "Ayşe", lastName: "Yılmaz" },
  { id: "c-2", firstName: "Mehmet", lastName: "Kaya" },
];

const SPECIES_CHOICES = [
  { value: "DOG", label: "Köpek", icon: "DOG" },
  { value: "CAT", label: "Kedi", icon: "CAT" },
];

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      {ui}
    </NextIntlClientProvider>,
  );

/**
 * Who performed the examination, answered before the form opens.
 *
 * The service used to answer it with `vetId || ctx.userId`, and that was
 * removed for a reason that still holds: it recorded whoever typed the
 * form, so a receptionist writing up a visit became the clinician who
 * performed it, in a field nobody ever goes back to correct.
 *
 * What was wrong there was the guessing, not the answer. A vet filling
 * in their own examination is the ordinary case; the honest place to say
 * so is the screen, where the name is visible and one click away from
 * being changed. So the default is the PAGE's, and it is only ever the
 * signed-in user when the page has established they are somebody a visit
 * may be recorded against.
 */
describe("the veterinarian a new visit opens with", () => {
  it("is the signed-in clinician, said by name and marked as theirs", () => {
    wrap(<VisitForm pets={PETS} vets={VETS} defaultVetId="u-1" />);

    const select = screen.getByLabelText(/veteriner/i) as HTMLSelectElement;

    expect(select.value).toBe("u-1");
    expect(screen.getByRole("option", { name: "Selin Aydın (siz)" })).toBeTruthy();
    // Only the reader is marked. Every other clinician is a name.
    expect(screen.getByRole("option", { name: "Deniz Arslan" })).toBeTruthy();
  });

  // "Not recorded" is a real answer and a better one than a name nobody
  // chose -- which is exactly what a receptionist's own name would be.
  it("is left unrecorded for somebody who may not be recorded as one", () => {
    wrap(<VisitForm pets={PETS} vets={VETS} />);

    expect((screen.getByLabelText(/veteriner/i) as HTMLSelectElement).value).toBe(
      "",
    );
  });

  it("is whoever the record already says, when one is being edited", () => {
    const visit = {
      id: "v-1",
      petId: "p-1",
      vetId: "u-2",
      type: "WELLNESS_CHECK",
      visitedAt: new Date("2026-09-21T10:00:00Z"),
    } as never;

    wrap(<VisitForm visit={visit} pets={PETS} vets={VETS} defaultVetId="u-1" />);

    expect((screen.getByLabelText(/veteriner/i) as HTMLSelectElement).value).toBe(
      "u-2",
    );
  });
});

/**
 * The block the visit form opens instead of sending the vet away.
 *
 * Their account of what stood here: "the dog is on the table, the owner
 * is crying, and what I got was not a blank page but a door." The door
 * became a walk -- the picker offered to go to `/pets/new` and come
 * back -- and a walk is still leaving: the address changed, the visit
 * that was half typed had to survive two screens, and the vet had to
 * remember what they were doing when they got back.
 *
 * So the five states below are one state machine and all five are
 * tested, because four of them are how it goes wrong: a block that
 * cannot be closed, one that loses what was typed when the server says
 * no, one that forgets it was open when the vet comes back, and one
 * that leaves the animal they moved on from underneath it.
 */
describe("the animal opened inside the visit form", () => {
  beforeEach(() => {
    server.next = {};
    window.sessionStorage.clear();
    // Who the drafts belong to; the app layout writes this on <main>.
    document.body.innerHTML = '<main data-draft-scope="u-1"></main>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
    window.sessionStorage.clear();
  });

  const form = () => (
    <NextIntlClientProvider locale="tr" messages={tr}>
      <VisitForm
        pets={PETS}
        vets={VETS}
        owners={OWNERS}
        speciesChoices={SPECIES_CHOICES}
        canCreatePet
        canCreateOwner
      />
    </NextIntlClientProvider>
  );

  const mount = () => {
    const container = document.createElement("div");
    document.body.querySelector("main")!.appendChild(container);
    return render(form(), { container });
  };

  const field = (name: string) =>
    document.querySelector<HTMLInputElement>(`[name="${name}"]`);

  /**
   * Type into a picker and take the row that offers to create.
   *
   * `mouseDown` rather than `click`, because that is what the rows
   * listen for: a click fires after blur, and blur closes the list.
   */
  const askToCreate = (label: RegExp, typed: string, row: RegExp) => {
    const box = screen.getByLabelText(label);
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: typed } });
    fireEvent.mouseDown(screen.getByRole("option", { name: row }));
  };

  // 1. Closed, which is every visit written against an animal already
  // on file -- the ordinary case, and it has to stay ordinary.
  it("is not there until somebody asks for it", () => {
    mount();

    expect(field("newPet[intent]")).toBeNull();
    expect(screen.queryByText(/yeni hayvan:/i)).toBeNull();
  });

  // 2. Open, against an owner already on file.
  it("opens on the name that was typed, and empties the animal behind it", () => {
    mount();

    // An animal chosen and then thought better of: the id left behind
    // is what the visit would otherwise be written against.
    const picker = screen.getByLabelText(/^hayvan$/i);
    fireEvent.focus(picker);
    fireEvent.change(picker, { target: { value: "Zeytin" } });
    fireEvent.mouseDown(screen.getAllByRole("option", { name: /Zeytin/ })[0]);
    expect(field("petId")!.value).toBe("p-1");

    askToCreate(/^hayvan$/i, "Limon", /Limon.*yeni hayvan aç/i);

    expect(field("newPet[intent]")!.value).toBe("1");
    expect(field("newPet[name]")!.value).toBe("Limon");
    expect(screen.getByText("Yeni hayvan: Limon")).toBeTruthy();
    expect(field("petId")!.value).toBe("");
    // What was asked for is still on screen in the box it was typed in.
    expect((screen.getByLabelText(/^hayvan$/i) as HTMLInputElement).value).toBe(
      "Limon",
    );
  });

  it("takes an owner who is already on file", () => {
    mount();
    askToCreate(/^hayvan$/i, "Limon", /Limon.*yeni hayvan aç/i);

    const owner = screen.getByLabelText(/^sahibi$/i);
    fireEvent.focus(owner);
    fireEvent.change(owner, { target: { value: "Ayşe" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: /Ayşe Yılmaz/ }));

    expect(field("newPet[ownerId]")!.value).toBe("c-1");
    // Nothing is being written down about a client who exists.
    expect(field("newOwner[firstName]")).toBeNull();
  });

  // 3. Open, with an owner being written down in the same breath.
  it("opens the owner from the same box, one block further in", () => {
    mount();
    askToCreate(/^hayvan$/i, "Limon", /Limon.*yeni hayvan aç/i);
    askToCreate(/^sahibi$/i, "Ayşe Çelik", /Ayşe Çelik.*yeni müşteri aç/i);

    expect(screen.getByText("Yeni sahip: Ayşe Çelik")).toBeTruthy();
    // Split at the first space, both halves editable: a guess costs a
    // keystroke, retyping the name costs the thing the vet complained
    // about.
    expect(field("newOwner[firstName]")!.value).toBe("Ayşe");
    expect(field("newOwner[lastName]")!.value).toBe("Çelik");
    // The number is asked for and not demanded: on the examination
    // table it is the fact the counter is least likely to have.
    expect(field("newOwner[phone]")!.required).toBe(false);
    expect(field("newOwner[phoneLater]")).not.toBeNull();
  });

  // "Never mind" is the way out of a block opened by one keystroke, and
  // it has to take the intent with it -- otherwise the form still says
  // "make an animal" with nothing in it.
  it("closes again, and the animal box goes back to being a choice", () => {
    mount();
    askToCreate(/^hayvan$/i, "Limon", /Limon.*yeni hayvan aç/i);

    fireEvent.click(
      within(screen.getByRole("group", { name: /yeni hayvan: limon/i })).getByRole(
        "button",
        { name: /vazgeç/i },
      ),
    );

    expect(field("newPet[intent]")).toBeNull();
    expect(field("petId")).not.toBeNull();
  });

  // 4. Rejected, and still open. A block that shut on a rejection would
  // throw away everything typed into it and show the complaint about a
  // field that is no longer on screen.
  it("stays open when the server sends the submission home", async () => {
    server.next = {
      fieldErrors: { "newOwner[phone]": ["Telefon giriniz veya işaretleyiniz."] },
      values: {
        "newPet[intent]": "1",
        "newPet[name]": "Limon",
        "newPet[species]": "CAT",
        "newOwner[firstName]": "Ayşe",
        "newOwner[lastName]": "Çelik",
        "newOwner[phone]": "",
      },
    };
    mount();

    const el = document.querySelector("form")!;
    fireEvent.submit(el);
    expect(
      await screen.findByText(/Telefon giriniz veya işaretleyiniz\./),
    ).toBeTruthy();

    expect(field("newPet[intent]")!.value).toBe("1");
    expect(field("newPet[name]")!.value).toBe("Limon");
    expect(field("newOwner[firstName]")!.value).toBe("Ayşe");
    // The animal picked before the block was opened does not come back
    // with the rejection: the vet has moved on from it.
    expect(field("petId")!.value).toBe("");
  });

  // 5. Restored. The draft carries the hidden intent like any other
  // field, so a form that was left with the block open comes back with
  // it open -- a form that reopened empty would read as work lost.
  it("comes back open for a vet who left and returned", () => {
    window.sessionStorage.setItem(
      "pettrack.draft.v1.u-1.visit:new",
      JSON.stringify({
        "newPet[intent]": "1",
        "newPet[name]": "Limon",
        "newPet[species]": "CAT",
        "newOwner[firstName]": "Ayşe",
        chiefComplaint: "Limon kusuyor",
      }),
    );

    mount();

    expect(field("newPet[intent]")!.value).toBe("1");
    expect(field("newPet[name]")!.value).toBe("Limon");
    expect(screen.getByText("Yeni hayvan: Limon")).toBeTruthy();
    // And the owner's block with it, because a half-written client is
    // the same unsaved work as a half-written animal.
    expect(field("newOwner[firstName]")!.value).toBe("Ayşe");
  });
});
