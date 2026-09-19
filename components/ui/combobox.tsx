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
  placeholder?: string;
  id?: string;
  required?: boolean;
  freeText?: boolean;
  allowCustom?: boolean;
  /** Renders the label for the "add new" row from the typed query. */
  addLabel?: (value: string) => string;
  noResultsLabel?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

// Lowercase both Turkish-style and ASCII-style, so "Istanbul" finds
// "İstanbul" and lowercase-dotless input still matches.
function fold(s: string): [string, string] {
  return [s.toLocaleLowerCase("tr").replaceAll("ı", "i"), s.toLowerCase()];
}

function matches(label: string, query: string): boolean {
  if (!query) return true;
  const [trLabel, enLabel] = fold(label);
  const [trQ, enQ] = fold(query);
  return trLabel.includes(trQ) || enLabel.includes(enQ);
}

export function Combobox({
  name,
  options,
  defaultValue = "",
  placeholder,
  id,
  required,
  freeText = false,
  allowCustom = false,
  addLabel,
  noResultsLabel,
  onValueChange,
  className,
}: Props) {
  const initialLabel = freeText
    ? defaultValue
    : (options.find((o) => o.value === defaultValue)?.label ??
      (defaultValue && allowCustom ? defaultValue : ""));

  const [value, setValue] = React.useState(defaultValue);
  const [display, setDisplay] = React.useState(initialLabel);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  // Only filter once the user actually types; merely opening the dropdown
  // (with a committed selection in the input) must show the full list.
  const [typed, setTyped] = React.useState(false);
  const listId = React.useId();

  const query = display.trim();
  const filtered = typed
    ? options.filter((o) => matches(o.label, query))
    : options;
  const exact = options.find(
    (o) => fold(o.label)[0] === fold(query)[0],
  );
  const showAdd =
    allowCustom && !freeText && typed && query.length > 0 && !exact;

  function openList() {
    setOpen(true);
    if (!typed) {
      // Highlight the current selection when browsing the full list.
      const i = options.findIndex((o) => o.value === value);
      setActive(i >= 0 ? i : 0);
    }
  }

  function commitValue(next: string, label: string) {
    setValue(next);
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
      const current = options.find((o) => o.value === value);
      setDisplay(current?.label ?? (allowCustom ? value : ""));
    }
  }

  const rows: Array<{ key: string; kind: "option" | "add"; option?: ComboOption }> = [
    ...filtered.map((o) => ({ key: o.value, kind: "option" as const, option: o })),
    ...(showAdd ? [{ key: "__add__", kind: "add" as const }] : []),
  ];

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openList();
      else setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
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
        className="h-10 w-full rounded-lg border border-input bg-card px-3 pr-9 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
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
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {rows.length === 0 && (
            <li className="px-2.5 py-2 text-xs text-muted-foreground">
              {noResultsLabel ?? "-"}
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
                  "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-primary",
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
                  "cursor-pointer rounded-md px-2.5 py-2 text-sm",
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
      )}
    </div>
  );
}
