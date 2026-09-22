"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

// Three answers and not two, and the third is the one the counter
// produces. Until now "nobody has asked" was the absence of a
// selection: true and false were the only things a reader could click,
// and unasked was what you got by clicking neither. That reads as an
// unfinished form rather than as an answer, and it is an answer -- it
// is the honest state of most clients on the day they are created.
//
// Stated in this order because the vet stated it in this order, and
// carried as a table so the control, its wording and its sentence
// cannot drift apart. The empty string is what the wire wants: the
// schema turns anything that is not "true" or "false" into no value at
// all, which is how "not asked" stays distinct from "refused" all the
// way to the column.
//
// Deliberately not `required`, and deliberately not pre-selected. The
// vet's reason covers the first: "if you force me I will tick one at
// random, and that means messaging someone who never agreed." A forced
// answer is worse than no answer, because it cannot be told from a real
// one. The second is ux's and is the same thought one step further --
// a default IS a light kind of forcing, and unasked is not one of the
// three answers. It is the absence of one.
// And the third one writes NOTHING to the column, on purpose.
//
// "Not now" and an untouched form both arrive as null, because the
// product does the same thing in both cases: no message goes out, and
// the question has to be asked again. A fourth column value would add
// no information and would put every consumer of this field --
// `reminderCensus`, the dashboard count, the delivery lines -- in front
// of a state it has never seen.
//
// Written here rather than left in a decision nobody can find later: in
// six months the distinction will look forgotten rather than declined,
// and somebody will add it back as a fourth value. That is the shape of
// the defect this product already paid for once with `DRAFT`.
export const CONSENT_ANSWERS = ["true", "false", ""] as const;

export type ConsentAnswer = (typeof CONSENT_ANSWERS)[number];

interface Props {
  name: string;
  /**
   * What the record already says, or `null` for a question nobody has
   * reached.
   *
   * Four values for three radios, and the fourth is "nobody has touched
   * this yet". `null` leaves every radio clear; `""` is the reader
   * choosing to put the question off. Both reach the column as no value
   * at all, and that is not a loss: postponing is a fact about the
   * minute, not about the client. What the extra value buys is the
   * difference on screen between a question nobody has reached and one
   * somebody has decided to leave -- so a caller reopening a record
   * passes `null`, never `""`, for a column that is empty.
   */
  defaultValue?: ConsentAnswer | null;
  /** The name of the question, read out as the group's label. */
  legend: string;
  /** The answer as the reader clicks it, and the consequence underneath. */
  labels: Record<ConsentAnswer, string>;
  hints: Record<ConsentAnswer, string>;
  className?: string;
}

/**
 * The three-way consent question, wherever it is asked.
 *
 * A primitive rather than a block inside one form because the reasons
 * that hold it together do not survive being copied: the 28px target,
 * the description living on the inputs instead of the group, and three
 * answers whose wording, value and sentence have to stay in step. The
 * second copy is where one of those quietly goes missing.
 *
 * The words come from the caller. The question a receptionist reads out
 * at the counter and the same three states reported on a record's page
 * are not the same sentences, and a primitive that carried one set would
 * be wrong in one of the two places.
 */
export function ConsentChoice({
  name,
  defaultValue = null,
  legend,
  labels,
  hints,
  className,
}: Props) {
  const noteId = useId();
  // Held in state only because the sentence underneath changes with it;
  // the radios are what the form submits.
  const [consent, setConsent] = useState<ConsentAnswer | null>(defaultValue);

  return (
    // `min-w-0` because a fieldset's default minimum width is its
    // min-content, which in a grid column is how a long legend pushes
    // the page wider than the phone it is on.
    //
    // A plain `fieldset` rather than `Field`: `Field` associates one
    // label with one control and injects the id, and a group of radios
    // needs a `legend` instead — the name of the question, not of any
    // one answer.
    <fieldset className={cn("min-w-0", className)}>
      {/* The fieldset stays a plain block and the contents get their
          own flex wrapper. A `legend` is laid out by the engine rather
          than by its parent's display mode, so a flex or grid fieldset
          puts it somewhere none of the three agree on; keeping the
          layout one level in is the boring arrangement that renders the
          same everywhere. */}
      <legend className="mb-2 text-sm font-medium text-foreground">
        {legend}
      </legend>
      {/* One per line until there is room for a row, which is the
          pattern rather than a repair. GOV.UK keeps radios stacked by
          default and reserves the side-by-side row for two short
          answers -- yes and no -- because three of them in a row make
          the scanning order ambiguous and, once the line runs out, the
          wrap looks arbitrary to the reader.

          This product had reached the second half of that by
          measurement. pm measured the three answers at 390px: 64px in
          Turkish, where they take two lines, against 28px in English,
          where they take one. The same question was a different height
          in two languages and nobody had decided that. And in the
          narrowest place this control is used -- the new-animal block
          on `/visits/new`, about 196px of room -- BOTH languages wrap.

          Stacking makes the height a fact of the layout instead of a
          fact of the wording, which is what lets a skeleton reserve it
          (`ConsentSkeleton`) and what stops the next translation from
          silently changing it. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
        {CONSENT_ANSWERS.map((answer) => (
          <label
            key={answer}
            // `py-1` is not padding for looks. The label is the
            // clickable target — bigger than the 16px box, which is the
            // point — but at `text-sm` its height was the line box,
            // 20px, and WCAG 2.5.8 asks for 24. pm measured it: 81×20
            // and 101×20 in Turkish, 111×20 and 80×20 in English. Width
            // was never the problem; height was, on the two controls a
            // phone user taps to answer a consent question. This makes
            // it 28.
            // `w-fit` so the target stays the size of the answer even
            // when the answers are stacked. A label as wide as the
            // column reads as a button rather than as a radio, and it
            // keeps the measured targets (81×28 and 101×28 in Turkish,
            // 111×28 and 80×28 in English) the same at both widths.
            className="flex min-h-6 w-fit items-center gap-2 py-1 text-sm text-foreground"
          >
            <input
              type="radio"
              name={name}
              value={answer}
              // On the inputs, not on the `fieldset`.
              //
              // The line underneath was visible and silent: it told
              // anyone who could see it that no automatic message goes
              // out until an answer is recorded, and told nobody else. A
              // description on a `fieldset` is announced unevenly across
              // screen readers; on the control it is read when focus
              // arrives, which is the moment the sentence is about. One
              // channel rather than both, for the same reason the error
              // summary is not also a live region — two copies of one
              // sentence is not twice the information.
              aria-describedby={noteId}
              checked={consent === answer}
              onChange={() => setConsent(answer)}
              // No focus class and no `accent-color`: both come from the
              // rules in `app/globals.css` that cover every tick and
              // radio in the product. A tenth copy here would be the one
              // that drifts.
              className="size-4"
            />
            {labels[answer]}
          </label>
        ))}
      </div>
      {/* All three states say something, including the empty one
          (TEAM.md #21). Unanswered and declined end in the same silence
          and are not the same fact: one is work still to do, the other
          is a closed question. And consent needs a sentence of its own —
          copy that only describes the refusal leaves the vet to infer
          what a yes buys. */}
      <p id={noteId} className="mt-2 text-xs text-muted-foreground">
        {hints[consent ?? ""]}
      </p>
    </fieldset>
  );
}
