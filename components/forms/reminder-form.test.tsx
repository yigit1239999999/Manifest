// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/reminders/actions", () => ({
  createReminderAction: async () => ({}),
}));
// Both actions answer with a pair now — what they found, and whether
// that was all of it. Only the server can answer the second, and the
// picker's "there is more" note depends on it.
const { searchClients, searchPets } = vi.hoisted(() => ({
  searchClients: vi.fn(async () => ({
    // Consent and number ride along with every hit, so the warning is
    // not blind on the one path a big clinic actually uses.
    options: [] as {
      value: string;
      label: string;
      phone: string | null;
      notificationsOptIn: boolean | null;
    }[],
    hasMore: false,
  })),
  searchPets: vi.fn(async () => ({
    options: [] as {
      value: string;
      label: string;
      ownerId: string;
      ownerLabel: string;
    }[],
    hasMore: false,
  })),
}));
vi.mock("@/modules/clients/actions", () => ({
  searchClientsAction: searchClients,
}));
vi.mock("@/modules/pets/actions", () => ({ searchPetsAction: searchPets }));

import { ReminderForm } from "@/components/forms/reminder-form";

// The animal list offered every animal in the clinic, whoever owned it.
//
// No data leaks: `createReminder` refuses a pet that is not the client's
// (`modules/reminders/service.ts`). What was offered was work — pick the
// wrong Karabaş out of thirty-one, fill in the title, the date and the
// note, submit, and be told no. The same class as the buttons that led to
// forms the server would reject, one level in: not a door that shuts, a
// list with the wrong things in it.

// Ayşe can be reached, so the tests about the pickers see no warning;
// Mehmet has never been asked, which is the case the warning was written
// for. The remaining two ways out of reach are handed in per test rather
// than added here, because every list assertion in this file counts these
// rows.
const CLIENTS = [
  {
    id: "c-1",
    firstName: "Ayşe",
    lastName: "Demir",
    phone: "0532 000 00 00",
    notificationsOptIn: true,
  },
  {
    id: "c-2",
    firstName: "Mehmet",
    lastName: "Kaya",
    phone: "0533 111 11 11",
    notificationsOptIn: null,
  },
];

const PETS = [
  { id: "p-1", name: "Karabaş", ownerId: "c-1", ownerName: "Ayşe Demir" },
  { id: "p-2", name: "Tekir", ownerId: "c-2", ownerName: "Mehmet Kaya" },
  { id: "p-3", name: "Boncuk", ownerId: "c-1", ownerName: "Ayşe Demir" },
];

const renderForm = (props: Record<string, unknown> = {}) =>
  render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      <ReminderForm clients={CLIENTS} pets={PETS} {...props} />
    </NextIntlClientProvider>,
  );

const picker = (field: RegExp) => screen.getByRole("combobox", { name: field });

// Scoped to the open dropdown: the type field is a native `<select>`,
// whose own children are options too.
const openOptions = () =>
  within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .map((o) => o.textContent?.trim());

// Focusing opens the list; leaving closes it, so only one picker's
// dropdown is ever on the page at a time.
function optionsOf(field: RegExp) {
  const input = picker(field);
  fireEvent.focus(input);
  const labels = openOptions();
  fireEvent.focusOut(input, { relatedTarget: null });
  return labels;
}

function choose(field: RegExp, label: string) {
  const input = picker(field);
  fireEvent.focus(input);
  fireEvent.mouseDown(screen.getByText(label));
  fireEvent.focusOut(input, { relatedTarget: null });
}

describe("choosing the animal a reminder is about", () => {
  it("offers only the chosen client's animals", () => {
    renderForm();
    choose(/müşteri/i, "Ayşe Demir");

    expect(optionsOf(/hayvan/i)).toEqual(["Karabaş", "Boncuk"]);
  });

  it("names the owner only while the list is still mixed", () => {
    // Before a client is chosen the list spans owners, and two animals
    // called Karabaş are indistinguishable without it. After, every row
    // would carry the same name — confirmation turns into noise.
    renderForm();

    expect(optionsOf(/hayvan/i)).toEqual([
      "Karabaş · Ayşe Demir",
      "Tekir · Mehmet Kaya",
      "Boncuk · Ayşe Demir",
    ]);
  });

  it("fills the client in when the animal is picked first", () => {
    // "Remind them about Karabaş" is the thought; whose Karabaş is a
    // detail the form can work out for itself.
    renderForm();
    choose(/hayvan/i, "Tekir · Mehmet Kaya");

    expect(picker(/müşteri/i)).toHaveValue("Mehmet Kaya");
  });

  it("drops an animal that the newly chosen client does not own", () => {
    // The dangerous order: pick the animal, then change your mind about the
    // client. Leaving the first choice in place is how a reminder gets
    // submitted against someone else's animal and refused.
    renderForm();
    choose(/hayvan/i, "Karabaş · Ayşe Demir");
    choose(/müşteri/i, "Mehmet Kaya");

    expect(picker(/hayvan/i)).toHaveValue("");
    expect(optionsOf(/hayvan/i)).toEqual(["Tekir"]);
  });
});

describe("reaching a record the handed list does not contain", () => {
  // Both lists arrive capped at fifty (`PAGE_SIZES.DROPDOWN`). As plain
  // selects these pickers had no search at all, so a clinic's
  // fifty-first client could not be reminded of anything: not a hard
  // error, a name that is simply not on file. The form now owns the
  // selection as a value-and-label pair, which is what lets it hold a
  // record that is on neither list.
  it("asks the server, and keeps showing what the page already sent", async () => {
    vi.useFakeTimers();
    searchClients.mockResolvedValue({
      options: [
        {
          value: "c-9",
          label: "Zeynep Yılmaz",
          phone: "0536 444 44 44",
          notificationsOptIn: true,
        },
      ],
      hasMore: false,
    });
    renderForm({ clientsCapped: true });

    const input = picker(/müşteri/i);
    fireEvent.focus(input);
    // The handed list stays on screen. The point of bringing the cap
    // down to fifty was that fifty names are worth looking through, not
    // that they should be hidden until someone types.
    expect(openOptions()).toEqual(["Ayşe Demir", "Mehmet Kaya"]);

    fireEvent.change(input, { target: { value: "Zey" } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(searchClients).toHaveBeenCalledWith("Zey");
    expect(openOptions()).toEqual(["Zeynep Yılmaz"]);
    vi.useRealTimers();
  });

  it("keeps naming an owner the client list never contained", () => {
    // The two lists are capped independently, so an animal on the
    // handed list can be owned by someone past the end of the client
    // list. Filling the client in with an id and no name is the blank
    // required field over a full hidden input all over again.
    renderForm({ clients: [], pets: PETS });
    choose(/hayvan/i, "Karabaş · Ayşe Demir");

    expect(picker(/müşteri/i)).toHaveValue("Ayşe Demir");
  });
});

// The animal picker was the one left without a search, and the reason
// was sound at the time: the server could only answer clinic-wide, and a
// clinic-wide answer behind a list already narrowed to one client offers
// animals the server will then refuse. So it was withheld exactly where
// it was needed most — the owner of a hundred animals, on the page where
// you already know whose they are.
//
// `searchPetsAction` takes the owner now. What these two assert is the
// join: that the client actually reaches the query, and that it goes on
// reaching it after the client changes. A callback closed over an empty
// client keeps searching the whole clinic, which is the same wrong
// answer arriving one step later and would look right in any test that
// only chose a client once.
describe("searching for an animal once the client is known", () => {
  // The picker waits 200ms before it asks, so the test waits longer.
  // Real timers rather than fake ones: this file renders without them
  // and the debounce is the only thing being waited on.
  async function type(field: RegExp, text: string) {
    const input = picker(field);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: text } });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 260));
    });
  }

  it("asks the server only for that client's animals", async () => {
    searchPets.mockClear();
    renderForm({ petsCapped: true });

    await choose(/müşteri/i, "Ayşe Demir");
    await type(/hayvan/i, "kar");

    expect(searchPets).toHaveBeenCalledWith("kar", "c-1");
  });

  it("follows the client when it changes", async () => {
    searchPets.mockClear();
    renderForm({ petsCapped: true });

    await choose(/müşteri/i, "Ayşe Demir");
    await type(/hayvan/i, "te");
    await choose(/müşteri/i, "Mehmet Kaya");
    await type(/hayvan/i, "te");

    expect(searchPets).toHaveBeenLastCalledWith("te", "c-2");
  });

  it("asks the whole clinic while no client is chosen", async () => {
    searchPets.mockClear();
    renderForm({ petsCapped: true });

    await type(/hayvan/i, "kar");

    // `undefined`, not `""`. The animal is the question here and the
    // owner is the answer, so narrowing to nothing would be narrowing
    // to no clinic at all.
    expect(searchPets).toHaveBeenCalledWith("kar", undefined);
  });
});

/**
 * The form says, before it writes anything, that this reminder will never
 * reach anybody.
 *
 * The vet who found this described exactly what it costs: "I can set a
 * reminder for a client with no consent and it quietly does not go. If
 * there is no consent, either stop me or tell me while I am setting it —
 * if I knew, I would pick up the phone. Right now no message goes out and
 * I do not call either, and the patient is lost between the two."
 *
 * Telling, not stopping: a reminder is a note to the vet as much as a
 * message to the owner, so the save still happens. The screen says what
 * will not happen; it does not decide for anyone.
 */
describe("warning that this reminder cannot reach anyone", () => {
  // Read the way a screen reader reads it: follow the picker's own
  // `aria-describedby` to whatever it points at. The sentence is on the
  // page twice on purpose — once as the field's description, once in the
  // live region that speaks it — so asking for it by text alone finds two
  // and says nothing about whether either is attached to the field.
  const described = () => {
    const ids = (picker(/müşteri/i).getAttribute("aria-describedby") ?? "")
      .split(" ")
      .filter(Boolean);
    return ids
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
  };
  const warning = () =>
    screen.queryByText(new RegExp(tr.reminder.unreachable.savedAnyway));

  // The picker's own 200ms debounce, waited out with real timers; the
  // same helper the animal-search block keeps for itself.
  async function typeInto(field: RegExp, text: string) {
    const input = picker(field);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: text } });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 260));
    });
  }

  it("stays quiet for a client who can be reached", () => {
    renderForm();
    choose(/müşteri/i, "Ayşe Demir");

    expect(warning()).not.toBeInTheDocument();
  });

  // `null` and `false` are different answers with different work attached,
  // and the column's own comment forbids collapsing them. Nobody asked is
  // a phone call; refused is a client to leave alone.
  it("tells a question never asked apart from a refusal", () => {
    const { unmount } = renderForm();
    choose(/müşteri/i, "Mehmet Kaya");
    expect(described()).toMatch(/hiç sorulmamış/);
    unmount();

    renderForm({
      clients: [
        {
          id: "c-9",
          firstName: "Zeynep",
          lastName: "Arslan",
          phone: "0534 222 22 22",
          notificationsOptIn: false,
        },
      ],
    });
    choose(/müşteri/i, "Zeynep Arslan");
    expect(described()).toMatch(/onayı vermemiş/);
  });

  it("warns when there is consent but no number to send to", () => {
    renderForm({
      clients: [
        {
          id: "c-9",
          firstName: "Hasan",
          lastName: "Yıldız",
          phone: null,
          notificationsOptIn: true,
        },
      ],
    });
    choose(/müşteri/i, "Hasan Yıldız");

    expect(described()).toMatch(/telefon numarası yok/);
  });

  // It has to survive the capped path, which is the one the warning would
  // otherwise be missing from — and missing exactly when the clinic got
  // big enough for the page's own list to be cut off. A warning that is
  // right often enough to be trusted and absent when it matters is worse
  // than no warning at all, which is why `searchClientsAction` carries
  // consent and number with every hit.
  // pm measured the previous shape and found it unreachable: the notice
  // sat 320px below the picker, past the date field, and the picker's
  // `aria-describedby` pointed at an element that was not in the
  // document. A vet using a screen reader chose a client and heard
  // nothing. The notice is on the field now, through the same `hint`
  // channel the title field uses.
  it("reaches the client field itself, not just the layout", () => {
    renderForm();
    choose(/müşteri/i, "Mehmet Kaya");

    expect(described()).toMatch(/hiç sorulmamış/);
  });

  // The description is read when focus ARRIVES at a control. Choosing a
  // client from the picker leaves focus exactly where it was, so a
  // describedby that changes underneath it is correct and silent -- and
  // the vet who most needs the warning is the one who never hears it.
  // The region is on the page from the start and empty, because a live
  // region that mounts together with its first message does not reliably
  // announce anything.
  it("speaks the warning at the moment the client is chosen", () => {
    const { container } = renderForm();
    const region = container.querySelector('[role="status"]')!;
    expect(region, "the region has to exist before it has anything to say")
      .not.toBeNull();
    expect(region.textContent).toBe("");

    choose(/müşteri/i, "Mehmet Kaya");
    expect(region.textContent).toMatch(/hiç sorulmamış/);

    choose(/müşteri/i, "Ayşe Demir");
    expect(region.textContent).toBe("");
  });

  it("works for a client reached through the search", async () => {
    searchClients.mockResolvedValue({
      options: [
        {
          value: "c-far",
          label: "Uzak Müşteri",
          phone: "0535 333 33 33",
          notificationsOptIn: null,
        },
      ],
      hasMore: false,
    });
    renderForm({ clientsCapped: true });

    await typeInto(/müşteri/i, "uza");
    fireEvent.mouseDown(screen.getByText("Uzak Müşteri"));

    expect(described()).toMatch(/hiç sorulmamış/);
  });
});

/**
 * One of the five types turns the title field into the message.
 *
 * `CUSTOM` puts the title into the owner's SMS word for word
 * (`lib/messaging/sms-templates.ts:87`); the other four templates ignore
 * it entirely. The field is labelled "Title" either way, which gives no
 * signal at all — "Notes" underneath it at least sounds internal. A vet
 * picking "Custom" for a job the list does not cover, and typing their
 * own shorthand, sends the owner that shorthand.
 *
 * The second half of the rule is the one worth a test: it must NOT appear
 * under the other four. A caution shown where it does not apply is spent,
 * and it is spent for every future case as well as this one.
 */
describe("the title field, when the title is the message", () => {
  const hint = () => screen.queryByText(tr.reminder.customTitleHint);
  const pickType = (value: string) =>
    fireEvent.change(screen.getByRole("combobox", { name: /tür/i }), {
      target: { value },
    });

  it("says so when the type is Custom", () => {
    renderForm();
    pickType("CUSTOM");

    expect(hint()).toBeInTheDocument();
  });

  it("says nothing under the four types that ignore the title", () => {
    renderForm();
    for (const type of ["VACCINATION_DUE", "CHECKUP", "FOLLOWUP", "BIRTHDAY"]) {
      pickType(type);
      expect(hint(), `${type} shows a hint that is not true of it`).toBeNull();
    }
  });

  // Through `Field`'s `hint`, so it is wired to `aria-describedby` rather
  // than sitting beside the input as loose text somebody driving by voice
  // never hears (TEAM.md #26).
  it("reaches the field itself, not just the layout", () => {
    renderForm();
    pickType("CUSTOM");

    const input = screen.getByRole("textbox", { name: /başlık/i });
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      tr.reminder.customTitleHint,
    );
  });
});
