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
import { clientSchema } from "@/modules/clients/schema";
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

    // Three radios, and none of them selected on arrival.
    //
    // The third exists so that putting the question off is something a
    // reader can DO rather than something they leave behind -- the
    // vet's case is "sometimes I cannot ask, the animal is in a bad way
    // and the owner is crying". It does not start selected, because a
    // default is a light kind of forcing and unasked is not one of the
    // three answers; it is the absence of one.
    //
    // Both an untouched form and the third radio reach the column as
    // null, and that is not two ways of recording one thing. The
    // difference lives on screen: a question nobody reached against a
    // question somebody decided to leave.
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
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

/**
 * Which boxes the form insists on, checked against what the server will
 * actually refuse.
 *
 * The two halves moved together and in opposite directions: the surname
 * stopped being required and the phone started. The vet's account is the
 * whole reason and it is about the quality of what gets stored, not
 * about convenience -- "I do not know the surname of the lady who
 * brings the stray, and it would be rude to ask; but if I do not take
 * her number I will never find that animal again. Force the surname and
 * I will type a full stop, and the record is rubbish."
 *
 * Asserted on the rendered form because the browser is what stops the
 * reader, and a `required` marker that disagrees with
 * `modules/clients/schema.ts` fails in the worse direction either way:
 * a form that submits and is refused by the server, or a form that
 * blocks on a field the server would have accepted.
 */
describe("what the counter has to fill in", () => {
  it("insists on the name and the number, and on nothing else", () => {
    const { container } = renderForm();

    const required = [...container.querySelectorAll("[required]")]
      .map((el) => el.getAttribute("name"))
      .filter((n): n is string => Boolean(n));

    expect(new Set(required)).toEqual(new Set(["firstName", "phone"]));
  });

  it("does not insist on the consent answer", () => {
    const { container } = renderForm();

    // "If you force me I will tick one at random, and that means
    // messaging someone who never agreed." A forced answer here is
    // worse than no answer, because it cannot be told from a real one.
    for (const radio of container.querySelectorAll(
      'input[name="notificationsOptIn"]',
    )) {
      expect(radio).not.toHaveAttribute("required");
    }
  });
});

/**
 * The third radio costs nothing, and this is what keeps it free.
 *
 * "Not now" submits an empty string, and `tristate` in `lib/forms.ts`
 * turns anything that is not "true" or "false" into no value at all. So
 * the column stays three-valued and no consumer of it learns a new
 * state. The whole distinction lives on screen -- a question nobody
 * reached against one somebody decided to leave.
 *
 * That freedom rests entirely on `tristate` staying lenient. Tightened
 * to reject the empty string, this form would start failing validation
 * with nothing on screen to say why, and the person tightening it would
 * have no reason to suspect the client form at all. A note would not
 * have stopped that: today a documented trap in `button.tsx` cost
 * another cycle, and a hand-checked list of example names let a second
 * bad one through. So it is a test, and the test says why.
 */
describe("what the third answer sends", () => {
  it("submits an empty value that the schema reads as no answer", () => {
    const parsed = clientSchema.safeParse({
      firstName: "Ayşe",
      phone: "0532 111 22 33",
      notificationsOptIn: "",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.notificationsOptIn).toBeUndefined();
  });

  it("reads an untouched form the same way", () => {
    const parsed = clientSchema.safeParse({
      firstName: "Ayşe",
      phone: "0532 111 22 33",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.notificationsOptIn).toBeUndefined();
  });

  it("is the value the third radio actually carries", () => {
    const { container } = renderForm();

    const radios = [
      ...container.querySelectorAll<HTMLInputElement>(
        'input[name="notificationsOptIn"]',
      ),
    ];

    // Asserted against the rendered control rather than the constant, so
    // the two tests above cannot go on passing about a value the form
    // has stopped sending.
    expect(radios.map((r) => r.value)).toContain("");
  });
});
