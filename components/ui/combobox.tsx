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

export interface ComboOption {
  value: string;
  label: string;
}

interface Props {
  name: string;
  options: ComboOption[];
  defaultValue?: string;
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
  hasMoreLabel?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

// Combining marks. Not `\p{Diacritic}`, which needs a newer target than
// this file is compiled with.
const MARKS = /[\u0300-\u036f]/g;

/**
 * One comparable form of a name, so that typing it without a Turkish
 * keyboard still finds it: "Ayse" finds "Ayşe", "Cigdem" finds "Çiğdem".
 *
 * Only `ı` used to be folded, and the half-measure was worse than none:
 * the picker answered "no such client" about a client who is right
 * there, and a vet who believes it opens a second record for the same
 * person. Silent absence, and the four pickers that grew a search all
 * inherited it.
 *
 * Order matters and so does the leftover `ı` replacement. `ı` is a
 * letter, not an `i` wearing a mark, so decomposition does not touch it
 * and it has to be mapped by hand — deleting that line would break the
 * one case that worked before. Lowercasing first, in Turkish, turns `I`
 * into `ı` (mapped next) and `İ` into `i` plus a combining dot, which
 * the mark strip then removes. So "Istanbul", "İstanbul" and "istanbul"
 * all arrive at the same string.
 */
function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .normalize("NFD")
    .replace(MARKS, "");
}

function matches(label: string, query: string): boolean {
  if (!query) return true;
  return fold(label).includes(fold(query));
}

export function Combobox({
  name,
  options,
  defaultValue = "",
  defaultLabel,
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
  hasMoreLabel,
  onValueChange,
  className,
}: Props) {
  const initialLabel = freeText
    ? defaultValue
    : (options.find((o) => o.value === defaultValue)?.label ??
      defaultLabel ??
      (defaultValue && allowCustom ? defaultValue : ""));

  const [value, setValue] = React.useState(defaultValue);
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
  // What was picked, kept beside `value` because nothing else can name
  // it once the list moves on. A record reached through the server is in
  // `remote` only until the next keystroke replaces it, and it was never
  // in `options`; without this, leaving the field looks up a label that
  // is nowhere and blanks a field whose hidden input is still full — the
  // state `defaultLabel` exists to prevent, arrived at from the other
  // side.
  const [chosen, setChosen] = React.useState<ComboOption | null>(() =>
    defaultValue ? { value: defaultValue, label: initialLabel } : null,
  );
  const listId = React.useId();

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
      onSearch(query)
        .then((found) => {
          if (!live) return;
          setRemote(found);
          setActive(0);
          setMoved(false);
        })
        .catch(() => undefined);
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [onSearch, query, readyToSearch]);

  const local = typed ? options.filter((o) => matches(o.label, query)) : options;
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

  function commitValue(next: string, label: string) {
    setValue(next);
    setChosen(next ? { value: next, label } : null);
    setDisplay(label);
    setOpen(false);
    setTyped(false);
    onValueChange?.(next);
  }

  function selectOption(option: ComboOption) {
    commitValue(option.value, option.label);
  }

  function selectCustom() {
    commitValue(query, query);
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
      setValue(text);
      onValueChange?.(text);
    }
  }

  // When focus leaves the whole widget, reconcile display ↔ value.
  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setOpen(false);
    setTyped(false);
    if (freeText) return;
    if (exact) {
      if (exact.value !== value) commitValue(exact.value, exact.label);
      else setDisplay(exact.label);
    } else if (allowCustom && query) {
      if (query !== value) commitValue(query, query);
    } else {
      // Revert to the last committed selection.
      setDisplay(labelFor(value) ?? (allowCustom ? value : ""));
    }
  }

  // The note under the list. Two readings of one fact: above the
  // threshold the server has answered and still had more, below it the
  // server has not been asked at all — and what the user should do about
  // that is different enough to say differently.
  const footerLabel = belowThreshold ? searchHintLabel : hasMoreLabel;

  const rows: Array<{ key: string; kind: "option" | "add"; option?: ComboOption }> = [
    ...filtered.map((o) => ({ key: o.value, kind: "option" as const, option: o })),
    ...(showAdd ? [{ key: "__add__", kind: "add" as const }] : []),
  ];

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
        aria-activedescendant={open && rows[active] ? `${listId}-${active}` : undefined}
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
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-control border border-border bg-card p-1 shadow-lg"
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
            <li className="px-2.5 py-2 text-xs text-muted-foreground">
              {(belowThreshold ? searchHintLabel : undefined) ??
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
          {/* Last, after the options, because it is about what comes
              after them. An instruction rather than a count: "500 of
              1,200" tells a vet a number, and the thing they are about
              to do is open a second record for a client who is already
              in here. The records that fall off are not random either
              — the list is ordered, so it is always the same end of the
              alphabet missing, which reads exactly like "not on file". */}
          {hasMore && rows.length > 0 && footerLabel && (
            <li
              className="border-t border-border px-2.5 py-2 text-xs text-muted-foreground"
              // Not an option: it cannot be chosen and arrow keys must
              // not stop on it.
              role="presentation"
            >
              {footerLabel}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
