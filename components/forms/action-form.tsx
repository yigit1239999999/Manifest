"use client";

// One place where every server-action form gets the behaviour users expect
// when validation fails:
//
// 1. Nothing typed is lost. React resets uncontrolled inputs once a form
//    action resolves, so the action echoes the submission back in
//    `state.values` and we put it into the DOM again (controlled components
//    keep their own value and are left alone).
// 2. A field error disappears the moment the field is fixed, instead of
//    lingering until the next submit.
//
// Usage:
//
//   const form = useActionForm(createPetAction);
//   const { state } = form;
//   <ActionForm form={form} className="...">…</ActionForm>

import * as React from "react";
import { useTranslations } from "next-intl";
import { Callout } from "@/components/ui/callout";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/lib/action";

const EMPTY: readonly string[] = [];
const EMPTY_SUMMARY: { name: string; label: string; message: string }[] = [];

function sameSummary(
  a: { name: string; message: string }[],
  b: { name: string; message: string }[],
) {
  return (
    a.length === b.length &&
    a.every((x, i) => x.name === b[i].name && x.message === b[i].message)
  );
}

type FormAction = (
  state: FormState,
  formData: FormData,
) => FormState | void | Promise<FormState | void>;

export interface ActionFormApi {
  /** Server state with errors for already-corrected fields removed. */
  state: FormState;
  pending: boolean;
  formAction: (formData: FormData) => void;
  /** Clears the form — typically after a successful submit. */
  reset: () => void;
  /** Drops the error shown under `name`. */
  clearFieldError: (name: string) => void;
  /** Incremented by `reset()`; the <ActionForm> watches it. */
  resetToken: number;
  /**
   * Incremented once per server response, whatever the response says.
   *
   * The <ActionForm> scrolls a failure into view off this rather than off
   * the message: the same rejection twice is two events, and a comparison
   * on the sentence would leave the second submit looking like nothing
   * happened.
   */
  responseToken: number;
  /**
   * Messages for fields this form does not render. The <ActionForm> works out
   * which those are and reports them, and they surface in `state.error` —
   * otherwise a rejected submit would look like nothing happened at all.
   */
  reportHomelessErrors: (messages: readonly string[]) => void;
}

export function useActionForm(
  action: FormAction,
  initialState: FormState = {},
): ActionFormApi {
  const [raw, formAction, pending] = useActionState(
    action as (state: FormState, formData: FormData) => Promise<FormState>,
    initialState,
  );

  const router = useRouter();

  // A form that stays on the page after saving (a reminder, a note, a
  // vaccination) has to show what it just added. Without this the list
  // still reads "none" and the user saves the same thing again.
  React.useEffect(() => {
    if (raw.success) router.refresh();
  }, [raw, router]);

  const [cleared, setCleared] = React.useState<readonly string[]>([]);
  const [resetToken, setResetToken] = React.useState(0);
  const [homeless, setHomeless] = React.useState<readonly string[]>([]);

  // Every server response re-arms all of its messages.
  const [seen, setSeen] = React.useState(raw);
  // Counts server responses, not messages. The same rejection twice is two
  // events the user needs shown twice; comparing the sentence would make
  // the second submit look like nothing happened at all.
  const [responseToken, setResponseToken] = React.useState(0);
  let active = cleared;
  if (seen !== raw) {
    setSeen(raw);
    setResponseToken((n) => n + 1);
    if (cleared.length > 0) setCleared([]);
    if (homeless.length > 0) setHomeless([]);
    active = [];
  }

  const reportHomelessErrors = React.useCallback(
    (messages: readonly string[]) => {
      setHomeless((prev) =>
        prev.length === messages.length && prev.every((m, i) => m === messages[i])
          ? prev
          : messages,
      );
    },
    [],
  );

  const clearFieldError = React.useCallback((name: string) => {
    setCleared((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }, []);

  const reset = React.useCallback(() => setResetToken((n) => n + 1), []);

  const state = React.useMemo(() => {
    let next = raw;
    if (raw.fieldErrors && active.length > 0) {
      const fieldErrors: Record<string, string[]> = {};
      for (const [field, messages] of Object.entries(raw.fieldErrors)) {
        if (!active.includes(field)) fieldErrors[field] = messages;
      }
      next = {
        ...raw,
        fieldErrors:
          Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
      };
    }
    if (homeless.length > 0) {
      // Beside the form-level error, not instead of it. A submit can fail
      // for two reasons at once — "the invoice needs a client" and "line 2
      // has no price" — and the second used to be dropped whenever the
      // first was present, because there is no `Field` for it to land in.
      next = {
        ...next,
        error: [next.error, ...homeless].filter(Boolean).join(" "),
      };
    }
    return next;
  }, [raw, active, homeless]);

  return {
    state,
    pending,
    formAction,
    reset,
    clearFieldError,
    resetToken,
    responseToken,
    reportHomelessErrors,
  };
}

interface ActionFormProps extends Omit<React.ComponentProps<"form">, "action"> {
  form: ActionFormApi;
}

export function ActionForm({ form, onInput, onClick, ...props }: ActionFormProps) {
  const {
    state,
    formAction,
    clearFieldError,
    resetToken,
    responseToken,
    reportHomelessErrors,
  } = form;
  const ref = React.useRef<HTMLFormElement>(null);
  const values = state.values;
  const fieldErrors = state.fieldErrors;

  React.useEffect(() => {
    restoreValues(ref.current, values);
  }, [values]);

  // An error for a field this form doesn't render (a hidden id, say) would be
  // invisible, and the submit would look like it silently did nothing. Hand
  // those messages back so they show up in the form-level error box.
  React.useEffect(() => {
    if (!fieldErrors) {
      reportHomelessErrors(EMPTY);
      return;
    }
    const rendered = new Set(
      Array.from(ref.current?.elements ?? [])
        .map((el) => (el as HTMLInputElement).name)
        .filter(Boolean),
    );
    const homeless = Object.entries(fieldErrors)
      .filter(([field]) => !rendered.has(field))
      .flatMap(([, messages]) => messages);
    reportHomelessErrors(homeless);
  }, [fieldErrors, reportHomelessErrors]);

  // Where a rejected submit is reported, and the only place it is.
  //
  // This box used to be copied into every form, and the rule that a failure
  // belongs inline rather than in a toast held in one of eighteen — because
  // a rule you have to remember to copy is a rule the nineteenth form will
  // not have. Owning it here means no form can forget, and the scroll below
  // has a target it does not have to go looking for.
  //
  // `col-span-full` rather than `sm:col-span-2`: it spans whatever the grid
  // turns out to be, and does nothing at all in the flex and stacked forms.
  // The six forms that carried `sm:col-span-2` by hand were right until a
  // grid grew a third column.
  const errorBox = React.useRef<HTMLDivElement>(null);
  const t = useTranslations("common");

  // One line per broken field, each a way back to it.
  //
  // ux measured what a failed submit cost before this existed: focus on
  // `body`, no announcement of any kind, and **22 Tab presses** from
  // there to the first bad field — the skip link, the logo, ten sidebar
  // links, search, three theme segments, two language buttons, sign
  // out. A vet correcting a typo walked the whole navigation skeleton
  // of the product to reach it.
  //
  // Built from the DOM rather than from a registry, because the form
  // already knows which of its errors have a field: the same scan below
  // works out which do not. A label is read through the control's `id`,
  // which `Field` has already injected — so a form gets this without
  // passing anything, and a form that stops using `Field` loses the
  // entry rather than shipping a broken link.
  const [summary, setSummary] = React.useState<
    { name: string; label: string; message: string }[]
  >([]);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || !fieldErrors) {
      setSummary(EMPTY_SUMMARY);
      return;
    }
    const next: { name: string; label: string; message: string }[] = [];
    for (const [name, messages] of Object.entries(fieldErrors)) {
      const control = element.querySelector(`[name="${CSS.escape(name)}"]`);
      if (!control) continue; // Homeless: it is in the box's first line.
      const id = control.getAttribute("id");
      const label = id
        ? element.querySelector(`label[for="${CSS.escape(id)}"]`)
        : null;
      next.push({
        name,
        // Falling back to the field's own name is deliberate and ugly on
        // purpose: an entry reading "petId" is a visible sign that a
        // control is unlabelled, which is a defect worth seeing rather
        // than an entry silently going missing.
        label: label?.textContent?.trim() || name,
        message: messages[0],
      });
    }
    setSummary((prev) => (sameSummary(prev, next) ? prev : next));
  }, [fieldErrors, responseToken]);

  /** Put the cursor on the control a summary line names. */
  const goToField = React.useCallback((name: string) => {
    const element = ref.current;
    if (!element) return;
    const control = element.querySelector(`[name="${CSS.escape(name)}"]`);
    // A hidden input carries the value for comboboxes and chip pickers;
    // the thing a person types into is the one marked invalid.
    const target =
      control instanceof HTMLElement &&
      !(control instanceof HTMLInputElement && control.type === "hidden")
        ? control
        : element.querySelector<HTMLElement>('[aria-invalid="true"]');
    target?.focus();
    target?.scrollIntoView({ block: "nearest" });
  }, []);

  // On a long form (a visit, a pet, an invoice) the submit button is far
  // below the box, so without this the page does not move and the user sees
  // nothing happen at all. `block: "nearest"` scrolls the minimum needed: a
  // box already on screen stays exactly where it is.
  //
  // Keyed to the response, not the message: the same rejection twice is two
  // events, and the second one has to be shown too.
  //
  // Focus IS moved into the box now, and the condition written here for
  // changing it is the one that was met.
  //
  // It used to say: focus stays on the submit button, the price is that
  // it may be off screen, and the observation that would change this is
  // someone seeing it fail in real use. ux measured worse than the price
  // named — focus was not on the submit button at all. `SubmitButton`
  // disabled itself on press, and a control disabled under the user's
  // finger drops focus to `body`. The disabling lasted under 150ms; the
  // focus loss was permanent. From `body` to the first bad field: 22
  // Tab presses, and nothing announced at any point.
  //
  // The old note also said moving focus and `live={false}` go together,
  // never one alone, and that pairing is kept: the box is focused, so
  // it is not a live region. A focused element is read on arrival; a
  // `role="alert"` that is also focused is read twice in some screen
  // reader and browser pairings (see `callout.tsx`). ux asked for
  // `role="alert"` by name and this is the one place I have not done
  // exactly that — flagged rather than quietly substituted.
  //
  // Reduced motion removes the animation, not the scroll: the movement
  // carries information here, it is not decoration.
  // Skipped on mount: a message that was there at first paint did not
  // arrive, so there is nothing to bring the user's attention to.
  const firstResponse = React.useRef(true);
  React.useEffect(() => {
    if (firstResponse.current) {
      firstResponse.current = false;
      return;
    }
    const target =
      errorBox.current ?? ref.current?.querySelector('[aria-invalid="true"]');
    if (!(target instanceof HTMLElement)) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      block: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
    // After the scroll, so the box is where it will stay. A successful
    // submit has no box and nothing is touched: the page is changing
    // and stealing focus from whatever it becomes would be its own
    // defect.
    target.focus();
  }, [responseToken]);

  // Skip the initial render: only an explicit reset() clears the form.
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    ref.current?.reset();
  }, [resetToken]);

  // A field counts as corrected once its value differs from what was
  // submitted. Reading the form itself (rather than the event target) also
  // covers chips, comboboxes and other widgets that write to a hidden input.
  // Events fire before React has flushed the state they triggered, so the
  // scan waits a tick.
  const scan = React.useCallback(() => {
    const fieldErrors = state.fieldErrors;
    if (!fieldErrors) return;
    setTimeout(() => {
      const element = ref.current;
      if (!element) return;
      const data = new FormData(element);
      for (const name of Object.keys(fieldErrors)) {
        const current = data.get(name);
        if (typeof current !== "string") continue;
        if (current !== (values?.[name] ?? "")) clearFieldError(name);
      }
    }, 0);
  }, [state.fieldErrors, values, clearFieldError]);

  const { children, ...rest } = props;

  return (
    <form
      {...rest}
      ref={ref}
      action={formAction}
      onInput={(e) => {
        scan();
        onInput?.(e);
      }}
      onClick={(e) => {
        scan();
        onClick?.(e);
      }}
    >
      {(state.error || summary.length > 0) && (
        <Callout
          ref={errorBox}
          variant="danger"
          // Not a live region, because it takes focus. See the note
          // above: one or the other, never both.
          live={false}
          tabIndex={-1}
          // The one place a failure is reported, named so that a test
          // can find it without asserting the mechanism. It used to be
          // found by `role="alert"`, which is exactly the thing that
          // had to change.
          data-form-error=""
          className="col-span-full outline-none"
          title={
            summary.length > 0
              ? t("errorSummary", { count: summary.length })
              : undefined
          }
        >
          {state.error && <p>{state.error}</p>}
          {summary.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5">
              {summary.map((item) => (
                <li key={item.name}>
                  {/* A button, not an `href="#id"`: a link would move
                      the cursor to the field's container and leave the
                      control itself unfocused, and half these controls
                      are a hidden input with a widget in front of them.
                      The visible text is short because it sits in a
                      list; the accessible name says where it goes. */}
                  <button
                    type="button"
                    onClick={() => goToField(item.name)}
                    aria-label={t("errorSummaryGoTo", { field: item.label })}
                    className="rounded-control text-start underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-2"
                  >
                    {item.label}: {item.message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Callout>
      )}
      {children}
    </form>
  );
}

/** Puts a failed submission's values back into the fields React reset. */
function restoreValues(
  form: HTMLFormElement | null,
  values: Record<string, string> | undefined,
) {
  if (!form || !values) return;

  for (const element of Array.from(form.elements)) {
    const control = element as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement;
    const name = control.name;
    if (!name || control.disabled) continue;

    if (control instanceof HTMLInputElement) {
      if (control.type === "file" || control.type === "submit") continue;
      if (control.type === "checkbox" || control.type === "radio") {
        // An unchecked box never reaches FormData, so absence means "off".
        const checked = values[name] === control.value;
        if (control.checked !== checked) control.checked = checked;
        continue;
      }
    }

    const submitted = values[name];
    if (submitted === undefined || control.value === submitted) continue;

    if (control instanceof HTMLSelectElement) {
      if (Array.from(control.options).some((o) => o.value === submitted)) {
        control.value = submitted;
      }
      continue;
    }

    // Only touch controls React actually reset to their default. A
    // controlled component still holds the user's value and owns its DOM.
    if (control.value === control.defaultValue) control.value = submitted;
  }
}
