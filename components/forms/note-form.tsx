"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { NOTE_KINDS } from "@/modules/notes/schema";
import { createNoteAction } from "@/modules/notes/actions";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

interface Props {
  petId?: string | null;
  clientId?: string | null;
}

export function NoteForm({ petId, clientId }: Props) {
  const t = useTranslations("note");
  const tKind = useTranslations("enum.noteKind");
  const tCommon = useTranslations("common");
  const form = useActionForm(createNoteAction, {});
  const { state, reset } = form;

  useEffect(() => {
    if (state.success) {
      reset();
      toast.success(tCommon("saved"));
    }
  }, [state.success, tCommon, reset]);

  return (
    <ActionForm form={form} className="flex flex-col gap-3">

      {petId && <input type="hidden" name="petId" value={petId} />}
      {clientId && <input type="hidden" name="clientId" value={clientId} />}

      <Field label={t("kind")} error={state.fieldErrors?.kind} required>
        <Select name="kind" defaultValue="GENERAL" required>
          {NOTE_KINDS.map((k) => (
            <option key={k} value={k}>
              {tKind(k)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("body")} error={state.fieldErrors?.body} required>
        <Textarea name="body" rows={3} required />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="pinned" className="size-4 rounded" />
        {t("pinned")}
      </label>
      <SubmitButton size="sm" className="w-fit">
        {t("create")}
      </SubmitButton>
    </ActionForm>
  );
}
