// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, within } from "@testing-library/react";
import { Combobox } from "@/components/ui/combobox";

// Typing a Turkish name without a Turkish keyboard used to find nothing.
//
// `ı` was folded and the other five letters were not, which is worse
// than folding none: the picker tells a vet "no such client" about a
// client who is right there, and the vet believes it and opens a second
// record for the same person. The list is not wrong, it is *absent* —
// nothing on screen says the search is the reason.
//
// Asserted through what the list shows, never through the folding
// function: the question is whether "Ayse" finds Ayşe, and a test that
// pins the intermediate string would go green on a fold that happens to
// produce it while matching nothing.

const CLIENTS = [
  { value: "c1", label: "Ayşe Demir" },
  { value: "c2", label: "Çiğdem Öztürk" },
  { value: "c3", label: "Gülşen Şahin" },
  { value: "c4", label: "Işık Yılmaz" },
  { value: "c5", label: "Mehmet Kaya" },
];

function search(query: string) {
  const view = render(<Combobox name="clientId" options={CLIENTS} />);
  const input = view.container.querySelector('input[type="text"]')!;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: query } });
  // Scoped to this render: several searches run in one test and
  // Testing Library only cleans up between them.
  return within(view.container)
    .queryAllByRole("option")
    .map((o) => o.textContent);
}

describe("finding a Turkish name typed on an English keyboard", () => {
  it.each([
    ["Ayse", "Ayşe Demir"],
    ["Cigdem", "Çiğdem Öztürk"],
    ["Ozturk", "Çiğdem Öztürk"],
    ["Gulsen", "Gülşen Şahin"],
    ["Sahin", "Gülşen Şahin"],
    ["Isik", "Işık Yılmaz"],
    ["Yilmaz", "Işık Yılmaz"],
  ])("finds %s", (query, expected) => {
    expect(search(query)).toEqual([expected]);
  });

  it("still finds the name spelled properly", () => {
    // The fold runs on both sides, so adding it must not cost the
    // clinic that does have a Turkish keyboard.
    expect(search("Ayşe")).toEqual(["Ayşe Demir"]);
    expect(search("Çiğdem")).toEqual(["Çiğdem Öztürk"]);
  });

  it("keeps the dotted and dotless i interchangeable", () => {
    // The one case that worked before. `ı` is a letter rather than an
    // `i` wearing a mark, so decomposition alone does not fold it and
    // the explicit mapping has to survive.
    expect(search("ısık")).toEqual(["Işık Yılmaz"]);
    expect(search("IŞIK")).toEqual(["Işık Yılmaz"]);
    expect(search("İşık")).toEqual(["Işık Yılmaz"]);
  });

  it("does not fold so far that everything matches", () => {
    // A fold that strips too much turns a picker into a list of
    // everyone, which is the same silence from the other end.
    expect(search("Kaya")).toEqual(["Mehmet Kaya"]);
    expect(search("zzz")).toEqual([]);
  });
});
