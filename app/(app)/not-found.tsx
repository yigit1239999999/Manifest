import Link from "next/link";
import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";

// The boundary for `notFound()` thrown inside the app shell — a pet, client,
// invoice, appointment or visit that was deleted, or that belongs to another
// clinic. Nine pages throw it and, until this file existed, all nine landed
// on Next's built-in 404: unstyled, English, outside the layout, with no way
// back but the browser's back button.
//
// It lives inside `(app)` so the sidebar and topbar stay: a dead end the user
// can navigate away from is not a dead end.
//
// The wording says nothing about which clinic owns the record. The services
// already answer "not found" rather than "forbidden" for another clinic's
// data so that its existence is not leaked; this screen holds the same line.
export default async function AppNotFound() {
  const t = await getTranslations("error");

  return (
    <EmptyState
      icon={SearchX}
      title={t("recordNotFound.title")}
      description={t("recordNotFound.description")}
      action={
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          {t("goHome")}
        </Link>
      }
    />
  );
}
