import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";

// Unmatched URLs for the whole app. Unlike `(app)/not-found.tsx` this one
// renders outside the shell, because an address that matches no route has no
// segment to sit in — and the visitor may not be signed in.
export default async function NotFound() {
  const t = await getTranslations("error");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        {t("pageNotFound.title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("pageNotFound.description")}
      </p>
      <Link
        href="/"
        className={buttonVariants({ variant: "secondary", size: "md" })}
      >
        {t("goHome")}
      </Link>
    </main>
  );
}
