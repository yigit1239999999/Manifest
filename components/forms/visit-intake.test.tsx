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
    expect(screen.getByRole("group", { name: "Yeni hayvan" })).toBeTruthy();
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

  /**
   * The row that offers to create, and which of two things it offers.
   *
   * The animal picker matches the owner's name as well as the
   * animal's, because that is how a vet looks for one. So "Ayşe" typed
   * into it brings up Ayşe's animals -- and used to offer, underneath
   * them, to create an ANIMAL called Ayşe. One click and the clinic
   * has a cat named after a person, which is the duplicate family this
   * picker exists to prevent wearing a different coat.
   *
   * Decided here rather than in the picker: the row's caption is
   * "Ayşe Yılmaz · 7 ay önce", so a picker that knew only "the caption
   * matched" could not tell a person from a date.
   */
  describe("what the create row offers", () => {
    it("offers an animal by that name when an animal has one", () => {
      mount();
      const box = screen.getByLabelText(/^hayvan$/i);
      fireEvent.focus(box);
      fireEvent.change(box, { target: { value: "Zeytin" } });

      expect(
        screen.getByRole("option", { name: /"Zeytin" adıyla yeni hayvan aç/ }),
      ).toBeTruthy();
    });

    it("offers an animal FOR the owner when only an owner has one", () => {
      mount();
      askToCreate(/^hayvan$/i, "Ayşe", /sahibi: Ayşe Yılmaz/);

      // The name is the work that is left, and the cursor is on it.
      expect(field("newPet[name]")!.value).toBe("");
      expect(document.activeElement).toBe(field("newPet[name]"));
      // The owner is not asked for twice: one exact hit in the list is
      // a choice already made in every sense but the click.
      expect(field("newPet[ownerId]")!.value).toBe("c-1");
    });

    // The picker above is remounted as the block opens -- that is what
    // empties the animal somebody moved on from -- and a focused input
    // removed from the document drops focus to `body`. pm measured
    // eleven samples of exactly that: a block on screen with nowhere
    // to type, and for a keyboard user nothing under the cursor at all.
    it("brings the cursor with it, onto the answer that is missing", () => {
      mount();
      askToCreate(/^hayvan$/i, "Limon", /Limon.*yeni hayvan aç/i);

      // Named already, so the species is the first thing nobody has
      // said. The chip with the keyboard's stop on it, which is where
      // an arrow key would have gone.
      expect(document.activeElement).toBe(
        document.querySelector('[role="group"] button[tabindex="0"]'),
      );
      expect(document.activeElement).not.toBe(document.body);
    });

    it("falls back to the animal when two owners answer to the name", () => {
      const container = document.createElement("div");
      document.body.querySelector("main")!.appendChild(container);
      render(
        <NextIntlClientProvider locale="tr" messages={tr}>
          <VisitForm
            pets={[
              { id: "p-1", name: "Zeytin", ownerName: "Ayşe Yılmaz" },
              { id: "p-2", name: "Pamuk", ownerName: "Ayşe Çelik" },
            ]}
            vets={VETS}
            owners={OWNERS}
            speciesChoices={SPECIES_CHOICES}
            canCreatePet
            canCreateOwner
          />
        </NextIntlClientProvider>,
        { container },
      );

      const box = screen.getByLabelText(/^hayvan$/i);
      fireEvent.focus(box);
      fireEvent.change(box, { target: { value: "Ayşe" } });

      // Guessing between two Ayşes is how the wrong record gets the
      // visit, so it guesses at neither.
      expect(
        screen.getByRole("option", { name: /"Ayşe" adıyla yeni hayvan aç/ }),
      ).toBeTruthy();
    });
  });

  // 3. Open, with an owner being written down in the same breath.
  it("opens the owner from the same box, one block further in", () => {
    mount();
    askToCreate(/^hayvan$/i, "Limon", /Limon.*yeni hayvan aç/i);
    askToCreate(/^sahibi$/i, "Ayşe Çelik", /Ayşe Çelik.*yeni müşteri aç/i);

    expect(field("newOwner[intent]")!.value).toBe("1");
    expect(screen.getByRole("heading", { name: "Yeni sahip" })).toBeTruthy();
    // Split at the first space, both halves editable: a guess costs a
    // keystroke, retyping the name costs the thing the vet complained
    // about.
    expect(field("newOwner[firstName]")!.value).toBe("Ayşe");
    expect(field("newOwner[lastName]")!.value).toBe("Çelik");
    // The number is asked for and not demanded: on the examination
    // table it is the fact the counter is least likely to have.
    expect(field("newOwner[phone]")!.required).toBe(false);
    // The same pair the counter's own form carries, and the same one
    // way through it: a number typed in takes the tick off.
    const box = field("newOwner[phoneLater]")!;
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    fireEvent.input(field("newOwner[phone]")!, {
      target: { value: "0532 111 22 33" },
    });
    expect(box.checked).toBe(false);
  });

  // The defect this caught, which no message would have reported: the
  // owner picker kept the browser's `required` while the block that
  // answers it was open under it, so the save was refused by the
  // browser with nothing on screen to say so -- the button simply did
  // nothing. Measured on the real form before this line existed.
  it("stops insisting on the picker once the answer is being typed", () => {
    mount();
    askToCreate(/^hayvan$/i, "Limon", /Limon.*yeni hayvan aç/i);
    expect(screen.getByLabelText(/^sahibi$/i)).toBeRequired();

    askToCreate(/^sahibi$/i, "Ayşe Çelik", /Ayşe Çelik.*yeni müşteri aç/i);

    const picker = screen.getByLabelText(/^sahibi$/i) as HTMLInputElement;
    expect(picker).not.toBeRequired();
    // Still saying whose animal this is, over an empty id: the owner is
    // the one being written down below.
    expect(picker.value).toBe("Ayşe Çelik");
    expect(field("newPet[ownerId]")!.value).toBe("");
  });

  // "Never mind" is the way out of a block opened by one keystroke, and
  // it has to take the intent with it -- otherwise the form still says
  // "make an animal" with nothing in it.
  it("closes again, and the animal box goes back to being a choice", () => {
    mount();
    askToCreate(/^hayvan$/i, "Limon", /Limon.*yeni hayvan aç/i);

    fireEvent.click(
      within(screen.getByRole("group", { name: "Yeni hayvan" })).getByRole(
        "button",
        { name: /vazgeç/i },
      ),
    );

    expect(field("newPet[intent]")).toBeNull();
    // Both intents, because one button closes the whole block: an
    // owner half written down belongs to the animal that is going
    // away with it.
    expect(field("newOwner[intent]")).toBeNull();
    // And nothing of either is left in the browser. The draft is
    // written as this click bubbles past the form, so a block still in
    // the DOM at that instant comes back open tomorrow.
    const stored = JSON.parse(
      window.sessionStorage.getItem("pettrack.draft.v1.u-1.visit:new") ?? "{}",
    ) as Record<string, string>;
    expect(
      Object.keys(stored).filter((key) => key.startsWith("new")),
    ).toEqual([]);
    expect(field("petId")).not.toBeNull();
  });

  // The create row sits one keystroke from the rows above it, so it
  // gets pressed by accident -- and by then the animal has a name and a
  // species. Closing the whole block to undo the inner half would
  // charge the vet for the work they got right.
  it("closes the owner alone, leaving the animal as it was", () => {
    mount();
    askToCreate(/^hayvan$/i, "Limon", /Limon.*yeni hayvan aç/i);
    fireEvent.click(screen.getByRole("button", { name: "Kedi" }));
    askToCreate(/^sahibi$/i, "Ayşe Çelik", /Ayşe Çelik.*yeni müşteri aç/i);

    // Two ways out now, and the count is part of the assertion: the
    // block's own, and the owner's. The owner's is the second, because
    // it is further down the same form.
    const ways = screen.getAllByRole("button", { name: /vazgeç/i });
    expect(ways).toHaveLength(2);
    fireEvent.click(ways[1]);

    expect(field("newOwner[intent]")).toBeNull();
    expect(field("newOwner[firstName]")).toBeNull();
    // Everything above it survives, including the name that was typed
    // into the picker: asking for it a third time is the cost this is
    // about.
    expect(field("newPet[intent]")!.value).toBe("1");
    expect(field("newPet[name]")!.value).toBe("Limon");
    expect(field("newPet[species]")!.value).toBe("CAT");
    expect((screen.getByLabelText(/^sahibi$/i) as HTMLInputElement).value).toBe(
      "Ayşe Çelik",
    );
  });

  // The other half of closing the owner alone, and the half that is
  // invisible: what the browser was left holding.
  //
  // The draft is written by the form's own click handler as this click
  // bubbles past it, so an owner block still in the DOM at that instant
  // is stored as an OPEN branch. The vet would come back tomorrow to a
  // closed block over a draft that submits an owner they cancelled --
  // which is the defect the outer button was flushed for, copied one
  // level in.
  it("leaves nothing of the owner in the draft it was cancelled out of", () => {
    const first = mount();
    askToCreate(/^hayvan$/i, "Limon", /Limon.*yeni hayvan aç/i);
    fireEvent.click(screen.getByRole("button", { name: "Kedi" }));
    askToCreate(/^sahibi$/i, "Ayşe Çelik", /Ayşe Çelik.*yeni müşteri aç/i);

    fireEvent.click(screen.getAllByRole("button", { name: /vazgeç/i })[1]);

    const stored = JSON.parse(
      window.sessionStorage.getItem("pettrack.draft.v1.u-1.visit:new") ?? "{}",
    ) as Record<string, string>;
    expect(
      Object.keys(stored).filter((key) => key.startsWith("newOwner[")),
    ).toEqual([]);
    expect(stored["newPet[intent]"]).toBe("1");

    // And the walk back proves it: the form that comes up is the one
    // that was left, not the one before the cancel.
    first.unmount();
    mount();

    expect(field("newOwner[intent]")).toBeNull();
    expect(field("newPet[name]")!.value).toBe("Limon");
    expect(field("newPet[species]")!.value).toBe("CAT");
  });

  // A block put BACK is not a block asked for, and the difference is
  // where the reader already is. Somebody returning to a form they
  // left has their own idea of where to carry on; a page that grabs
  // the caret on load takes it from them -- the rule `focusFirstEmpty`
  // is opt-in for (`action-form.tsx`).
  it("does not take the cursor when it is a draft coming back", () => {
    window.sessionStorage.setItem(
      "pettrack.draft.v1.u-1.visit:new",
      JSON.stringify({
        "newPet[intent]": "1",
        "newPet[name]": "Limon",
        "newPet[species]": "CAT",
      }),
    );

    mount();

    expect(field("newPet[intent]")!.value).toBe("1");
    expect(document.activeElement).toBe(document.body);
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
        "newOwner[intent]": "1",
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
        "newOwner[intent]": "1",
        "newOwner[firstName]": "Ayşe",
        chiefComplaint: "Limon kusuyor",
      }),
    );

    mount();

    expect(field("newPet[intent]")!.value).toBe("1");
    expect(field("newPet[name]")!.value).toBe("Limon");
    expect(screen.getByRole("group", { name: "Yeni hayvan" })).toBeTruthy();
    // And the owner's block with it, because a half-written client is
    // the same unsaved work as a half-written animal.
    expect(field("newOwner[firstName]")!.value).toBe("Ayşe");
    // The picker above the block still says what is being made. Blank
    // there, over a hidden id the draft emptied on purpose, is the
    // state that refuses the next save with nothing on screen.
    expect((screen.getByLabelText(/^hayvan$/i) as HTMLInputElement).value).toBe(
      "Limon",
    );
    expect(screen.getByLabelText(/^hayvan$/i)).not.toBeRequired();
  });

  // The other half of a restored block: an owner who was PICKED rather
  // than written down. The draft carries the id and nothing else, so
  // the name has to be looked up again -- a full hidden input under an
  // empty box reads as a selection that was lost, and re-picking is how
  // the wrong animal gets attached to a visit.
  it("comes back saying which owner was chosen, not just holding the id", () => {
    window.sessionStorage.setItem(
      "pettrack.draft.v1.u-1.visit:new",
      JSON.stringify({
        "newPet[intent]": "1",
        "newPet[name]": "Limon",
        "newPet[species]": "CAT",
        "newPet[ownerId]": "c-1",
      }),
    );

    mount();

    expect(field("newPet[ownerId]")!.value).toBe("c-1");
    expect((screen.getByLabelText(/^sahibi$/i) as HTMLInputElement).value).toBe(
      "Ayşe Yılmaz",
    );
    expect(field("newOwner[firstName]")).toBeNull();
  });
});
