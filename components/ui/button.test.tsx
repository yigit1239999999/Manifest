// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Button } from "@/components/ui/button";

/**
 * The one thing about this component that is not visible in its output.
 *
 * A `<button>` with no `type` is a submit button, and that only shows
 * itself inside a form: something added to clear a field or add a line
 * saves the record instead, and what gets reported is "it saved when I
 * clicked X", which sends the next person looking at the form.
 *
 * Nothing in the product misbehaves today -- eight of the nine call
 * sites outside the primitive pass a type by hand, and the ninth is an
 * error boundary with no form around it. This is about the tenth call
 * site, written inside a form by somebody who does not know the
 * default, and it is a test rather than a comment because that person
 * will not be reading this file.
 */
describe("what a Button does when nobody says", () => {
  it("does not submit the form it happens to be standing in", () => {
    const { container } = render(<Button>Ekle</Button>);

    expect(container.querySelector("button")).toHaveAttribute("type", "button");
  });

  it("still lets a caller ask for submit", () => {
    // `SubmitButton` and the topbar's search both do, so a default that
    // could not be overridden would be the worse bug of the two.
    const { container } = render(<Button type="submit">Kaydet</Button>);

    expect(container.querySelector("button")).toHaveAttribute("type", "submit");
  });
});
