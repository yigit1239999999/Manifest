"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error("app.error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("generic")}</h1>
      {error.digest && (
        <p className="text-xs text-muted-foreground">ref: {error.digest}</p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>{t("tryAgain")}</Button>
      </div>
    </div>
  );
}
