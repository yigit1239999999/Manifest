// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RestoreButton } from "@/components/restore-button";

const noop = vi.fn(async () => undefined);

/**
 * The button grew a second mark when "undo" arrived beside "restore".
 *
 * Both put something back, and they are not the same act: one takes a
 * record out of the archive, the other reverses a row somebody closed on
 * the dashboard. Wearing the archive icon for the second would tell a vet
 * their vaccination had been filed away, which never happened.
 */
describe("putting something back", () => {
  const markOf = (r: ReturnType<typeof render>) =>
    r.container.querySelector("svg")?.getAttribute("class");

  it("does not wear the archive mark for an undo", () => {
    const archive = render(<RestoreButton action={noop} label="Geri yükle" />);
    const undo = render(
      <RestoreButton action={noop} label="Geri al" mark="undo" />,
    );

    expect(markOf(archive)).not.toBeUndefined();
    expect(markOf(undo)).not.toBe(markOf(archive));
  });

  // Ten vaccinations on one page carry ten buttons reading "Undo", and by
  // voice they are one button ten times over. The visible label stays
  // short because the row is dense; the name says which row it belongs
  // to (TEAM.md #26), the same split every other row action here uses.
  it("takes a name that says which row it belongs to", () => {
    render(
      <RestoreButton
        action={noop}
        label="Geri al"
        name="Geri al: Karma aşı"
        mark="undo"
      />,
    );

    const button = screen.getByRole("button", { name: "Geri al: Karma aşı" });
    expect(button.textContent?.trim()).toBe("Geri al");
  });

  // Nothing is named when nothing needs naming: the archive call sites
  // sit alone on a detail page, where "Restore" is unambiguous, and an
  // aria-label repeating the visible text would only add noise.
  it("leaves the label to speak for itself when there is no name", () => {
    const { container } = render(
      <RestoreButton action={noop} label="Geri yükle" />,
    );
    expect(container.querySelector("button")).not.toHaveAttribute("aria-label");
  });
});
