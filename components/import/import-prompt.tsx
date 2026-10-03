"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, FileSpreadsheet } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FormState } from "@/lib/action";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * The dashboard's offer to bring a clinic's records over.
 *
 * Shown only while the clinic has few clients and only to whoever can run
 * the import, and it goes away for good with one click: a card that asks
 * every morning stops being read on the second. The permanent door is in
 * Settings, and the confirmation says so, so dismissing it never means
 * losing the way back.
 *
 * "Not now" is a word and not an X in the corner: an X reads as "close
 * this for now", and this closes it for the whole clinic.
 */
export function ImportPrompt({ dismiss }: { dismiss: () => Promise<FormState> }) {
  const t = useTranslations("import.prompt");
  const [hidden, setHidden] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  if (hidden) return null;

  return (
    <Card>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-tile bg-accent text-accent-foreground"
        >
          <FileSpreadsheet className="size-6" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("body")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/settings/import" className={buttonVariants()}>
            {t("start")}
            <ArrowRight aria-hidden="true" />
          </Link>
          <Button
            type="button"
            variant="ghost"
            aria-busy={pending || undefined}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await dismiss();
                if (result?.error) {
                  toast.error(result.error);
                  return;
                }
                setHidden(true);
                toast.success(t("dismissed"));
              })
            }
          >
            {t("dismiss")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
