// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render as rtlRender } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

// `useActionForm` refreshes the route after a successful submit, so the
// hook-level test below needs a router to exist.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

import {
  ActionForm,
  useActionForm,
  type ActionFormApi,
} from "@/components/forms/action-form";

// Where a failed submit is reported, and what happens when it is.
//
// The rule these tests hold: **a rejected submit is reported inside the
// form, a successful one in a toast.** It was broken in both directions at
// once. Thirteen forms called `toast.error`, five of them inside collapsible
// `<details>` blocks on `/visits/[id]` and `/pets/[id]` — the user is looking
// at the block they just opened while the message appears in a corner and
// then leaves, taking the only account of what went wrong with it. Four of
// the thirteen shouted on both channels, which is worse than either alone:
// the same sentence twice, one copy of it disappearing.
//
// Written as a test and not as a note on the task, because the next form is
// written by copying the one next to it (TEAM.md #6).

// `import.meta.url` is an http URL under the jsdom environment this file
// needs for the second half, so the scan is anchored on the project root.
const formsDir = join(process.cwd(), "components/forms");

// `ActionForm` now names the summary it draws ("two fields need your
// attention"), so it needs messages. Wrapped here rather than at each
// call site, so that a test written later cannot forget and then read
// the missing-context crash as a defect in the form.
const intl = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="tr" messages={tr}>
    {ui}
  </NextIntlClientProvider>
);
const render = (ui: React.ReactNode) => {
  const view = rtlRender(intl(ui));
  return { ...view, rerender: (next: React.ReactNode) => view.rerender(intl(next)) };
};

const sources = readdirSync(formsDir)
  .filter((f) => f.endsWith("-form.tsx"))
  .map((f) => ({ name: f, source: readFileSync(join(formsDir, f), "utf8") }));

/** Lines that are code — a rule may be discussed in a comment. */
function codeLines(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line));
}

function api(state: ActionFormApi["state"]): ActionFormApi {
  return {
    state,
    pending: false,
    formAction: () => {},
    reset: () => {},
    clearFieldError: () => {},
    resetToken: 0,
    responseToken: 0,
    reportHomelessErrors: () => {},
  };
}

describe("a submission error is shown in the form, not in a toast", () => {
  it("finds the forms at all, so an empty scan cannot pass", () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it("no form reports a submission error through a toast", () => {
    const offenders = sources
      .filter(({ source }) =>
        codeLines(source).some((line) => line.includes("toast.error")),
      )
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  // The other half of the same rule, and the reason it is a separate
  // assertion: deleting the toast without putting the message on screen
  // would pass the test above and leave the user with nothing at all —
  // a submit that really does look like it did nothing.
  //
  // The check is on `state.error` rather than on the box, because the rule
  // is about *who reports a failed submit*, not about which forms may draw
  // a red box. `invoice-form` is the case that makes the difference: a
  // legitimate `danger` box for something other than the submit result
  // would fail a count of boxes and passes this.
  it("no form reads the submission error itself", () => {
    const offenders = sources
      // `action-form.tsx` is the one that owns it.
      .filter(({ name }) => name !== "action-form.tsx")
      .filter(({ source }) =>
        codeLines(source).some((line) => line.includes("state.error")),
      )
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it("the wrapper renders exactly one error box, and only when there is one", () => {
    // jsdom has no `scrollIntoView`; the mount effect would reach for it.
    Element.prototype.scrollIntoView = vi.fn();
    const empty = render(<ActionForm form={api({})}><input name="a" /></ActionForm>);
    expect(empty.container.querySelectorAll("[data-form-error]")).toHaveLength(
      0,
    );
    empty.unmount();

    const failed = render(
      <ActionForm form={api({ error: "Kaydedilemedi." })}>
        <input name="a" />
      </ActionForm>,
    );
    const alerts = failed.container.querySelectorAll("[data-form-error]");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("Kaydedilemedi.");
    // Not a live region, and this is the deliberate half of the change.
    // The box takes focus now, and a focused `role="alert"` is read
    // twice in some screen reader and browser pairings. One channel or
    // the other, never both (see `callout.tsx`).
    expect(alerts[0].getAttribute("role")).toBeNull();
    expect(alerts[0].getAttribute("tabindex")).toBe("-1");
    // Spans whatever the grid turns out to be. Six forms carried
    // `sm:col-span-2` by hand, which was right until a grid grew a third
    // column.
    expect(alerts[0].className).toContain("col-span-full");
  });

  // Success stays where it was. A toast is right for it: nothing needs
  // reading twice, nothing needs fixing, and the form is often gone.
  it("success is still announced, so this was not a blanket removal", () => {
    const withToast = sources.filter(({ source }) =>
      source.includes("toast.success"),
    );

    expect(withToast.length).toBeGreaterThan(5);
  });
});

describe("a new error is brought into view", () => {
  // Reported by ux: on a long form the box sits at the top and the submit
  // button is far below it, so the page stayed exactly as it was. The only
  // thing that happened was a `role="alert"`, which means a screen reader
  // user was told and a sighted user was not.
  // Keyed on the response, not the message: the same rejection twice is
  // two events and has to be shown twice.
  function harness(state: ActionFormApi["state"], responseToken = 1) {
    return (
      <ActionForm form={{ ...api(state), responseToken }}>
        <input name="name" />
      </ActionForm>
    );
  }

  /**
   * Mounts a clean form and then lets one response come back, which is the
   * only order this ever happens in. A message present at first paint did
   * not arrive and is deliberately not scrolled to.
   */
  function submit(state: ActionFormApi["state"]) {
    const view = render(harness({}, 0));
    view.rerender(harness(state, 1));
    return view;
  }

  function spy() {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    return scrollIntoView;
  }

  it("scrolls the box into view when an error arrives", () => {
    const scrollIntoView = spy();
    const { rerender } = render(harness({}, 0));
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(harness({ error: "Bir şeyler ters gitti." }, 1));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    // `nearest` and nothing else: a box already on screen must not move the
    // page under a user who can see it perfectly well.
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ block: "nearest" });
  });

  it("scrolls again when the same submit fails the same way twice", () => {
    // The case that a comparison on the message would miss, and the one
    // that matters most: the user changes nothing, submits again, and gets
    // the identical sentence back. Nothing moving would read as nothing
    // having happened.
    const scrollIntoView = spy();
    const error = "Aynı hata.";
    const { rerender } = submit({ error });
    rerender(harness({ error }, 2));

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("stays put while the user is typing", () => {
    const scrollIntoView = spy();
    const error = "Bir şeyler ters gitti.";
    const { rerender } = submit({ error });
    // Fixing one field re-renders the form without a new server response.
    rerender(harness({ error, fieldErrors: { name: ["Zorunlu."] } }, 1));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("folds a field error with nowhere to land into the same alert", () => {
    // The real path, through the hook: `lines` is not the name of any
    // control here, so `ActionForm` reports it as homeless and the hook
    // has to put it somewhere. It used to go in only when there was no
    // form-level message, so a submit that failed for two reasons showed
    // one — and `invoice-form` covered the gap with a second red box that
    // duplicated the first whenever there was only one reason.
    function Harness() {
      const form = useActionForm(async () => ({}), {
        error: "Müşteri seçin.",
        fieldErrors: { lines: ["2. kalemin fiyatı eksik."] },
      });
      return (
        <ActionForm form={form}>
          <input name="clientId" />
        </ActionForm>
      );
    }

    const { container } = render(<Harness />);
    const alerts = container.querySelectorAll('[data-form-error]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("Müşteri seçin.");
    expect(alerts[0]).toHaveTextContent("2. kalemin fiyatı eksik.");
  });

  it("shows both reasons when a submit fails for two, in one alert", () => {
    // `invoice-form` is why: `fieldErrors.lines` has no control to sit
    // under, so it is folded into the form-level message. It used to be
    // folded only when there was no form-level message, which silently
    // dropped it whenever a submit failed for two reasons at once — and
    // the form worked around that with a second red box saying the same
    // thing as the first whenever there was only one reason.
    const { container } = render(
      <ActionForm
        form={{
          ...api({
            error: "Müşteri seçin. 2. kalemin fiyatı eksik.",
          }),
          responseToken: 1,
        }}
      >
        <input name="clientId" />
      </ActionForm>,
    );
    const alerts = container.querySelectorAll('[data-form-error]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("Müşteri seçin.");
    expect(alerts[0]).toHaveTextContent("2. kalemin fiyatı eksik.");
  });

  it("does not scroll to a message that was already on the page", () => {
    // Nothing arrived, so nothing needs pointing at.
    const scrollIntoView = spy();
    render(harness({ error: "Sunucudan gelen hata." }, 0));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("smooths the scroll by default", () => {
    const scrollIntoView = spy();
    submit({ error: "Bir şeyler ters gitti." });
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({
      behavior: "smooth",
    });
  });

  it("still scrolls under reduced motion, without the animation", () => {
    // The movement is what tells a sighted user something happened, so it
    // is not decoration and it is not what gets dropped. Only the easing
    // is.
    const scrollIntoView = spy();
    // jsdom has no `matchMedia` at all, which is why the component calls it
    // with `?.` — and why the test above sees "smooth". Assigning it rather
    // than spying is the only way to have one here.
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;

    try {
      submit({ error: "Bir şeyler ters gitti." });

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.calls[0][0]).toMatchObject({
        block: "nearest",
        behavior: "auto",
      });
    } finally {
      window.matchMedia = original;
    }
  });

  // The trade flipped, and it flipped as a pair, which was the point.
  //
  // This block used to say focus deliberately does not move, because the
  // box is `role="alert"` and focusing it reads the message twice. What
  // was not known then is where focus actually went: `SubmitButton`
  // disabled itself on press, and a control disabled under the user's
  // finger drops focus to `body`. ux measured the disabling at under
  // 150ms and the focus loss as permanent — 22 Tab presses from `body`
  // to the first bad field, with nothing announced on the way.
  //
  // So focus moves to the box and the box is no longer a live region.
  // Neither half is safe alone: focus without dropping the role reads
  // twice, dropping the role without focus says nothing at all.
  it("puts the cursor on the box, so the way back is one Tab and not 22", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const view = render(harness({}, 0));
    view.rerender(harness({ error: "Kaydedilemedi." }, 1));

    const box = view.container.querySelector("[data-form-error]");
    expect(box).not.toBeNull();
    expect(document.activeElement).toBe(box);
  });

  it("leaves focus alone when the submit succeeded", () => {
    // There is no box, and the page is on its way somewhere else.
    // Taking focus from whatever it becomes would be its own defect.
    Element.prototype.scrollIntoView = vi.fn();
    const view = render(harness({}, 0));
    const before = document.activeElement;
    view.rerender(harness({ success: true }, 1));

    expect(view.container.querySelector("[data-form-error]")).toBeNull();
    expect(document.activeElement).toBe(before);
  });
});

// The summary is the other half of the 22 Tabs: a way back to each field
// that needs fixing, from the place focus now lands.
describe("what the box says when fields are wrong", () => {
  function harness(state: ActionFormApi["state"], responseToken = 1) {
    return (
      <ActionForm form={{ ...api(state), responseToken }}>
        <label htmlFor="name-1">İsim</label>
        <input id="name-1" name="name" />
        <label htmlFor="phone-1">Telefon</label>
        <input id="phone-1" name="phone" />
      </ActionForm>
    );
  }

  it("puts the cursor on the summary, not on the first bad field", async () => {
    // The case the earlier focus test could not see. That one gave the
    // form a `state.error`, so the box was on screen the instant the
    // response landed. With only field errors the box is a render
    // late — the summary is built from the DOM — and focus used to
    // settle on the first invalid control before it arrived.
    //
    // It looked fine: not `body`, and zero Tabs to the first bad
    // field. What it cost was the count. A screen reader said "Name,
    // required" and never said that two fields were wrong, because the
    // box is not a live region either. ux measured it as one `focusin`
    // event, to `INPUT[firstName]`.
    Element.prototype.scrollIntoView = vi.fn();
    const view = render(harness({}, 0));
    view.rerender(
      harness({ fieldErrors: { name: ["Zorunlu."], phone: ["Geçersiz."] } }, 1),
    );
    await act(async () => {});

    const box = view.container.querySelector("[data-form-error]");
    expect(box).not.toBeNull();
    expect(document.activeElement).toBe(box);
  });

  it("still lands somewhere when every error belongs to a field it cannot show", async () => {
    // ux's question about the wait: what if the box never comes?
    //
    // An error for a field this form does not render gets no summary
    // line on purpose — a link to a field that is not on the page is
    // worse than no link. If that were the only kind of error, the
    // summary would be empty and the wait could hang forever, and the
    // silence would fall in the case where the user can see least.
    //
    // It does not, because the message is not dropped either: it goes
    // into the box's first sentence by the homeless route. This is the
    // assertion that the second route wakes the wait up.
    Element.prototype.scrollIntoView = vi.fn();
    const view = render(harness({}, 0));

    // The response lands with an error that has no field to sit under,
    // so there is no summary line and nothing to focus yet. The fake
    // api here does not fold homeless messages — that is the real
    // hook's job and it has its own test above — so the arrival is
    // modelled directly: same response, box one render later.
    const errors = { fieldErrors: { clinicId: ["Bulunamadı."] } };
    view.rerender(harness(errors, 1));
    await act(async () => {});
    expect(view.container.querySelector("[data-form-error]")).toBeNull();
    // Nothing has been grabbed in the meantime. The old behaviour took
    // the first invalid control; there is none here, and taking one
    // would have been wrong anyway.
    expect(document.activeElement).toBe(document.body);

    view.rerender(harness({ ...errors, error: "Bulunamadı." }, 1));
    await act(async () => {});

    const box = view.container.querySelector("[data-form-error]");
    expect(box).not.toBeNull();
    expect(document.activeElement).toBe(box);
  });

  it("names the control a person can see, not the input carrying the value", async () => {
    // ux produced the hard case and measured the right thing rather
    // than the obvious one. The box was printing "ownerId" and
    // "species" on a form where both controls are properly labelled,
    // and the tempting reading was "so they are unlabelled". They are
    // not: a combobox and a chip group each submit through a hidden
    // input, and the label belongs to the visible control beside it,
    // under a different id.
    Element.prototype.scrollIntoView = vi.fn();
    const view = render(
      <ActionForm
        form={{ ...api({ fieldErrors: { ownerId: ["Sahibi seçiniz."] } }), responseToken: 1 }}
      >
        <div>
          <label htmlFor="owner-visible">Sahibi</label>
          <input id="owner-visible" type="text" />
          <input type="hidden" name="ownerId" value="" />
        </div>
      </ActionForm>,
    );
    await act(async () => {});

    expect(view.container.querySelector("[data-form-error]")).toHaveTextContent(
      "Sahibi: Sahibi seçiniz.",
    );
  });

  it("asks a group for its own name, since it has no label element", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const view = render(
      <ActionForm
        form={{ ...api({ fieldErrors: { species: ["Tür gerekli."] } }), responseToken: 1 }}
      >
        <div role="group" aria-label="Tür">
          <input type="hidden" name="species" value="" />
          <button type="button">Kedi</button>
        </div>
      </ActionForm>,
    );
    await act(async () => {});

    expect(view.container.querySelector("[data-form-error]")).toHaveTextContent(
      "Tür: Tür gerekli.",
    );
  });

  it("still prints the raw name when there is no name anywhere", async () => {
    // The ugly fallback stays, and being ugly is what made the defect
    // above visible in the first place. It just means what it says
    // now — no name at all — rather than "the name is elsewhere".
    Element.prototype.scrollIntoView = vi.fn();
    const view = render(
      <ActionForm
        form={{ ...api({ fieldErrors: { petId: ["Gerekli."] } }), responseToken: 1 }}
      >
        <input type="hidden" name="petId" value="" />
      </ActionForm>,
    );
    await act(async () => {});

    expect(view.container.querySelector("[data-form-error]")).toHaveTextContent(
      "petId: Gerekli.",
    );
  });

  it("counts the fields and names each one", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const view = render(harness({}, 0));
    view.rerender(
      harness(
        {
          fieldErrors: { name: ["Zorunlu."], phone: ["Geçersiz numara."] },
        },
        1,
      ),
    );

    const box = view.container.querySelector("[data-form-error]")!;
    expect(box).toHaveTextContent("2 alanı düzeltmeniz gerekiyor");
    expect(box).toHaveTextContent("İsim: Zorunlu.");
    expect(box).toHaveTextContent("Telefon: Geçersiz numara.");
  });

  it("sends the cursor to the field a line names", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const view = render(harness({}, 0));
    view.rerender(harness({ fieldErrors: { phone: ["Geçersiz numara."] } }, 1));

    const link = view.getByRole("button", { name: "Telefon alanına git" });
    link.click();

    expect(document.activeElement).toBe(
      view.container.querySelector('input[name="phone"]'),
    );
  });

  it("says nothing about a field this form does not render", () => {
    // That message has nowhere to send anyone, so it stays in the
    // box's first line where the homeless errors already go — a link
    // to a field that is not on the page is worse than no link.
    Element.prototype.scrollIntoView = vi.fn();
    const view = render(harness({}, 0));
    view.rerender(harness({ fieldErrors: { clinicId: ["Bulunamadı."] } }, 1));

    expect(
      view.queryByRole("button", { name: /alanına git/ }),
    ).toBeNull();
  });
});
