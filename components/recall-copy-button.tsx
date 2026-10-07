"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FormState } from "@/lib/action";
import { Button } from "@/components/ui/button";

/**
 * Copies one message per owner for everything the current filter holds,
 * ready to paste into WhatsApp. Built on the server when pressed, so the
 * page does not carry five hundred messages nobody asked for.
 */
export function RecallCopyButton({
  build,
}: {
  build: () => Promise<FormState & { text?: string; owners?: number }>;
}) {
  const t = useTranslations("recall.copy");
  const [pending, startTransition] = useTransition();

  function copy() {
    startTransition(async () => {
      const result = await build();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (!result?.text || !result.owners) {
        toast.message(t("empty"));
        return;
      }
      try {
        await navigator.clipboard.writeText(result.text);
        toast.success(t("done", { owners: result.owners }), { description: t("doneHint") });
      } catch {
        toast.error(t("failed"));
      }
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      aria-busy={pending || undefined}
      onClick={() => !pending && copy()}
    >
      <Copy />
      {t("label")}
    </Button>
  );
}
