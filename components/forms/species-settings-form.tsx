"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { FormState } from "@/lib/action";
import { SpeciesIcon } from "@/components/species-icon";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

interface Props {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  species: { value: string; label: string }[];
  enabled: string[];
  saveLabel: string;
  savedMessage: string;
}

export function SpeciesSettingsForm({
  action,
  species,
  enabled,
  saveLabel,
  savedMessage,
}: Props) {
  const form = useActionForm(action, {});
  const { state } = form;

  useEffect(() => {
    if (state.success) toast.success(savedMessage);
    if (state.error) toast.error(state.error);
  }, [state, savedMessage]);

  const fieldError = state.fieldErrors?.species?.[0];

  return (
    <ActionForm form={form} className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {species.map((s) => (
          <label
            key={s.value}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-control border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:border-primary/40",
              "has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground",
            )}
          >
            <input
              type="checkbox"
              name="species"
              value={s.value}
              defaultChecked={enabled.includes(s.value)}
              className="size-4 rounded border-border"
            />
            <SpeciesIcon species={s.value} className="size-4" />
            <span className="font-medium">{s.label}</span>
          </label>
        ))}
      </div>
      {fieldError && (
        <p className="text-xs font-medium text-destructive">{fieldError}</p>
      )}
      <div className="flex justify-end">
        <SubmitButton>{saveLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
