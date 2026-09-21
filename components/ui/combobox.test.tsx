// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

// Searching moves the filter to the server, which is what stops the
// 500-row cap from quietly losing the end of the alphabet from every
// picker. Three things had to come with it, and all three are here
// because each one was a defect somewhere else first.

describe("searching a combobox against the server", () => {
  const MATCHES = [
    { value: "c1", label: "Ayşe Yılmaz" },
    { value: "c2", label: "Ayşe Demir" },
  ];

  function searchable(props: Record<string, unknown> = {}) {
    const onSearch = vi.fn(async () => MATCHES);
    const view = render(
      <Combobox
        name="clientId"
        options={[]}
        onSearch={onSearch}
        searchHintLabel="En az iki harf yazın."
        noResultsLabel="Sonuç yok."
        hasMoreLabel="Yazmaya devam edin."
        {...props}
      />,
    );
    const input = view.container.querySelector('input[type="text"]')!;
    return { ...view, input, onSearch };
  }

  async function type(input: Element, text: string) {
    fireEvent.change(input, { target: { value: text } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("asks for more letters rather than reporting no results", () => {
    // The server returns an empty array either way. Telling a vet
    // "no results" after one letter says their clinic has no such
    // client, when nobody has looked yet.
    const { input } = searchable();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "A" } });

    expect(screen.getByText("En az iki harf yazın.")).toBeInTheDocument();
    expect(screen.queryByText("Sonuç yok.")).toBeNull();
  });

  it("does not call the server below the threshold", async () => {
    const { input, onSearch } = searchable();
    fireEvent.focus(input);
    await type(input, "A");
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("says there is nothing only after actually looking", async () => {
    const onSearch = vi.fn(async () => []);
    const { input } = searchable({ onSearch });
    fireEvent.focus(input);
    await type(input, "Ayş");

    expect(onSearch).toHaveBeenCalledWith("Ayş");
    expect(screen.getByText("Sonuç yok.")).toBeInTheDocument();
    expect(screen.queryByText("En az iki harf yazın.")).toBeNull();
  });

  it("asks once for a burst of typing", async () => {
    const { input, onSearch } = searchable();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Ay" } });
    fireEvent.change(input, { target: { value: "Ayş" } });
    fireEvent.change(input, { target: { value: "Ayşe" } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("Ayşe");
  });

  it("tells the user what to do, not how many were cut", async () => {
    const { input } = searchable({ hasMore: true });
    fireEvent.focus(input);
    await type(input, "Ayşe");

    const note = screen.getByText("Yazmaya devam edin.");
    expect(note).toBeInTheDocument();
    // Not an option: it cannot be chosen and the arrow keys must not
    // stop on it.
    expect(note.getAttribute("role")).toBe("presentation");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("says nothing about more when there is nothing to show yet", async () => {
    const onSearch = vi.fn(async () => []);
    const { input } = searchable({ onSearch, hasMore: true });
    fireEvent.focus(input);
    await type(input, "Ayş");

    expect(screen.queryByText("Yazmaya devam edin.")).toBeNull();
  });

  it("resets the highlight AND the moved flag when results change", async () => {
    // value found this one by reading: resetting `active` alone leaves
    // `moved` true, so the first Down on a fresh list skips its first
    // option — the defect 0dcfaed fixed, reachable again through
    // search. And it is worse here, because option zero is a different
    // client than it was a keystroke ago.
    const { input } = searchable();
    fireEvent.focus(input);
    await type(input, "Ayşe");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent(
      "Ayşe Demir",
    );

    await type(input, "Ayşe Y");
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent(
      "Ayşe Yılmaz",
    );

    // And the first Down after the new list settles rather than skips.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent(
      "Ayşe Yılmaz",
    );
  });
});

describe("a selection outside the capped list", () => {
  // The cap came down from five hundred to fifty when the pickers got a
  // server search. That made the list ten times more likely to be missing
  // the record being edited, and the picker's label lookup only ever read
  // `options` — so the edit screen for a clinic's 87th animal opened with
  // an empty required field over a hidden input that still held the value.
  const options = Array.from({ length: 50 }, (_, i) => ({
    value: `pet-${i}`,
    label: `Animal ${i}`,
  }));

  it("shows the name the caller supplies when the value is past the cap", () => {
    render(
      <Combobox
        name="petId"
        options={options}
        defaultValue="pet-87"
        defaultLabel="Animal 87"
        noResultsLabel="none"
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("Animal 87");
    expect(screen.getByDisplayValue("pet-87")).toBeInTheDocument();
  });

  it("prefers the option list when the value is in it", () => {
    render(
      <Combobox
        name="petId"
        options={options}
        defaultValue="pet-3"
        defaultLabel="stale name"
        noResultsLabel="none"
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("Animal 3");
  });
});

describe("what the server finds and what the page already sent", () => {
  // The search used to take the list over: with `onSearch` attached the
  // picker rendered `remote` and nothing else, so the fifty records the
  // page had already sent down were invisible until two letters were
  // typed, and after that only the server's answers were on show. A
  // clinic of sixty lost the ability to *look* — fine for a name you can
  // spell, useless for the one you would recognise.
  const HANDED = [
    { value: "c-local", label: "Ayşe Kara" },
    { value: "c-other", label: "Mehmet Kaya" },
  ];
  const FOUND = [
    { value: "c-far", label: "Ayşe Yılmaz" },
    { value: "c-local", label: "Ayşe Kara" },
  ];

  function searchable(props: Record<string, unknown> = {}) {
    const onSearch = vi.fn(async () => FOUND);
    const view = render(
      <Combobox
        name="clientId"
        options={HANDED}
        onSearch={onSearch}
        hasMore
        searchHintLabel="En az iki harf yazın."
        noResultsLabel="Sonuç yok."
        hasMoreLabel="Yazmaya devam edin."
        {...props}
      />,
    );
    const input = view.container.querySelector('input[type="text"]')!;
    return { ...view, input, onSearch };
  }

  const labels = () =>
    screen.getAllByRole("option").map((o) => o.textContent?.trim());

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function type(input: Element, text: string) {
    fireEvent.change(input, { target: { value: text } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
  }

  it("shows the handed list before anything has been typed", () => {
    const { input } = searchable();
    fireEvent.focus(input);
    expect(labels()).toEqual(["Ayşe Kara", "Mehmet Kaya"]);
  });

  it("puts the instruction under the list, not in its place", () => {
    const { input } = searchable();
    fireEvent.focus(input);

    const note = screen.getByText("En az iki harf yazın.");
    expect(note.getAttribute("role")).toBe("presentation");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("keeps filtering the handed list while the server is out of reach", async () => {
    const { input, onSearch } = searchable();
    fireEvent.focus(input);
    await type(input, "ş");

    expect(onSearch).not.toHaveBeenCalled();
    expect(labels()).toEqual(["Ayşe Kara"]);
  });

  it("adds what the server found to what was already there", async () => {
    const { input } = searchable();
    fireEvent.focus(input);
    await type(input, "Ayşe");

    // The handed match first: it is the one already on screen when the
    // answer arrives, and reordering under the cursor is how the wrong
    // row gets clicked.
    expect(labels()).toEqual(["Ayşe Kara", "Ayşe Yılmaz"]);
  });

  it("does not list the same record twice", async () => {
    // `c-local` comes back from the server as well. Two identical names
    // in one dropdown read as two records, which is the duplicate the
    // search exists to prevent.
    const { input } = searchable();
    fireEvent.focus(input);
    await type(input, "Ayşe");

    expect(labels().filter((l) => l === "Ayşe Kara")).toHaveLength(1);
  });

  it("switches the note once the server has actually answered", async () => {
    const { input } = searchable();
    fireEvent.focus(input);
    await type(input, "Ayşe");

    expect(screen.getByText("Yazmaya devam edin.")).toBeInTheDocument();
    expect(screen.queryByText("En az iki harf yazın.")).toBeNull();
  });

  it("can still name a record it reached through the server", async () => {
    // Leaving the field reconciles the text with the value, and the
    // lookup only ever read `options`. A client found by searching is
    // not in `options`, so the name was cleared while the hidden input
    // kept the id: an empty required field over a full form.
    const { input, container } = searchable({ options: [] });
    fireEvent.focus(input);
    await type(input, "Ayşe");
    fireEvent.mouseDown(screen.getByText("Ayşe Yılmaz"));

    fireEvent.focusOut(input, { relatedTarget: null });

    expect(input).toHaveValue("Ayşe Yılmaz");
    expect(
      (container.querySelector('input[type="hidden"]') as HTMLInputElement)
        .value,
    ).toBe("c-far");
  });
});

describe("a picker whose selection the form holds", () => {
  // Two pickers that answer each other cannot each keep their own copy:
  // choosing the animal fills in its owner, and submitting clears both.
  // The value is a pair rather than an id because the owner being filled
  // in is very often not on the capped fifty the page sent down, and an
  // id the picker cannot name opens a blank required field over a full
  // hidden input.
  const AYSE = { value: "c-1", label: "Ayşe Demir" };
  const MEHMET = { value: "c-2", label: "Mehmet Kaya" };

  it("shows the name the form is holding, cap or no cap", () => {
    render(<Combobox name="clientId" options={[]} value={AYSE} />);
    expect(screen.getByRole("combobox")).toHaveValue("Ayşe Demir");
  });

  it("hands back both halves, so the form can hold them", () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        name="clientId"
        options={[AYSE, MEHMET]}
        value={null}
        onValueChange={onValueChange}
      />,
    );
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.mouseDown(screen.getByText("Mehmet Kaya"));

    expect(onValueChange).toHaveBeenCalledWith("c-2", MEHMET);
  });

  it("follows the form when the value moves from elsewhere", () => {
    const { rerender } = render(
      <Combobox name="clientId" options={[]} value={null} />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("");

    rerender(<Combobox name="clientId" options={[]} value={AYSE} />);
    expect(screen.getByRole("combobox")).toHaveValue("Ayşe Demir");
    expect(screen.getByDisplayValue("c-1")).toBeInTheDocument();
  });

  it("empties when the form empties, which is what reset needs", () => {
    const { container, rerender } = render(
      <Combobox name="clientId" options={[]} value={AYSE} />,
    );
    rerender(<Combobox name="clientId" options={[]} value={null} />);

    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(
      (container.querySelector('input[type="hidden"]') as HTMLInputElement)
        .value,
    ).toBe("");
  });

  it("leaves the text alone while it is being typed", () => {
    // The sync is guarded on the value, not run every render: the form
    // re-renders on every keystroke of every other field, and the text
    // under the cursor belongs to whoever is typing until they stop.
    const view = render(
      <Combobox name="clientId" options={[AYSE, MEHMET]} value={AYSE} />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Meh" } });
    view.rerender(
      <Combobox name="clientId" options={[AYSE, MEHMET]} value={AYSE} />,
    );

    expect(input).toHaveValue("Meh");
  });
});
