// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Combobox, type ComboOption } from "@/components/ui/combobox";

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
    const onSearch = vi.fn(async () => ({ options: MATCHES, hasMore: false }));
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
    const onSearch = vi.fn(async () => ({ options: [], hasMore: false }));
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
    // The server answers that it truncated, which is what the note is
    // about once a search is on screen. It used to be enough to set the
    // `hasMore` PROP here, because the note followed the cap the handed
    // list was cut at — so a search matching three clients showed all
    // three under a line saying records were missing. The prop still
    // answers the other question (the handed list is short of the
    // clinic); this test is about the search.
    const onSearch = vi.fn(async () => ({ options: MATCHES, hasMore: true }));
    const { input } = searchable({ hasMore: true, onSearch });
    fireEvent.focus(input);
    await type(input, "Ayşe");

    const note = screen.getByText("Yazmaya devam edin.");
    expect(note).toBeInTheDocument();
    // Not an option: it cannot be chosen and the arrow keys must not
    // stop on it.
    // Outside the listbox, not a presentational child of it. In there
    // the sentence sat below every option in a 256px scroll box — in a
    // list of fifty, forty-three rows down, which is hidden — and a
    // `role="presentation"` child of a listbox is skipped by virtual
    // focus, so it was missing from the screen reader too. Both
    // channels, for the one fact the cap exists to announce.
    expect(note.tagName).toBe("P");
    expect(
      within(screen.getByRole("listbox")).queryByText(note.textContent!),
    ).toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("says nothing about more when there is nothing to show yet", async () => {
    const onSearch = vi.fn(async () => ({ options: [], hasMore: false }));
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
    const onSearch = vi.fn(async () => ({ options: FOUND, hasMore: false }));
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
    // Outside the listbox, not a presentational child of it. In there
    // the sentence sat below every option in a 256px scroll box — in a
    // list of fifty, forty-three rows down, which is hidden — and a
    // `role="presentation"` child of a listbox is skipped by virtual
    // focus, so it was missing from the screen reader too. Both
    // channels, for the one fact the cap exists to announce.
    expect(note.tagName).toBe("P");
    expect(
      within(screen.getByRole("listbox")).queryByText(note.textContent!),
    ).toBeNull();
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
    // Truncated on the server's own say-so: see the note in "tells the
    // user what to do". What is being tested here is which of the two
    // sentences is on screen, not which question decides it.
    const onSearch = vi.fn(async () => ({ options: FOUND, hasMore: true }));
    const { input } = searchable({ onSearch });
    fireEvent.focus(input);
    await type(input, "Ayşe");

    expect(screen.getByText("Yazmaya devam edin.")).toBeInTheDocument();
    expect(screen.queryByText("En az iki harf yazın.")).toBeNull();
  });

  it("stops claiming there is more once the server says there is not", async () => {
    // The defect this pair was introduced for. The handed list IS
    // capped — `hasMore` is set on the component — but the search that
    // is on screen matched three clients and returned all three. Under
    // the old rule the note appeared anyway, so a vet who had found
    // everything was told records were missing and kept typing.
    //
    // The two questions are different and only the server can answer
    // the second: "this clinic has more clients than the fifty you
    // were handed" is not "your search matched more than I returned".
    const onSearch = vi.fn(async () => ({ options: FOUND, hasMore: false }));
    const { input } = searchable({ hasMore: true, onSearch });
    fireEvent.focus(input);
    await type(input, "Ayşe");

    expect(screen.queryByText("Yazmaya devam edin.")).toBeNull();
  });

  it("goes back to the handed list's own answer when the search is cleared", async () => {
    // Below the threshold there is no search to describe, so the note
    // returns to what it says about the list the page handed over —
    // which is still short of the clinic. A server answer that
    // outlived its query would be the stale-value defect wearing this
    // feature's clothes.
    const onSearch = vi.fn(async () => ({ options: FOUND, hasMore: false }));
    const { input } = searchable({ hasMore: true, onSearch });
    fireEvent.focus(input);
    await type(input, "Ayşe");
    await type(input, "");

    expect(screen.getByText("Yazmaya devam edin.")).toBeInTheDocument();
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

// The note left the listbox to become visible; `aria-describedby` is how
// it gets back into the accessibility tree. That association is the whole
// second half of the fix and nothing else in this file would notice if it
// were dropped — the sentence would still be on screen, and silent.
describe("the note reaches the input it is about", () => {
  const HANDED = [
    { value: "c1", label: "Ayşe Kara" },
    { value: "c2", label: "Mehmet Kaya" },
  ];

  function render_(props: Record<string, unknown> = {}) {
    const view = render(
      <Combobox
        name="clientId"
        options={HANDED}
        onSearch={async () => ({ options: [], hasMore: false })}
        hasMore
        searchHintLabel="En az iki harf yazın."
        noResultsLabel="Sonuç yok."
        {...props}
      />,
    );
    return {
      ...view,
      input: view.container.querySelector('input[type="text"]')!,
    };
  }

  it("describes the input by the note while the note is showing", () => {
    const { container, input } = render_();
    fireEvent.focus(input);

    // Looked up from the input's own `aria-describedby` rather than
    // from the text. The note grew a second sentence, so the text now
    // sits in a child and the id is on the box around both — reading
    // the id off the text element quietly found nothing. Going the
    // direction a screen reader goes is also the direction that
    // cannot drift.
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    const described = ids
      .map((id) => container.querySelector(`#${CSS.escape(id)}`))
      .filter(Boolean);
    expect(described.some((el) => el!.textContent?.includes("En az iki harf"))).toBe(
      true,
    );
  });

  it("joins the caller's description rather than replacing it", () => {
    // `Field` passes the error and the hint in through this prop.
    // Overwriting it to announce a footnote would trade a validation
    // message for one.
    const { input } = render_({ "aria-describedby": "field-error" });
    fireEvent.focus(input);

    const ids = input.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toContain("field-error");
    // The note's own id, whatever it is called: the assertion is that
    // the caller's description was joined, not replaced.
    expect(ids.length).toBeGreaterThan(1);
  });

  it("says nothing when there is no note", () => {
    const { input } = render_({ hasMore: false, onSearch: undefined });
    fireEvent.focus(input);
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  // The note is rendered inside the open list, so with the list shut
  // the id pointed at nothing. pm found it by looking the id up and
  // getting null -- a dangling reference is not merely inert, it is
  // indistinguishable from a description that failed to be written,
  // and the caller's own error id was riding in the same attribute.
  it("points at no note while the list is shut", () => {
    const { input } = render_();
    fireEvent.focus(input);
    // Open: the note exists and is pointed at.
    expect(input.getAttribute("aria-describedby")).not.toBeNull();

    fireEvent.focusOut(input, { relatedTarget: null });
    // Shut: the note is gone from the document, so its id goes too.
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("keeps the caller's description when the note's id leaves", () => {
    // The two ids ride in the same attribute, so dropping one must not
    // drop the other: `Field` puts the validation error in here.
    const { input } = render_({ "aria-describedby": "field-error" });
    fireEvent.focus(input);
    fireEvent.focusOut(input, { relatedTarget: null });

    expect(input.getAttribute("aria-describedby")).toBe("field-error");
  });
});

// Four things can be true while the list is empty and three of them
// used to say "No results."
//
// The dangerous one is the wait. The debounce is 200ms and a round
// trip follows it, and for that whole window the vet was told the
// clinic has no such client — at exactly the moment they are deciding
// whether to create a second record for one who is already there.
//
// The fourth is failure. `.catch(() => undefined)` swallowed it and
// the same sentence appeared, so a search that could not run and a
// search that found nothing were the same screen.
describe("what the list says while it has nothing to show", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const HANDED = [{ value: "c1", label: "Ayşe Kara" }];

  function searchable(
    onSearch: (
      t: string,
    ) => Promise<{ options: ComboOption[]; hasMore: boolean }>,
  ) {
    const view = render(
      <Combobox
        name="clientId"
        options={HANDED}
        onSearch={onSearch}
        hasMore
        searchHintLabel="En az iki harf yazın."
        searchingLabel="Aranıyor…"
        searchFailedLabel="Arama şu anda yapılamıyor."
        noResultsLabel="Sonuç yok."
      />,
    );
    return { ...view, input: view.container.querySelector('input[type="text"]')! };
  }

  it("says it is looking, not that there is nothing", async () => {
    type Answer = { options: ComboOption[]; hasMore: boolean };
    let release: (v: Answer) => void = () => {};
    const { input } = searchable(
      () => new Promise<Answer>((resolve) => (release = resolve)),
    );
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzz" } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText("Aranıyor…")).toBeInTheDocument();
    expect(screen.queryByText("Sonuç yok.")).toBeNull();

    await act(async () => {
      release({ options: [], hasMore: false });
    });
    // And once it has answered, "nothing" is the honest word.
    expect(screen.getByText("Sonuç yok.")).toBeInTheDocument();
  });

  it("says the search failed, which is not the same as finding none", async () => {
    const { input } = searchable(async () => {
      throw new Error("offline");
    });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzz" } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText("Arama şu anda yapılamıyor.")).toBeInTheDocument();
    expect(screen.queryByText("Sonuç yok.")).toBeNull();
  });

  it("still says to type more before anything has been asked", async () => {
    const onSearch = vi.fn(async () => ({ options: [], hasMore: false }));
    const { input } = searchable(onSearch);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "z" } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByText("En az iki harf yazın.")).toBeInTheDocument();
  });
});

// Two things can be true at once and the note used to pick one.
//
// pm measured the cost on a clinic of 63 with a cap of 50: open the
// picker, see fifty names, and read "type at least two letters to
// search". That is an invitation. Thirteen records are missing and
// nothing on screen says so, and the sentence that would have said it
// was already written — withheld until the second keystroke.
describe("the note when the list is short of the clinic", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function capped() {
    const view = render(
      <Combobox
        name="clientId"
        options={[
          { value: "c1", label: "Ayşe Kara" },
          { value: "c2", label: "Mehmet Kaya" },
        ]}
        onSearch={async () => ({ options: [], hasMore: false })}
        hasMore
        searchHintLabel="En az iki harf yazın."
        hasMoreLabel="Tüm kayıtlar gösterilmiyor."
        noResultsLabel="Sonuç yok."
      />,
    );
    return { ...view, input: view.container.querySelector('input[type="text"]')! };
  }

  it("says both, when both are true", () => {
    const { input } = capped();
    fireEvent.focus(input);

    // The state pm found: nothing typed, the list is the capped one,
    // and the server has not been asked.
    expect(screen.getByText("Tüm kayıtlar gösterilmiyor.")).toBeInTheDocument();
    expect(screen.getByText("En az iki harf yazın.")).toBeInTheDocument();
  });

  it("still says the list is short after one letter", () => {
    // The second half of pm's measurement: one character is still
    // below the threshold, and the records are still missing.
    const { input } = capped();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "M" } });

    expect(screen.getByText("Tüm kayıtlar gösterilmiyor.")).toBeInTheDocument();
  });

  it("drops the instruction once the server has been asked", () => {
    const { input } = capped();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Me" } });

    // The instruction has been followed, so it stops being said. The
    // warning is a separate question and is still open — the server
    // does not report whether its own answer was cut short.
    expect(screen.queryByText("En az iki harf yazın.")).toBeNull();
  });
});

// The door, and why it is gone. The vet's own account: "the dog is on
// the table, the owner is crying, and what I got was not a blank page
// but a door" -- two of them, and the box for the animal's name was on
// the third screen. The card had promised the animal and the owner
// could be made on the way, so the screen was making the product a
// liar. The way out is not a door in front of the form; it is a row
// inside the picker.
describe("making the record the typed name does not match yet", () => {
  const PETS: ComboOption[] = [
    { value: "p-1", label: "Limon · Ayşe Çelik" },
    { value: "p-2", label: "Limon · Kerem Doğan" },
  ];

  const typed = (text: string, onCreate = vi.fn()) => {
    const view = render(
      <Combobox
        name="petId"
        options={PETS}
        onCreate={onCreate}
        createLabel={(q) => `+ "${q}" adıyla yeni hayvan aç`}
      />,
    );
    const input = view.container.querySelector('input[type="text"]')!;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: text } });
    return { ...view, input, onCreate };
  };

  const rowText = () =>
    screen.getAllByRole("option").map((o) => o.textContent);

  // Three Zeytins and four Pamuks is what this clinic actually has, so
  // the row that leaves the screen may never stand above the records
  // that are already here.
  it("offers to create only under what it found", () => {
    typed("Limon");

    expect(rowText()).toEqual([
      "Limon · Ayşe Çelik",
      "Limon · Kerem Doğan",
      '+ "Limon" adıyla yeni hayvan aç',
    ]);
  });

  // An exact match is not an answer either: the second Limon is a
  // different animal, and only the vet knows which one is on the table.
  it("still offers it when a name matches exactly", () => {
    typed("Limon · Ayşe Çelik");

    expect(rowText().at(-1)).toBe('+ "Limon · Ayşe Çelik" adıyla yeni hayvan aç');
  });

  // Nothing is created by pressing Enter on arrival. This is how the
  // fifth duplicate Limon would be born, each with its own vaccination
  // history.
  it("is never the row a hurried hand lands on", () => {
    const { input, onCreate } = typed("Limon");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("carries the typed name to whoever makes the record", () => {
    const { input, onCreate } = typed("  Limon  ");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCreate).toHaveBeenCalledWith("Limon");
  });

  it("says nothing about creating before anything is typed", () => {
    render(
      <Combobox name="petId" options={PETS} onCreate={vi.fn()} createLabel={(q) => q} />,
    );
    fireEvent.focus(document.querySelector('input[type="text"]')!);

    expect(rowText()).toEqual(["Limon · Ayşe Çelik", "Limon · Kerem Doğan"]);
  });
});

// The gap between a keystroke and the server's answer, and why it is
// not a detail. The vet types the whole name before looking up --
// "'Pam' works in the mock, but I finish the word, that is a reflex" --
// and for those few hundred milliseconds the list still belongs to the
// previous query. Offer "create" there and the product invents the
// duplicate the vet is most afraid of, at the exact moment they cannot
// see it: "the fourth Pamuk. That mistake is silent."
describe("offering to create while the server is still answering", () => {
  const answer = (options: ComboOption[]) =>
    vi.fn(async () => ({ options, hasMore: false }));

  const withSearch = (onSearch: ReturnType<typeof answer>) => {
    const onCreate = vi.fn();
    const view = render(
      <Combobox
        name="petId"
        options={[]}
        onSearch={onSearch}
        onCreate={onCreate}
        createLabel={(q) => `+ ${q}`}
      />,
    );
    const input = view.container.querySelector('input[type="text"]')!;
    fireEvent.focus(input);
    return { ...view, input, onCreate };
  };

  const rowText = () => screen.queryAllByRole("option").map((o) => o.textContent);

  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("says nothing about creating until this query has been answered", async () => {
    const onSearch = answer([{ value: "p-1", label: "Pamuk · kedi" }]);
    const { input } = withSearch(onSearch);

    fireEvent.change(input, { target: { value: "Pamuk" } });

    // The debounce has not even started the request yet, so `status`
    // is still idle and the old list is what is on screen.
    expect(rowText().some((t) => t?.startsWith("+"))).toBe(false);
  });

  // The other bound, and it is the reason the rule is not "wait for
  // quiet": somebody typing a genuinely new name must be offered the
  // way out, or the feature does not exist for them.
  it("offers it once the answer for this query arrives", async () => {
    const onSearch = answer([]);
    const { input } = withSearch(onSearch);

    fireEvent.change(input, { target: { value: "Ceviz" } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(rowText().at(-1)).toBe("+ Ceviz");
  });

  // A stale answer must not unlock it either: the reply that arrives
  // belongs to "Pam", and the box now says "Pamuk".
  it("locks again when the typing moves past the answer", async () => {
    const onSearch = answer([]);
    const { input } = withSearch(onSearch);

    fireEvent.change(input, { target: { value: "Pam" } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    fireEvent.change(input, { target: { value: "Pamuk" } });

    expect(rowText().some((t) => t?.startsWith("+"))).toBe(false);
  });
});

// The owner's name moved off the first line and onto the second, and a
// filter that only read labels would have quietly removed the way a vet
// actually looks for an animal: by whose it is.
describe("finding an animal by its owner", () => {
  it("matches the quieter second line too", () => {
    render(
      <Combobox
        name="petId"
        options={[
          { value: "p-1", label: "Pamuk · kedi", caption: "Ayşe Yılmaz · 7 ay önce" },
          { value: "p-2", label: "Zeytin · köpek", caption: "Kerem Doğan · 2 gün önce" },
        ]}
      />,
    );
    const input = document.querySelector('input[type="text"]')!;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Kerem" } });

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Zeytin · köpekKerem Doğan · 2 gün önce",
    ]);
  });
});

/**
 * The row a keyboard user is actually reading.
 *
 * The second line is the tiebreaker -- the owner, and when the animal
 * was last seen -- so it is the line that decides between three animals
 * called Zeytin. It was drawn at `accent-foreground/80` on the
 * highlighted row, which measures 4.35:1 in the light theme against
 * `--accent`, under the 4.5 that 12px text asks for. The one row
 * somebody is looking at was the one row that failed.
 *
 * Pinned as "no alpha on either state" rather than as a number, because
 * the number is not checkable here: jsdom resolves no custom properties
 * and would report the class, not the contrast. What a test can hold is
 * the shape of the rule -- each state uses its own foreground token at
 * full strength, and rank comes from the 12px. A tint added back is how
 * this returns, and it returns silently.
 */
describe("the second line of a highlighted row", () => {
  it("uses its foreground at full strength, in both states", () => {
    const withCaptions: ComboOption[] = [
      { value: "p1", label: "Zeytin · kedi", caption: "Ayşe Yılmaz" },
      { value: "p2", label: "Zeytin · kedi", caption: "Mehmet Kaya" },
    ];
    const view = render(<Combobox name="petId" options={withCaptions} />);
    fireEvent.focus(view.container.querySelector('input[type="text"]')!);

    const { container } = view;
    const captions = [...container.querySelectorAll("li span.block")];
    expect(captions.length).toBeGreaterThan(0);

    for (const caption of captions) {
      expect(caption.className).not.toMatch(/text-[a-z-]+\/\d+/);
    }
  });
});

/**
 * The two rows that carry a typed name, at 390px.
 *
 * "Create Devrim Aksoy" is the longest string the list ever holds,
 * because the vet just typed part of it. Both rows lay the icon and the
 * label out with flex, and flex takes the space it needs out of
 * whichever child will give: a `size-4` icon with no `shrink-0` is
 * squashed to a sliver beside the text that explains it.
 *
 * `buttonVariants` sets `[&_svg]:shrink-0` on every button in the
 * product for exactly this. These two rows are not buttons and did not
 * inherit it.
 */
describe("the rows that offer to create what was typed", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keep the icon square when the label is long", () => {
    const view = render(
      <Combobox
        name="petId"
        options={[]}
        onCreate={() => {}}
        createLabel={(typed) => `"${typed}" adıyla yeni hayvan aç`}
      />,
    );
    const input = view.container.querySelector('input[type="text"]')!;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Devrim Aksoy" } });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const icons = view.container.querySelectorAll("li svg");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.getAttribute("class")).toContain("shrink-0");
    }
  });
});
