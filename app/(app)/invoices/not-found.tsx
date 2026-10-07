import { getTranslations } from "next-intl/server";
import { NotFoundState } from "@/components/ui/not-found-state";

// Covers `notFound()` thrown anywhere under /invoices, including the edit
// route. The only thing it adds over the shell-wide boundary is the right
// way out: back to this list, not to the dashboard.
export default async function InvoicesNotFound() {
  const [t, tNav] = await Promise.all([
    getTranslations("error"),
    getTranslations("nav"),
  ]);

  return (
    <NotFoundState
      title={t("recordNotFound.title")}
      description={t("recordNotFound.descriptionWithList")}
      actionHref="/invoices"
      actionLabel={t("recordNotFound.backToList", { list: tNav("invoices") })}
    />
  );
}
