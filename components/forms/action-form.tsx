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
import { useActionState } from "react";
import type { FormState } from "@/lib/action";

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
}

export function useActionForm(
  action: FormAction,
  initialState: FormState = {},
): ActionFormApi {
  const [raw, formAction, pending] = useActionState(
    action as (state: FormState, formData: FormData) => Promise<FormState>,
    initialState,
  );

  const [cleared, setCleared] = React.useState<readonly string[]>([]);
  const [resetToken, setResetToken] = React.useState(0);

  // Every server response re-arms all of its messages.
  const [seen, setSeen] = React.useState(raw);
  let active = cleared;
  if (seen !== raw) {
    setSeen(raw);
    if (cleared.length > 0) setCleared([]);
    active = [];
  }

  const clearFieldError = React.useCallback((name: string) => {
    setCleared((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }, []);

  const reset = React.useCallback(() => setResetToken((n) => n + 1), []);

  const state = React.useMemo(() => {
    if (!raw.fieldErrors || active.length === 0) return raw;
    const fieldErrors: Record<string, string[]> = {};
    for (const [field, messages] of Object.entries(raw.fieldErrors)) {
      if (!active.includes(field)) fieldErrors[field] = messages;
    }
    return {
      ...raw,
      fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
    };
  }, [raw, active]);

  return { state, pending, formAction, reset, clearFieldError, resetToken };
}

interface ActionFormProps extends Omit<React.ComponentProps<"form">, "action"> {
  form: ActionFormApi;
}

export function ActionForm({ form, onInput, onClick, ...props }: ActionFormProps) {
  const { state, formAction, clearFieldError, resetToken } = form;
  const ref = React.useRef<HTMLFormElement>(null);
  const values = state.values;

  React.useEffect(() => {
    restoreValues(ref.current, values);
  }, [values]);

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

  return (
    <form
      {...props}
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
    />
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
