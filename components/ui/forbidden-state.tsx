import Link from "next/link";
import { Lock } from "lucide-react";
import { forbidden } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
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
 *
 * There is no `description` override, and the absence is deliberate. When
 * only /staff and /settings were gated, the sentence said "for
 * administrators only" and that was more specific than what it says now.
 * It stopped being true as soon as the gates spread: this is shown to a vet
 * tech turned away from /visits/new, a page open to vets and receptionists
 * alike. The specificity that was lost is the part that mattered least —
 * where to go next is still in the sentence. A per-call-site variant would
 * be unused at nine of ten of them (TEAM.md #30), and the rule that keeps
 * the shared sentence honest is in `messages/messages.test.ts`: it may not
 * claim who the section belongs to.
 */
/**
 * What a page returns for a role it does not serve: `return
 * <ForbiddenState />`, the pattern every guarded route already uses.
 *
 * It answers with HTTP 403 now (pm C14) rather than drawing the screen
 * itself under a 200: rendering it calls Next's `forbidden()`
 * (`experimental.authInterrupts`), and `app/(app)/forbidden.tsx` draws
 * `ForbiddenView` in the page's place. A 200 told every tool reading the
 * response -- a monitor, a crawler, the browser's own history -- that the
 * page had been served, and pm's sweep counted refusals as successes.
 * Kept as a component so the eleven call sites and the route-state tests
 * that look for it did not have to change.
 */
export function ForbiddenState(): never {
  forbidden();
}

/** The refusal itself, drawn by `app/(app)/forbidden.tsx`. */
export async function ForbiddenView() {
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
