"use client";

import { useTranslations } from "next-intl";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  OVERRIDE_REASON_MIN,
  type AllergyConflict,
} from "@/lib/allergy-check";

/**
 * The drug about to be saved matches the animal's recorded allergy.
 *
 * Shown the moment the name matches (the form checks as it is typed) and
 * again from the server's refusal, which is the check that counts: the
 * save is blocked until a reason is written here. Red, not the amber of
 * the standing alert above the form, because this is not a reminder that
 * the allergy exists -- it is this drug, now.
 */
export function AllergyOverride({
  conflict,
  fieldErrors,
}: {
  conflict: AllergyConflict;
  fieldErrors?: string[];
}) {
  const t = useTranslations("allergyCheck");
  return (
    <div className="col-span-full flex flex-col gap-3" data-allergy-conflict="">
      <Callout variant="danger" live title={t("title")}>
        {t("body", {
          allergy: conflict.allergy,
          drug: conflict.drug,
          family: conflict.family ?? "none",
        })}
      </Callout>
      <Field
        label={t("reason")}
        hint={t("reasonHint")}
        error={fieldErrors}
        required
      >
        <Textarea
          name="overrideReason"
          rows={2}
          required
          minLength={OVERRIDE_REASON_MIN}
          maxLength={500}
          placeholder={t("reasonPlaceholder")}
        />
      </Field>
    </div>
  );
}
