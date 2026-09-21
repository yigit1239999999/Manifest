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
import { fold } from "@/lib/search";
import { cn } from "@/lib/utils";

export interface SpeciesChoice {
  value: string;
  label: string;
  /** Species key used for the icon (custom species fall back to OTHER). */
  icon?: string;
}

/**
 * A built-in species the clinic has turned off.
 *
 * Turning a species off says what the picker offers, not what exists.
 * Without these the picker could not tell "Kedi" from a species nobody
 * had heard of: it searched only what it was showing, so typing the
 * name of a switched-off built-in minted a second concept with the same
 * name and filed the animal under `OTHER`. That cat then fell out of
 * every list and count that groups by `CAT`, silently and for good.
 */
export interface HiddenSpecies {
  /** The enum key, which is what gets submitted. */
  value: string;
  /** How it is written in the reader's language. */
  label: string;
  /**
   * Every name it may be typed as, in both languages.
   *
   * Both, because a vet typing "cat" into a Turkish interface is not
   * making a mistake, and because the comparison is folded anyway —
   * "Kopek" has to reach `DOG` the same as "Köpek" does.
   */
  names: string[];
  /** The whole sentence shown once it has been chosen. */
  note: string;
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
  /** Built-ins this clinic has turned off. */
  hiddenBuiltIns?: HiddenSpecies[];
  /** Reads after the name on the chip: "· turned off for this clinic". */
  hiddenQualifier?: string;
  /**
   * Whether the field this picker answers came back rejected.
   *
   * `Field` injects this into its single child, and this component
   * was that child and dropped it — so on a form with three errors
   * only two controls were marked, and the unmarked one was where a
   * summary line sent you. ux measured it.
   *
   * Read, and deliberately not passed on. `aria-invalid` is a widget
   * attribute and `role="group"` is a structure role that does not
   * support it; ESLint says so and it is right. So the value drives
   * the visible border, and the part a screen reader needs travels
   * the way a group can carry it — `aria-describedby`, below.
   */
  "aria-invalid"?: boolean | "true" | "false";
  /**
   * The error text `Field` has already rendered under this group.
   *
   * Forwarded to the group, which is where it is allowed and where it
   * is read on arrival. Without it the group announced its name and
   * nothing about being rejected.
   */
  "aria-describedby"?: string;
}

// There is deliberately no way to turn the species back on from here,
// and it was tried. A link at the end of the note called "Open in
// settings" opened nothing — it went to Settings and left the vet to
// find the species themselves, which is a control named after a result
// it does not produce. Naming it honestly ("Go to species settings")
// made it word for word the standing `manageLabel` link below the
// chips, two links to one place stacked on top of each other. And the
// moment it appears is the moment a vet should not be going to
// Settings at all: the animal is on the table and the form is unsaved.
//
// The standing link is still there, under the chips, behind the same
// permission. Nothing is lost by not offering it twice.

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
  hiddenBuiltIns,
  hiddenQualifier,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
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

  /**
   * The built-in this text is the name of, if any.
   *
   * Folded through `lib/search`, the same function the database folds
   * with. The old comparison was `toLocaleLowerCase("tr")`, which holds
   * "Kopek" and "Köpek" apart — and someone typing a species name
   * without a Turkish keyboard is exactly the person this is for. A
   * second fold written here would be a second thing to keep in step;
   * there is one.
   */
  function hiddenMatch(text: string) {
    const needle = fold(text.trim());
    if (!needle) return undefined;
    return hiddenBuiltIns?.find((s) => s.names.some((n) => fold(n) === needle));
  }

  function commitDraft() {
    const typed = draft.trim();
    if (!typed) return;
    const existing = all.find((o) => fold(o.label) === fold(typed));
    const hidden = existing ? undefined : hiddenMatch(typed);
    if (existing) {
      select(existing.value);
    } else if (hidden) {
      chooseHidden(hidden);
      return;
    } else {
      setAdded((prev) => [...prev, { value: typed, label: typed }]);
      select(typed);
    }
    setDraft("");
    setAdding(false);
  }

  /** Take the built-in itself, not a new species wearing its name. */
  function chooseHidden(hidden: HiddenSpecies) {
    setAdded((prev) =>
      prev.some((o) => o.value === hidden.value)
        ? prev
        : [
            ...prev,
            { value: hidden.value, label: hidden.label, icon: hidden.value },
          ],
    );
    select(hidden.value);
    setDraft("");
    setAdding(false);
  }

  const suggestion = adding ? hiddenMatch(draft) : undefined;
  // Shown after the fact, and only for a built-in that is still off.
  // Its whole job is to say the setting has not changed.
  const chosenHidden = hiddenBuiltIns?.find((s) => s.value === value);

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
      <div
        role="group"
        aria-label={label}
        aria-describedby={describedBy}
        className={cn(
          // The border is here even when nothing is wrong, transparent,
          // so going wrong changes a colour rather than adding a pixel
          // — otherwise the group grows on rejection and everything
          // below it jumps.
          "flex flex-wrap gap-2 rounded-control border border-transparent",
          // A border and not an outline: `outline` is the focus
          // mechanism everywhere here, and a group that is both
          // focused and rejected would wear two of them with nothing
          // to tell them apart. One channel each — border for wrong,
          // outline for where you are.
          //
          // On the group, not the chips. "No species chosen" means
          // none of them is wrong, there is simply no answer;
          // colouring them would say each had failed, and the chosen
          // chip already carries a state in its fill.
          invalid && invalid !== "false" && "border-destructive",
        )}
      >
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
          {/* `flex-wrap`, and this is the whole of the 390px fix. The
              row holds the text input and, when what is typed names a
              species that is switched off, the suggestion chip. At 390
              the input kept its width and the chip was pushed 76px
              past the edge of the screen — not clipped, so the page
              scrolled sideways, and the qualifier that is the entire
              point of the chip was the part off screen. Wrapping puts
              the chip under the input: name and qualifier both fit,
              and the wide layout is unchanged. */}
          <div className="flex flex-wrap gap-2">
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
            {suggestion ? (
              // The built-in itself, in place of "Add". What was typed
              // is the name of something that already exists, so the
              // offer is to use it rather than to mint a second one —
              // and the qualifier is on the chip, where the decision is
              // being made, not in a sentence underneath it.
              <button
                type="button"
                onClick={() => chooseHidden(suggestion)}
                className="inline-flex h-10 items-center gap-2 rounded-control border border-primary bg-accent px-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80"
              >
                <SpeciesIcon species={suggestion.value} className="size-4" />
                {suggestion.label}
                {hiddenQualifier && (
                  <span className="text-xs font-normal text-muted-foreground">
                    · {hiddenQualifier}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={commitDraft}
                disabled={!draft.trim()}
                className="h-10 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {addLabel}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{newHint}</p>
        </div>
      )}

      {chosenHidden && (
        // Says what happened and, as carefully, what did not. No word
        // here may read as "turned on" or "enabled": the animal got a
        // species, the clinic's setting is exactly where it was.
        <p className="text-xs text-muted-foreground">{chosenHidden.note}</p>
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
