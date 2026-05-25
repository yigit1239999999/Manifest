"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { NOTE_KINDS } from "@/modules/notes/schema";
import { createNoteAction } from "@/modules/notes/actions";

interface Props {
  petId?: string | null;
  clientId?: string | null;
}

export function NoteForm({ petId, clientId }: Props) {
  const t = useTranslations("note");
  const tKind = useTranslations("enum.noteKind");
  const tCommon = useTranslations("common");
  const [state, formAction] = useActionState(createNoteAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      toast.success(tCommon("saved"));
    }
    if (state.error) toast.error(state.error);
  }, [state.success, state.error, tCommon]);

  return (
    <form action={formAction} ref={formRef} className="flex flex-col gap-3">
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
    </form>
  );
}
