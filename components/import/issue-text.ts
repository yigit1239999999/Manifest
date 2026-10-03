import type { Issue } from "@/modules/import/analyze";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * One reason as a sentence, from the `import` namespace. Kept beside the
 * report builder because both must say the same thing about the same row:
 * the table on screen and the file the clinic downloads.
 */
export function issueText(t: Translate, issue: Issue): string {
  switch (issue.code) {
    case "dateAmbiguous":
    case "dateInvalid":
    case "dateYearOnly":
    case "dateFuture":
      return t(`issues.${issue.code}`, { field: t(`fields.${issue.field}`), raw: issue.raw });
    case "textTruncated":
      return t("issues.textTruncated", { field: t(`fields.${issue.field}`) });
    default: {
      const { code, ...values } = issue;
      return t(`issues.${code}`, values as Record<string, string | number>);
    }
  }
}
