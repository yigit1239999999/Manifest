// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { ActionForm, type ActionFormApi } from "@/components/forms/action-form";
import { Callout } from "@/components/ui/callout";

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
  it("every form renders its own error", () => {
    const offenders = sources
      // `action-form.tsx` declares the hook rather than calling it: it is
      // the plumbing every form below shares, and renders no message itself.
      .filter(({ name }) => name !== "action-form.tsx")
      .filter(({ source }) => source.includes("useActionForm("))
      .filter(
        ({ source }) =>
          !source.includes("state.error") ||
          !source.includes('variant="danger"'),
      )
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
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
  function api(state: ActionFormApi["state"]): ActionFormApi {
    return {
      state,
      pending: false,
      formAction: () => {},
      reset: () => {},
      clearFieldError: () => {},
      resetToken: 0,
      reportHomelessErrors: () => {},
    };
  }

  function harness(state: ActionFormApi["state"]) {
    return (
      <ActionForm form={api(state)}>
        {state.error && <Callout variant="danger">{state.error}</Callout>}
        <input name="name" />
      </ActionForm>
    );
  }

  function spy() {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    return scrollIntoView;
  }

  it("scrolls the box into view when an error arrives", () => {
    const scrollIntoView = spy();
    const { rerender } = render(harness({}));
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(harness({ error: "Bir şeyler ters gitti." }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    // `nearest` and nothing else: a box already on screen must not move the
    // page under a user who can see it perfectly well.
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ block: "nearest" });
  });

  it("scrolls again when the next submit fails differently", () => {
    const scrollIntoView = spy();
    const { rerender } = render(harness({ error: "İlk hata." }));
    rerender(harness({ error: "İkinci hata." }));

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("stays put while the user is typing", () => {
    const scrollIntoView = spy();
    const error = "Bir şeyler ters gitti.";
    const { rerender } = render(harness({ error }));
    // Fixing one field re-renders the form with the same error still shown.
    rerender(harness({ error, fieldErrors: { name: ["Zorunlu."] } }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("smooths the scroll by default", () => {
    const scrollIntoView = spy();
    render(harness({ error: "Bir şeyler ters gitti." }));
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
      render(harness({ error: "Bir şeyler ters gitti." }));

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
