"use client";

// Searchable combobox for forms.
//
// Two modes:
// - freeText (e.g. breed): the visible text input IS the form field. Options
//   are suggestions; anything typed is submitted as-is.
// - value mode (e.g. species): a hidden input carries the submitted value.
//   Selecting an option submits its `value`; with `allowCustom`, typing
//   something new submits the raw text (the server creates it).

import * as React from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fold, matches } from "@/lib/search";

export interface ComboOption {
  value: string;
  label: string;
}

interface Props {
  name: string;
  options: ComboOption[];
  defaultValue?: string;
  /**
   * The selection, when the caller holds it.
   *
   * Pass this and the picker stops keeping its own: the form owns the
   * value and can change it from outside, which is what a form with two
   * pickers that answer each other needs — choosing the animal fills in
   * its owner, and clearing the form clears both.
   *
   * A pair rather than an id, and the type is the point. A caller
   * pushing a value in has to be able to name it: the list on screen is
   * a capped fifty and the owner being filled in may not be on it, so an
   * id alone would leave a blank field over a full hidden input — the
   * state `defaultLabel` exists to prevent. Making the label impossible
   * to omit is cheaper than a rule saying not to.
   */
  value?: ComboOption | null;
  /**
   * The label for `defaultValue`, when it cannot be found in `options`.
   *
   * On an edit screen the picker is handed a capped list — fifty animals
   * out of a clinic's hundred and twenty — and the record being edited is
   * not necessarily in it. Without this the field opens blank while the
   * hidden input still carries the value: the vet sees an empty required
   * field, and the only honest reading of that is that the selection was
   * lost. It was not, which makes it worse — re-picking is the obvious
   * move, and re-picking is how the wrong animal gets attached to a visit.
   *
   * The caller always knows this string. It is loading the record anyway
   * in order to fill the rest of the form.
   */
  defaultLabel?: string;
  placeholder?: string;
  id?: string;
  required?: boolean;
  freeText?: boolean;
  allowCustom?: boolean;
  /** Renders the label for the "add new" row from the typed query. */
  addLabel?: (value: string) => string;
  noResultsLabel?: string;
  /**
   * Asks the server instead of filtering `options` locally.
   *
   * The list a picker is given used to be everything, capped at 500 —
   * so a clinic past that lost the end of the alphabet from every
   * picker with nothing said (`lib/pagination.ts`). Searching moves the
   * filter to where the records are, and the cap stops being a wall.
   *
   * It extends `options`, it does not replace them. The list a picker is
   * handed is the first fifty records of the clinic, and they stay
   * visible and browsable: a clinic of sixty would otherwise face an
   * empty dropdown until it typed two letters, having lost the ability
   * to look for a name it would recognise but cannot spell. Server hits
   * are appended after them, minus the ones already on show.
   */
  onSearch?: (term: string) => Promise<ComboOption[]>;
  /**
   * The server had more than it returned.
   *
   * Shown as an instruction, never as a count. What matters is not that
   * there are 500 of something; it is that the record someone is about
   * to re-create may be one of the ones not shown.
   */
  hasMore?: boolean;
  /** Below this many characters the server is not asked. */
  minSearchChars?: number;
  searchHintLabel?: string;
  /** Shown while the server is being asked. */
  searchingLabel?: string;
  /** Shown when the ask failed, which is not the same as finding none. */
  searchFailedLabel?: string;
  hasMoreLabel?: string;
  /**
   * `option` is null when the text was typed rather than chosen — free
   * text, or a custom value. A controlled caller stores the pair.
   */
  onValueChange?: (value: string, option: ComboOption | null) => void;
  // Injected by `Field`, which points the control at whichever message is
  // on screen. Named props rather than a spread: `Field` clones its child
  // with these two, and a picker that quietly drops them is a required
  // field whose error a screen reader never reaches (TEAM.md #26).
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  className?: string;
}

export function Combobox({
  name,
  options,
  defaultValue = "",
  defaultLabel,
  value: controlledValue,
  placeholder,
  id,
  required,
  freeText = false,
  allowCustom = false,
  addLabel,
  noResultsLabel,
  onSearch,
  hasMore = false,
  minSearchChars = 2,
  searchHintLabel,
  searchingLabel,
  searchFailedLabel,
  hasMoreLabel,
  onValueChange,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  className,
}: Props) {
  const controlled = controlledValue !== undefined;
  const initialLabel = controlled
    ? (controlledValue?.label ?? "")
    : freeText
      ? defaultValue
      : (options.find((o) => o.value === defaultValue)?.label ??
        defaultLabel ??
        (defaultValue && allowCustom ? defaultValue : ""));

  const [ownValue, setOwnValue] = React.useState(defaultValue);
  const value = controlled ? (controlledValue?.value ?? "") : ownValue;
  const [display, setDisplay] = React.useState(initialLabel);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  // Only filter once the user actually types; merely opening the dropdown
  // (with a committed selection in the input) must show the full list.
  const [typed, setTyped] = React.useState(false);
  // Whether the highlight has been moved since the list opened.
  //
  // Focusing the field opens the list, so by the time a keyboard user
  // presses Down it is already open and the old handler read that as
  // "advance" — the first Down landed on the *second* option. On the
  // vaccination picker that meant the first press skipped "Kuduz
  // (Rabies)", the most common vaccination in the country, and reaching
  // it took Down then Up. The first press now settles the highlight
  // where opening put it; the second one moves.
  const [moved, setMoved] = React.useState(false);
  const [remote, setRemote] = React.useState<ComboOption[]>([]);
  // Three things can be true while nothing is on screen, and the list
  // said "No results." to all of them: the server has not been asked
  // yet, it has been asked and has not answered, and it answered with
  // nothing. The middle one is the dangerous one — a vet reading "No
  // results." during the 200ms wait plus a round trip concludes the
  // client is not on file and opens a second record, which is the
  // outcome the search was added to prevent.
  //
  // And a fourth: the ask can fail. That was swallowed whole by
  // `.catch(() => undefined)` and also read as "No results." — an
  // error wearing the clothes of an absence, which is the one
  // substitution this product has decided it will not make.
  const [status, setStatus] = React.useState<"idle" | "asking" | "failed">(
    "idle",
  );
  // What was picked, kept beside `value` because nothing else can name
  // it once the list moves on. A record reached through the server is in
  // `remote` only until the next keystroke replaces it, and it was never
  // in `options`; without this, leaving the field looks up a label that
  // is nowhere and blanks a field whose hidden input is still full — the
  // state `defaultLabel` exists to prevent, arrived at from the other
  // side.
  const [ownChosen, setOwnChosen] = React.useState<ComboOption | null>(() =>
    defaultValue ? { value: defaultValue, label: initialLabel } : null,
  );
  const chosen = controlled ? (controlledValue ?? null) : ownChosen;
  const listId = React.useId();
  const noteId = `${listId}-note`;

  // Follow the caller when it moves the value from outside — picking an
  // animal fills in its owner, submitting clears both. Adjusted during
  // render rather than in an effect, which would paint the stale name
  // for a frame first; same pattern as `action-form.tsx`.
  //
  // Guarded on the value rather than run on every render, because the
  // text under the cursor belongs to whoever is typing until they stop.
  const [seenValue, setSeenValue] = React.useState(value);
  if (seenValue !== value) {
    setSeenValue(value);
    if (controlled) {
      setDisplay(controlledValue?.label ?? "");
      setTyped(false);
    }
  }

  const query = display.trim();
  const searching = Boolean(onSearch);
  // With a server search there is nothing to show until enough has been
  // typed — including before anything has been.
  const readyToSearch = typed && query.length >= minSearchChars;
  const belowThreshold = searching && !readyToSearch;

  // Ask the server, once the typing stops.
  //
  // Nothing is cleared here on the way down: `remote` is simply not read
  // below the threshold, so a stale list cannot show and the effect does
  // not have to write state synchronously to prevent it.
  //
  // What it does reset on the way back is two flags, and the second is
  // easy to miss. `active` returning to 0 is obvious; `moved` returning
  // to false is what stops the first Down on a fresh list from skipping
  // its first option — the same defect as before, reachable only through
  // search. And the stakes are higher here than they were: the list
  // changes under the highlight, so option zero is a different animal
  // than it was a keystroke ago.
  React.useEffect(() => {
    if (!onSearch || !readyToSearch) return;
    let live = true;
    const timer = setTimeout(() => {
      setStatus("asking");
      onSearch(query)
        .then((found) => {
          if (!live) return;
          setRemote(found);
          setActive(0);
          setMoved(false);
          setStatus("idle");
        })
        .catch(() => {
          if (!live) return;
          // Still caught rather than thrown: a picker that throws
          // takes the form down with it, and the form is where the
          // vet's typing lives. But it is reported now instead of
          // disappearing.
          setStatus("failed");
        });
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [onSearch, query, readyToSearch]);

  const local = typed
    ? options.filter((o) => matches(o.label, query))
    : options;
  // Second, and only what is new. The same client can come back from the
  // server that is already on the handed list, and reading a name twice
  // in one dropdown reads as two records.
  const shown = new Set(local.map((o) => o.value));
  const filtered = readyToSearch
    ? [...local, ...remote.filter((o) => !shown.has(o.value))]
    : local;

  // Everything the picker can name, which is not the same as everything
  // it can show: a selection stays nameable after the list it came from
  // is gone.
  function labelFor(v: string): string | undefined {
    if (!v) return undefined;
    return (
      options.find((o) => o.value === v)?.label ??
      remote.find((o) => o.value === v)?.label ??
      (chosen?.value === v ? chosen.label : undefined)
    );
  }
  const exact =
    options.find((o) => fold(o.label) === fold(query)) ??
    remote.find((o) => fold(o.label) === fold(query));
  const showAdd =
    allowCustom && !freeText && typed && query.length > 0 && !exact;

  function openList() {
    setOpen(true);
    setMoved(false);
    if (!typed) {
      // Highlight the current selection when browsing the full list.
      const i = options.findIndex((o) => o.value === value);
      setActive(i >= 0 ? i : 0);
    }
  }

  function commitValue(next: string, label: string, known: boolean) {
    const option = next ? { value: next, label } : null;
    setOwnValue(next);
    setOwnChosen(option);
    setDisplay(label);
    setOpen(false);
    setTyped(false);
    onValueChange?.(next, known ? option : null);
  }

  function selectOption(option: ComboOption) {
    commitValue(option.value, option.label, true);
  }

  function selectCustom() {
    commitValue(query, query, false);
  }

  function handleInput(text: string) {
    setDisplay(text);
    setOpen(true);
    setTyped(true);
    setActive(0);
    // Typing re-aims the list, so the first Down after it should move
    // rather than settle: the highlight is already where typing put it.
    setMoved(true);
    if (freeText) {
      setOwnValue(text);
      onValueChange?.(text, null);
    }
  }

  // When focus leaves the whole widget, reconcile display ↔ value.
  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setOpen(false);
    setTyped(false);
    if (freeText) return;
    if (exact) {
      if (exact.value !== value) commitValue(exact.value, exact.label, true);
      else setDisplay(exact.label);
    } else if (allowCustom && query) {
      if (query !== value) commitValue(query, query, false);
    } else if (!required && !query && value) {
      // Emptying an optional picker empties it. Reverting instead would
      // mean an optional field that cannot be un-answered once answered:
      // the reminder's animal is optional, and "actually, never mind
      // which animal" has to be sayable.
      commitValue("", "", true);
    } else {
      // Revert to the last committed selection.
      setDisplay(labelFor(value) ?? (allowCustom ? value : ""));
    }
  }

  // The note under the list, and it carries up to two sentences
  // because up to two things are true.
  //
  // It used to pick one: below the threshold the instruction, above it
  // the warning. That reads as though they were the same fact seen
  // from two sides, and pm measured what it costs. A clinic with 63
  // clients and a cap of 50 opens the picker and sees fifty names
  // under the words "type at least two letters to search" — an
  // invitation, not a warning. Thirteen records are missing and
  // nothing says so. Someone who scrolls the list, does not find who
  // they want, and creates a second record has done the exact thing
  // `ad6b01e` was written to prevent, and the sentence that would
  // have stopped them was already written and withheld until the
  // second keystroke.
  //
  // So: the warning whenever the list is short of the clinic, the
  // instruction whenever the server has not been asked yet, and both
  // together in the state where both are true.
  const showCapNote = hasMore && Boolean(hasMoreLabel);
  const showSearchHint = belowThreshold && Boolean(searchHintLabel);

  const rows: Array<{
    key: string;
    kind: "option" | "add";
    option?: ComboOption;
  }> = [
    ...filtered.map((o) => ({
      key: o.value,
      kind: "option" as const,
      option: o,
    })),
    ...(showAdd ? [{ key: "__add__", kind: "add" as const }] : []),
  ];
  const showNote = rows.length > 0 && (showCapNote || showSearchHint);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openList();
      else if (!moved) setMoved(true);
      else setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMoved(true);
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (!open || rows.length === 0) return;
      e.preventDefault();
      const row = rows[Math.min(active, rows.length - 1)];
      if (row.kind === "add") selectCustom();
      else if (row.option) selectOption(row.option);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={cn("relative", className)} onBlur={handleBlur}>
      {!freeText && <input type="hidden" name={name} value={value} />}
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        // Joined, not replaced. `Field` passes the error and the hint
        // in here, and overwriting them to announce the note would
        // trade a validation message for a footnote.
        aria-describedby={
          [describedBy, showNote ? noteId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        aria-invalid={invalid}
        aria-activedescendant={
          open && rows[active] ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        required={required}
        name={freeText ? name : undefined}
        value={display}
        placeholder={placeholder}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={openList}
        onKeyDown={handleKeyDown}
        className="h-10 w-full rounded-control border border-input bg-card px-3 pr-9 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onMouseDown={(e) => {
          e.preventDefault();
          if (open) setOpen(false);
          else openList();
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
      >
        <ChevronDown className="size-4" />
      </button>

      {open && (
        // The box and the scroll area are two elements now, and that is
        // the whole fix. They were one: the note sat as the last child
        // of the scrolling list, which put it below every option rather
        // than below the list. Rows are 36px and the box holds 256px, so
        // in a list of fifty the sentence saying "there are more" waited
        // forty-three rows down — unreachable by the one person who
        // needs it, the one who reads the first seven, concludes the
        // client is not on file, and opens a second record for them.
        // Not a phone problem: this is the desktop.
        <div className="absolute left-0 right-0 top-full z-30 mt-1 flex flex-col rounded-control border border-border bg-card shadow-lg">
          <ul
            id={listId}
            role="listbox"
            className="max-h-64 overflow-y-auto p-1"
          >
            {/* Three states, not two, and the first is not an empty one.
              "Type two more letters" is an instruction; dressing it as
              "no results" tells the user their clinic has no such
              record when nobody has looked yet (TEAM.md #19). The
              server returns an empty array in both cases, so the two
              are told apart here, by what the user has typed.

              Only when there is nothing above it. The instruction used
              to stand in the list's place, which hid the fifty records
              the page had already sent down. */}
            {rows.length === 0 && (
              <li
                className={cn(
                  "px-2.5 py-2 text-xs",
                  status === "failed"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {(belowThreshold ? searchHintLabel : undefined) ??
                  (status === "failed" ? searchFailedLabel : undefined) ??
                  (status === "asking" ? searchingLabel : undefined) ??
                  noResultsLabel ??
                  "-"}
              </li>
            )}
            {rows.map((row, i) =>
              row.kind === "add" ? (
                <li
                  key={row.key}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={active === i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectCustom();
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-control px-2.5 py-2 text-sm font-medium text-primary",
                    active === i && "bg-accent text-accent-foreground",
                  )}
                >
                  <Plus className="size-4" />
                  {addLabel ? addLabel(query) : `+ "${query}"`}
                </li>
              ) : (
                <li
                  key={row.key}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={active === i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(row.option!);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "cursor-pointer rounded-control px-2.5 py-2 text-sm",
                    active === i
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground",
                  )}
                >
                  {row.option!.label}
                </li>
              ),
            )}
          </ul>
          {/* Outside the list, in both senses. Visually it is pinned
            under the scroll area instead of floating away at the
            bottom of it. In the accessibility tree it is no longer a
            `role="presentation"` child of a listbox, which is a place
            nothing gets read: virtual focus walks the options and
            steps over everything else, so the note was missing from
            the screen reader for the same reason it was missing from
            the screen.

            It reaches the input through `aria-describedby` instead,
            which is how a fact about a control is supposed to travel.

            An instruction rather than a count: "500 of 1,200" tells a
            vet a number, and what they are about to do is open a
            second record for a client who is already in here. The
            records that fall off are not random either — the list is
            ordered, so it is always the same end of the alphabet
            missing, which reads exactly like "not on file". */}
          {showNote && (
            <div
              id={noteId}
              className="flex flex-col gap-0.5 border-t border-border px-2.5 py-2 text-xs text-muted-foreground"
            >
              {/* The fact first, the instruction second. What is
                  missing is the news; what to do about it only
                  matters once you know there is something to do. */}
              {showCapNote && <p>{hasMoreLabel}</p>}
              {showSearchHint && <p>{searchHintLabel}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
