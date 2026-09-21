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

// The words on the radios are not the words on a record's page. Here they
// are the question a receptionist reads out and the answers they hear
// back; there the same three states are being reported to somebody with
// nobody to ask. Both sets live under `consent`, and this is the form's.
const answer = tr.client.consent.answer;

describe("the client's notification consent", () => {
  it("starts unanswered on a new client, and says so", () => {
    renderForm();

    expect(
      screen.getByRole("radio", { name: answer.granted }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("radio", { name: answer.declined }),
    ).not.toBeChecked();
    expect(screen.getByText(consent.unansweredHint)).toBeInTheDocument();

    // "Not asked" is now a radio of its own, and it starts selected.
    //
    // This reverses what stood here, so the old reason is worth keeping:
    // making the absence of an answer selectable was said to give the
    // clinic two ways to record the same nothing. That is still true of
    // the STORED value -- both write null, and the schema is what keeps
    // them one -- but it was never true of the reader. An empty radio
    // group reads as a form somebody has not finished, not as a state
    // somebody recorded, and the vet said what an unfinished-looking
    // control does at the counter: "if you force me I will tick one at
    // random, and that means messaging someone who never agreed."
    //
    // So the third radio does not add a stored state. It stops the one
    // we already had from looking like a mistake.
    expect(
      screen.getByRole("radio", { name: answer.unanswered }),
    ).toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("tells the vet what a yes buys, not only what a no costs", () => {
    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: answer.granted }));
    expect(screen.getByText(consent.grantedHint)).toBeInTheDocument();
    expect(screen.queryByText(consent.unansweredHint)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: answer.declined }));
    expect(screen.getByText(consent.declinedHint)).toBeInTheDocument();
  });

  it("distinguishes a recorded no from an unanswered one", () => {
    renderForm({ client: client(false) });

    expect(screen.getByRole("radio", { name: answer.declined })).toBeChecked();
    // The sentence is the declined one, not the unanswered one. Both end
    // in no messages being sent; only one of them is still a question.
    expect(screen.getByText(consent.declinedHint)).toBeInTheDocument();
    expect(screen.queryByText(consent.unansweredHint)).not.toBeInTheDocument();
  });

  it("reopens a recorded yes as a yes", () => {
    renderForm({ client: client(true) });

    expect(screen.getByRole("radio", { name: answer.granted })).toBeChecked();
    expect(screen.getByText(consent.grantedHint)).toBeInTheDocument();
  });

  it("submits under one name, so the server reads one field", () => {
    renderForm();

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(new Set(radios.map((r) => r.name))).toEqual(
      new Set(["notificationsOptIn"]),
    );
    // The wire format, asserted because the other half of it is in
    // `modules/clients/schema.ts` and the two have to agree. The empty
    // value is what carries "not asked": the schema turns anything that
    // is not "true" or "false" into no value at all, so the third radio
    // and an untouched form arrive at the column as the same null.
    expect(radios.map((r) => r.value)).toEqual(["true", "false", ""]);
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
    // All three, including the one that is selected on arrival: the
    // sentence is about what happens next, and "nothing is sent until
    // an answer is recorded" is the most useful of the three to hear.
    for (const name of [answer.granted, answer.declined, answer.unanswered]) {
      expect(
        screen.getByRole("radio", { name }).getAttribute("aria-describedby"),
      ).toBe(note.id);
    }
  });

  it("follows the answer, so what is read is what is true", () => {
    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: answer.granted }));
    const note = screen.getByText(consent.grantedHint);
    expect(
      screen
        .getByRole("radio", { name: answer.granted })
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
