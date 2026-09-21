"use client";

// One-tap species picker for the pet form.
//
// Renders the clinic's enabled built-in species and its own custom species as
// icon chips, plus a "+ New species" chip that reveals an inline input. A
// species typed there becomes a selected chip immediately and is submitted
// as raw text (the server creates it for the clinic on save).

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { SpeciesIcon } from "@/components/species-icon";
import { cn } from "@/lib/utils";

export interface SpeciesChoice {
  value: string;
  label: string;
  /** Species key used for the icon (custom species fall back to OTHER). */
  icon?: string;
}

interface Props {
  name: string;
  /**
   * Names the group of chips for a screen reader.
   *
   * The `<label>` above cannot do it: `htmlFor` only binds to a labelable
   * element and this is a `div[role="group"]`, so before this the group
   * announced as "group" with no subject.
   */
  label: string;
  options: SpeciesChoice[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  newLabel: string;
  newHint: string;
  newPlaceholder: string;
  addLabel: string;
  manageHref?: string;
  manageLabel?: string;
}

export function SpeciesPicker({
  name,
  label,
  options,
  defaultValue = "",
  onChange,
  newLabel,
  newHint,
  newPlaceholder,
  addLabel,
  manageHref,
  manageLabel,
}: Props) {
  const [value, setValue] = React.useState(defaultValue);
  const [added, setAdded] = React.useState<SpeciesChoice[]>(() =>
    // An edited pet may reference a species key that is no longer listed
    // (e.g. disabled in settings, or a brand-new custom name); keep it visible.
    defaultValue && !options.some((o) => o.value === defaultValue)
      ? [{ value: defaultValue, label: defaultValue }]
      : [],
  );
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const all = [...options, ...added];

  function select(next: string) {
    setValue(next);
    onChange?.(next);
  }

  function commitDraft() {
    const nameTrimmed = draft.trim();
    if (!nameTrimmed) return;
    const existing = all.find(
      (o) => o.label.toLocaleLowerCase("tr") === nameTrimmed.toLocaleLowerCase("tr"),
    );
    if (existing) {
      select(existing.value);
    } else {
      setAdded((prev) => [...prev, { value: nameTrimmed, label: nameTrimmed }]);
      select(nameTrimmed);
    }
    setDraft("");
    setAdding(false);
  }

  React.useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  // One tab stop for the group, arrow keys inside it.
  //
  // Every chip used to be its own stop: eleven of them, for one required
  // field, so reaching the breed box below took thirteen keys instead of
  // three. A chip group is one choice and should cost one stop — the
  // pattern a radio group has had since forever, applied to buttons that
  // behave like one.
  //
  // The chip that carries the stop is the chosen one, so arriving lands
  // on the current answer rather than at the start of the list.
  const chips = React.useRef<Array<HTMLButtonElement | null>>([]);
  const stopIndex = Math.max(
    all.findIndex((o) => o.value === value),
    0,
  );

  function moveFocus(from: number, delta: number) {
    const count = chips.current.length;
    if (count === 0) return;
    const next = (from + delta + count) % count;
    chips.current[next]?.focus();
  }

  function onChipKeyDown(e: React.KeyboardEvent, index: number) {
    const keys: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    if (e.key in keys) {
      e.preventDefault();
      moveFocus(index, keys[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      chips.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      chips.current[chips.current.length - 1]?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={value} />
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {all.map((o, i) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              ref={(el) => {
                chips.current[i] = el;
              }}
              tabIndex={i === stopIndex ? 0 : -1}
              onKeyDown={(e) => onChipKeyDown(e, i)}
              onClick={() => select(o.value)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-control border px-3 text-sm transition-colors",
                active
                  ? "border-primary bg-accent font-medium text-accent-foreground ring-2 ring-ring/30"
                  : "border-border bg-card text-foreground hover:border-primary/40",
              )}
            >
              <SpeciesIcon species={o.icon ?? "OTHER"} className="size-4" />
              {o.label}
            </button>
          );
        })}

        {!adding && (
          <button
            type="button"
            ref={(el) => {
              chips.current[all.length] = el;
            }}
            tabIndex={stopIndex === all.length ? 0 : -1}
            onKeyDown={(e) => onChipKeyDown(e, all.length)}
            onClick={() => setAdding(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-control border border-dashed border-primary/50 px-3 text-sm font-medium text-primary transition-colors hover:bg-accent"
          >
            <Plus className="size-4" />
            {newLabel}
          </button>
        )}
      </div>

      {adding && (
        <div className="flex flex-col gap-1.5 rounded-control border border-border bg-muted/30 p-3">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              placeholder={newPlaceholder}
              maxLength={60}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitDraft();
                } else if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              className="h-10 flex-1 rounded-control border border-input bg-card px-3 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            <button
              type="button"
              onClick={commitDraft}
              disabled={!draft.trim()}
              className="h-10 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {addLabel}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{newHint}</p>
        </div>
      )}

      {manageHref && manageLabel && (
        <Link
          href={manageHref}
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {manageLabel}
        </Link>
      )}
    </div>
  );
}
