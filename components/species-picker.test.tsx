// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SpeciesPicker } from "@/components/species-picker";

// A chip group is one choice and should cost one stop.
//
// Eleven chips were eleven tab stops, for a field a pet cannot be saved
// without — so reaching the breed box underneath took thirteen keys
// instead of three. ux measured it; the count is the defect, not the
// styling.
//
// And the group announced as "group", with nothing saying what of. The
// `<label>` above it cannot help: `htmlFor` binds to labelable elements
// and this is a `div`.

const OPTIONS = [
  { value: "DOG", label: "Köpek", icon: "DOG" },
  { value: "CAT", label: "Kedi", icon: "CAT" },
  { value: "BIRD", label: "Kuş", icon: "BIRD" },
];

function picker(defaultValue = "") {
  return render(
    <SpeciesPicker
      name="species"
      label="Tür"
      options={OPTIONS}
      defaultValue={defaultValue}
      newLabel="+ Yeni tür"
      newHint="hint"
      newPlaceholder="placeholder"
      addLabel="Ekle"
    />,
  );
}

const chips = () => screen.getAllByRole("button");
const stops = () => chips().filter((b) => b.tabIndex === 0);

describe("choosing a species by keyboard", () => {
  it("names the group, so it is not announced as just a group", () => {
    picker();
    expect(screen.getByRole("group", { name: "Tür" })).toBeInTheDocument();
  });

  it("costs one tab stop, not one per chip", () => {
    picker();
    // Three species plus the "new species" chip: four buttons, one stop.
    expect(chips()).toHaveLength(4);
    expect(stops()).toHaveLength(1);
  });

  it("puts the stop on the chosen chip, not always the first", () => {
    // Arriving at an answered field should land on the answer.
    picker("CAT");
    expect(stops()[0]).toHaveTextContent("Kedi");
  });

  it("falls back to the first chip when nothing is chosen yet", () => {
    picker();
    expect(stops()[0]).toHaveTextContent("Köpek");
  });

  it("walks the chips with the arrow keys", () => {
    picker();
    const [dog, cat] = chips();
    dog.focus();

    fireEvent.keyDown(dog, { key: "ArrowRight" });
    expect(document.activeElement).toBe(cat);

    fireEvent.keyDown(cat, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(dog);
  });

  it("wraps around, so neither end is a dead stop", () => {
    picker();
    const all = chips();
    all[0].focus();

    fireEvent.keyDown(all[0], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(all[all.length - 1]);
  });

  it("jumps to either end with Home and End", () => {
    picker();
    const all = chips();
    all[1].focus();

    fireEvent.keyDown(all[1], { key: "End" });
    expect(document.activeElement).toBe(all[all.length - 1]);

    fireEvent.keyDown(all[all.length - 1], { key: "Home" });
    expect(document.activeElement).toBe(all[0]);
  });

  it("still selects with a click, which never went through a keyboard", () => {
    const { container } = picker();
    fireEvent.click(screen.getByRole("button", { name: /Kuş/ }));

    expect(
      (container.querySelector('input[type="hidden"]') as HTMLInputElement)
        .value,
    ).toBe("BIRD");
    expect(screen.getByRole("button", { name: /Kuş/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
