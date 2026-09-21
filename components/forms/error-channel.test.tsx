// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

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

  it("the wrapper renders exactly one alert, and only when there is one", () => {
    // jsdom has no `scrollIntoView`; the mount effect would reach for it.
    Element.prototype.scrollIntoView = vi.fn();
    const empty = render(<ActionForm form={api({})}><input name="a" /></ActionForm>);
    expect(empty.container.querySelectorAll('[role="alert"]')).toHaveLength(0);
    empty.unmount();

    const failed = render(
      <ActionForm form={api({ error: "Kaydedilemedi." })}>
        <input name="a" />
      </ActionForm>,
    );
    const alerts = failed.container.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("Kaydedilemedi.");
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
    const alerts = container.querySelectorAll('[role="alert"]');
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
    const alerts = container.querySelectorAll('[role="alert"]');
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

  // Deliberately not asserted, because it is deliberately not done: focus
  // does not move to the box. It is `role="alert"`, so focusing it reads the
  // message a second time (`components/ui/callout.tsx`). If that trade ever
  // flips, focus and `live={false}` change together — the pair is the point.
});
