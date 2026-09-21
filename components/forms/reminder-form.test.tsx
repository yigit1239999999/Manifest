// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/reminders/actions", () => ({
  createReminderAction: async () => ({}),
}));

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
  { id: "p-1", name: "Karabaş", ownerId: "c-1" },
  { id: "p-2", name: "Tekir", ownerId: "c-2" },
  { id: "p-3", name: "Boncuk", ownerId: "c-1" },
];

const renderForm = (props: Record<string, unknown> = {}) =>
  render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      <ReminderForm clients={CLIENTS} pets={PETS} {...props} />
    </NextIntlClientProvider>,
  );

const petOptions = () =>
  [...screen.getByRole("combobox", { name: /hayvan/i }).querySelectorAll("option")]
    .map((o) => o.textContent?.trim())
    .filter((label) => label && label !== "Seçilmedi");

describe("choosing the animal a reminder is about", () => {
  it("offers only the chosen client's animals", () => {
    renderForm();

    fireEvent.change(screen.getByRole("combobox", { name: /müşteri/i }), {
      target: { value: "c-1" },
    });

    expect(petOptions()).toEqual(["Karabaş", "Boncuk"]);
  });

  it("names the owner only while the list is still mixed", () => {
    // Before a client is chosen the list spans owners, and two animals
    // called Karabaş are indistinguishable without it. After, every row
    // would carry the same name — confirmation turns into noise.
    renderForm();

    expect(petOptions()).toEqual([
      "Karabaş · Ayşe Demir",
      "Tekir · Mehmet Kaya",
      "Boncuk · Ayşe Demir",
    ]);
  });

  it("fills the client in when the animal is picked first", () => {
    // "Remind them about Karabaş" is the thought; whose Karabaş is a
    // detail the form can work out for itself.
    renderForm();

    fireEvent.change(screen.getByRole("combobox", { name: /hayvan/i }), {
      target: { value: "p-2" },
    });

    expect(screen.getByRole("combobox", { name: /müşteri/i })).toHaveValue("c-2");
  });

  it("drops an animal that the newly chosen client does not own", () => {
    // The dangerous order: pick the animal, then change your mind about the
    // client. Leaving the first choice in place is how a reminder gets
    // submitted against someone else's animal and refused.
    renderForm();

    fireEvent.change(screen.getByRole("combobox", { name: /hayvan/i }), {
      target: { value: "p-1" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /müşteri/i }), {
      target: { value: "c-2" },
    });

    expect(screen.getByRole("combobox", { name: /hayvan/i })).toHaveValue("");
    expect(petOptions()).toEqual(["Tekir"]);
  });
});
