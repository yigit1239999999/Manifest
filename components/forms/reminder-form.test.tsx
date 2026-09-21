// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/reminders/actions", () => ({
  createReminderAction: async () => ({}),
}));
const { searchClients, searchPets } = vi.hoisted(() => ({
  searchClients: vi.fn(async () => [] as { value: string; label: string }[]),
  searchPets: vi.fn(async () => [] as { value: string; label: string }[]),
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

const CLIENTS = [
  { id: "c-1", firstName: "Ayşe", lastName: "Demir" },
  { id: "c-2", firstName: "Mehmet", lastName: "Kaya" },
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
    searchClients.mockResolvedValue([{ value: "c-9", label: "Zeynep Yılmaz" }]);
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
