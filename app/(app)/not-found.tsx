import { getTranslations } from "next-intl/server";
import { NotFoundState } from "@/components/ui/not-found-state";

// The fallback boundary for `notFound()` inside the app shell. Each section
// below has its own, which sends the user back to the list they came from;
// this one catches anything that has no list of its own, so the way out is
// the dashboard — and the wording does not promise a list that is not here
// (TEAM.md #33).
export default async function AppNotFound() {
  const t = await getTranslations("error");

  return (
    <NotFoundState
      title={t("recordNotFound.title")}
      description={t("recordNotFound.description")}
      actionHref="/"
      actionLabel={t("goHome")}
    />
  );
}
