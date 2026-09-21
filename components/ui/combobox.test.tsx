// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Combobox } from "@/components/ui/combobox";

// Focusing the field opens the list, so by the time a keyboard user
// presses Down it is already open — and the handler read that as
// "advance", landing on the second option. ux found it on the
// vaccination picker, where the first option is "Kuduz (Rabies)": the
// most common vaccination in the country was the one option the first
// keypress skipped, and reaching it took Down then Up.
//
// Nothing was unreachable and a mouse user never saw it. It cost one
// keypress, every time, on the option chosen most often.

const OPTIONS = [
  { value: "rabies", label: "Kuduz (Rabies)" },
  { value: "combo", label: "Karma" },
  { value: "lepto", label: "Leptospiroz" },
];

function open() {
  const view = render(<Combobox name="vaccine" options={OPTIONS} />);
  const input = view.container.querySelector('input[type="text"]')!;
  fireEvent.focus(input);
  return { ...view, input };
}

const activeLabel = () =>
  screen.getByRole("option", { selected: true }).textContent;

describe("moving through a combobox by keyboard", () => {
  it("settles on the first option, rather than past it", () => {
    const { input } = open();
    expect(activeLabel()).toBe("Kuduz (Rabies)");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(activeLabel()).toBe("Kuduz (Rabies)");
  });

  it("moves on the press after that", () => {
    const { input } = open();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(activeLabel()).toBe("Karma");
  });

  it("reaches the first option in one press, not two", () => {
    // The shape of the defect: Down then Up used to be the way back to
    // the top, so the test says one press rather than just "correct".
    const { input } = open();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(
      (document.querySelector('input[type="hidden"]') as HTMLInputElement)
        .value,
    ).toBe("rabies");
  });

  it("does not settle twice after typing", () => {
    // Typing re-aims the list at its first match, so the highlight is
    // already where the user put it and Down should move.
    const { input } = open();
    fireEvent.change(input, { target: { value: "K" } });
    expect(activeLabel()).toBe("Kuduz (Rabies)");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(activeLabel()).toBe("Karma");
  });

  it("still walks the whole list and stops at the end", () => {
    const { input } = open();
    for (let i = 0; i < 10; i += 1) {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    }
    expect(activeLabel()).toBe("Leptospiroz");
  });

  it("walks back up, one option per press", () => {
    const { input } = open();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(activeLabel()).toBe("Karma");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(activeLabel()).toBe("Kuduz (Rabies)");
  });
});
