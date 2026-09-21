// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/clients/actions", () => ({
  createClientAction: async () => ({}),
  updateClientAction: async () => ({}),
}));

import { ClientForm } from "@/components/forms/client-form";
import type { Client } from "@/generated/prisma/client";

// Consent is a record of something a client said, and a record has three
// states. A checkbox has two. The one it cannot hold is the one the
// clinic actually starts from: nobody has asked yet.
//
// Unanswered and declined produce the same silence, which is why the
// checkbox survived — nothing visibly broke. They are not the same fact.
// One is work still on the list; the other is a closed question, and
// answering it again is how a clinic messages someone who refused.
//
// So the assertions here are about the *third* state above all: that a
// new client arrives with neither answer selected, and that the form
// says so in words rather than leaving an empty control to be read as a
// no.

function client(optIn: boolean): Client {
  return { id: "c1", notificationsOptIn: optIn } as Client;
}

function renderForm(props: { client?: Client } = {}, locale: "tr" | "en" = "tr") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "tr" ? tr : en}>
      <ClientForm {...props} />
    </NextIntlClientProvider>,
  );
}

const consent = tr.client.consent;

describe("the client's notification consent", () => {
  it("starts unanswered on a new client, and says so", () => {
    renderForm();

    const granted = screen.getByRole("radio", { name: consent.granted });
    const declined = screen.getByRole("radio", { name: consent.declined });

    expect(granted).not.toBeChecked();
    expect(declined).not.toBeChecked();
    expect(screen.getByText(consent.unansweredHint)).toBeInTheDocument();

    // No third radio. Making "not asked" selectable turns the absence of
    // an answer into an answer, and the clinic would then have two ways
    // to record the same nothing.
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("tells the vet what a yes buys, not only what a no costs", () => {
    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: consent.granted }));
    expect(screen.getByText(consent.grantedHint)).toBeInTheDocument();
    expect(screen.queryByText(consent.unansweredHint)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: consent.declined }));
    expect(screen.getByText(consent.declinedHint)).toBeInTheDocument();
  });

  it("distinguishes a recorded no from an unanswered one", () => {
    renderForm({ client: client(false) });

    expect(screen.getByRole("radio", { name: consent.declined })).toBeChecked();
    // The sentence is the declined one, not the unanswered one. Both end
    // in no messages being sent; only one of them is still a question.
    expect(screen.getByText(consent.declinedHint)).toBeInTheDocument();
    expect(screen.queryByText(consent.unansweredHint)).not.toBeInTheDocument();
  });

  it("reopens a recorded yes as a yes", () => {
    renderForm({ client: client(true) });

    expect(screen.getByRole("radio", { name: consent.granted })).toBeChecked();
    expect(screen.getByText(consent.grantedHint)).toBeInTheDocument();
  });

  it("submits under one name, so the server reads one field", () => {
    renderForm();

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => r.name)).toEqual([
      "notificationsOptIn",
      "notificationsOptIn",
    ]);
    // The wire format, asserted because the other half of it is in
    // `modules/clients/schema.ts` and the two have to agree. Neither
    // being present is what the server reads as unanswered.
    expect(radios.map((r) => r.value)).toEqual(["true", "false"]);
  });

  it("names the question, in both languages", () => {
    const { unmount } = renderForm();
    expect(
      screen.getByRole("group", { name: tr.client.consent.legend }),
    ).toBeInTheDocument();
    unmount();

    renderForm({}, "en");
    expect(
      screen.getByRole("group", { name: en.client.consent.legend }),
    ).toBeInTheDocument();
  });
});

// The sentence under the radios was visible and silent.
//
// It is the only place the form says what happens next — "no automatic
// messages until an answer is recorded", "reminders are sent to this
// client" — and a screen reader never reached it. Three states written
// out carefully in two languages, for readers who could see them.
describe("the consequence is announced, not only printed", () => {
  it("describes each radio by the line that says what happens", () => {
    renderForm();

    const note = screen.getByText(consent.unansweredHint);
    expect(note.id).toBeTruthy();
    for (const answer of [consent.granted, consent.declined]) {
      expect(
        screen.getByRole("radio", { name: answer }).getAttribute(
          "aria-describedby",
        ),
      ).toBe(note.id);
    }
  });

  it("follows the answer, so what is read is what is true", () => {
    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: consent.granted }));
    const note = screen.getByText(consent.grantedHint);
    expect(
      screen
        .getByRole("radio", { name: consent.granted })
        .getAttribute("aria-describedby"),
    ).toBe(note.id);
  });

  it("says it once, on the control, and not twice", () => {
    // The `fieldset` deliberately does not also carry it. Two copies of
    // one sentence is not twice the information — the same call the
    // error summary makes about not being a live region as well as a
    // focus target.
    renderForm();

    expect(
      screen
        .getByRole("group", { name: consent.legend })
        .getAttribute("aria-describedby"),
    ).toBeNull();
  });
});
