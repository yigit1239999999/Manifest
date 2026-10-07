"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * What an error boundary shows, shared by the two boundaries that need it.
 *
 * There are two because of where they sit, not because they differ: the root
 * boundary replaces the entire page, while the one inside `(app)` keeps the
 * sidebar and topbar so the user can go somewhere else when "try again" does
 * not help. Same reporting, same wording, one copy.
 */
export function ErrorState({
  error,
  reset,
  boundary,
  /** Offer a way out of the screen. Off at the root, where there is no shell. */
  showHome = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  boundary: string;
  showHome?: boolean;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary } });
    console.error(boundary, { message: error.message, digest: error.digest });
  }, [error, boundary]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      {/* No `role="alert"` on purpose. The boundary and its text enter the
          DOM together, and a live region only announces content that arrives
          after it mounts — the label would be a promise the browser does not
          keep (TEAM.md #30). Announcing this properly needs a region that is
          already mounted, which is a separate piece of work, not a prop. */}
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("generic")}
      </h1>
      {/* The reference the user can read out to support. Not decoration. */}
      {error.digest && (
        <p className="text-xs text-muted-foreground">ref: {error.digest}</p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>{t("tryAgain")}</Button>
        {showHome && (
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>
            {t("goHome")}
          </Link>
        )}
      </div>
    </div>
  );
}
