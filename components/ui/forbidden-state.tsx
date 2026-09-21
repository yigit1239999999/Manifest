import Link from "next/link";
import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";

/**
 * Shown instead of a page the signed-in user's role does not reach.
 *
 * It replaces a silent `redirect("/")`. A bookmark or a shared link used to
 * drop the user on the dashboard with no explanation, so the natural next
 * move was to click the same link again. Being told no is a state, and an
 * unexplained relocation is not one (TEAM.md #19).
 *
 * Deliberately *not* the "not found" screen, and the distinction is worth
 * keeping straight: another clinic's record answers "not found" so that its
 * existence is not leaked. Here there is nothing to leak — /staff and
 * /settings exist in every clinic and the user is already inside their own.
 * Hiding the page would protect nothing and only confuse.
 *
 * The sidebar already omits these links for roles that cannot use them
 * (`components/sidebar.tsx`), so this is the bookmark-and-typed-URL case.
 * Rare, but nothing about it is self-correcting.
 */
export async function ForbiddenState() {
  const t = await getTranslations("error");

  return (
    <EmptyState
      icon={Lock}
      title={t("forbiddenPage.title")}
      description={t("forbiddenPage.description")}
      action={
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          {t("goHome")}
        </Link>
      }
    />
  );
}
