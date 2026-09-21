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

// Turning a species off says what the picker offers, not what exists.
//
// The clinic switches "Kedi" off, the chip goes, and the next vet with a
// cat on the table types "Kedi" into "+ New species". The picker searched
// only what it was showing, so it minted a second concept with the same
// name and filed the animal under `OTHER`. That cat then fell out of
// every list and count that groups by `CAT` — silently, and for good.
describe("typing the name of a species the clinic turned off", () => {
  const HIDDEN = [
    {
      value: "CAT",
      label: "Kedi",
      names: ["Kedi", "Cat"],
      note: "Kedi yerleşik bir tür. Bu klinikte kapalı, ama bu hayvan için kullanıldı.",
    },
    {
      value: "DOG",
      label: "Köpek",
      names: ["Köpek", "Dog"],
      note: "Köpek yerleşik bir tür.",
    },
  ];

  function pickerWithHidden(extra: Record<string, unknown> = {}) {
    return render(
      <SpeciesPicker
        name="species"
        label="Tür"
        options={[{ value: "BIRD", label: "Kuş", icon: "BIRD" }]}
        newLabel="+ Yeni tür"
        newHint="hint"
        newPlaceholder="placeholder"
        addLabel="Ekle"
        hiddenBuiltIns={HIDDEN}
        hiddenQualifier="bu klinikte kapalı"
        {...extra}
      />,
    );
  }

  function type(text: string) {
    fireEvent.click(screen.getByRole("button", { name: /Yeni tür/ }));
    fireEvent.change(screen.getByPlaceholderText("placeholder"), {
      target: { value: text },
    });
  }

  it("offers the built-in instead of the button that would duplicate it", () => {
    pickerWithHidden();
    type("Kedi");

    expect(screen.queryByRole("button", { name: "Ekle" })).toBeNull();
    const chip = screen.getByRole("button", { name: /Kedi/ });
    expect(chip).toHaveTextContent("bu klinikte kapalı");
  });

  // Both languages and both kinds of folding. Someone typing a species
  // name without a Turkish keyboard is exactly who this is for, and the
  // dotted and dotless i are the pair that catches a naive lowercase.
  it.each([
    ["kedi", "CAT"],
    ["Kedi", "CAT"],
    ["KEDİ", "CAT"],
    ["cat", "CAT"],
    ["Cat", "CAT"],
    ["Kopek", "DOG"],
    ["Köpek", "DOG"],
    ["dog", "DOG"],
  ])("reads %s as the built-in %s", (typed, key) => {
    const { container } = pickerWithHidden();
    type(typed);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(HIDDEN.find((h) => h.value === key)!.label) }));

    expect(
      (container.querySelector('input[type="hidden"]') as HTMLInputElement)
        .value,
    ).toBe(key);
  });

  it("submits the enum key, not the words that were typed", () => {
    const { container } = pickerWithHidden();
    type("cat");
    fireEvent.keyDown(screen.getByPlaceholderText("placeholder"), {
      key: "Enter",
    });

    const hidden = container.querySelector(
      'input[type="hidden"]',
    ) as HTMLInputElement;
    expect(hidden.value).toBe("CAT");
    // The chip reads in the user's language even though what was typed
    // was English, because the value and the label are different things.
    expect(screen.getByRole("button", { name: /Kedi/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("says the setting has not changed, without saying it has", () => {
    pickerWithHidden();
    type("Kedi");
    fireEvent.click(screen.getByRole("button", { name: /Kedi/ }));

    const note = screen.getByText(/yerleşik bir tür/);
    expect(note).toHaveTextContent("Bu klinikte kapalı");
    // The words that would be a lie. The animal got a species; the
    // clinic's setting is exactly where it was.
    expect(note.textContent).not.toMatch(/açıldı|etkinleştir/i);
  });

  it("keeps the new chip inside the one tab stop", () => {
    pickerWithHidden();
    type("Kedi");
    fireEvent.click(screen.getByRole("button", { name: /Kedi/ }));

    // The roving tabindex is the thing most likely to be broken by
    // adding a chip from a new direction: one stop for the group, and
    // it sits on the chosen answer.
    expect(stops()).toHaveLength(1);
    expect(stops()[0]).toHaveAttribute("aria-pressed", "true");
    expect(stops()[0]).toHaveTextContent("Kedi");
  });

  it("offers no way out of the form when the reader may not change settings", () => {
    pickerWithHidden();
    type("Kedi");
    fireEvent.click(screen.getByRole("button", { name: /Kedi/ }));

    expect(screen.queryByRole("link", { name: /Ayarlarda aç/ })).toBeNull();
  });

  it("does not say the same words twice in the same picker", () => {
    // Both links go to /settings: the standing one under the chips,
    // and the one at the end of the note. They were handed the same
    // label, so a reader who may manage settings saw "Manage species"
    // twice, one under the other, with no way to tell what the second
    // one was for. The inline one says what it does to *this* species;
    // the standing one names the section.
    pickerWithHidden({
      manageHref: "/settings",
      manageLabel: "Türleri yönet",
      enableHref: "/settings",
      enableLabel: "Ayarlarda aç",
    });
    type("Kedi");
    fireEvent.click(screen.getByRole("button", { name: /Kedi/ }));

    const labels = screen.getAllByRole("link").map((a) => a.textContent);
    expect(labels).toEqual(["Ayarlarda aç", "Türleri yönet"]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("opens the setting in a new tab for the reader who may", () => {
    // The animal is on the table and the form is unsaved. A link that
    // navigates away costs more than the setting is worth.
    pickerWithHidden({
      enableHref: "/settings/species",
      enableLabel: "Ayarlarda aç",
    });
    type("Kedi");
    fireEvent.click(screen.getByRole("button", { name: /Kedi/ }));

    const link = screen.getByRole("link", { name: "Ayarlarda aç" });
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("still makes a custom species out of a name nothing matches", () => {
    const { container } = pickerWithHidden();
    type("Alpaka");
    fireEvent.click(screen.getByRole("button", { name: "Ekle" }));

    expect(
      (container.querySelector('input[type="hidden"]') as HTMLInputElement)
        .value,
    ).toBe("Alpaka");
  });
});
