"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Merge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { searchClientsAction } from "@/modules/clients/actions";
import { mergeClientsAction, mergePreviewAction } from "@/modules/clients/merge-actions";
import type { MergeCounts } from "@/modules/clients/merge";

/**
 * "Müşterileri birleştir" on a client's page, for administrators.
 *
 * Pick the record to keep; the confirmation then says, in numbers, what
 * moves there -- "2 hayvan, 5 vizit, 1 fatura" -- and that this record is
 * archived. Numbers rather than "all records", because the one thing an
 * administrator needs before rewriting whose history is whose is to see
 * that it is the history they think it is.
 */
export function ClientMerge({ sourceId }: { sourceId: string }) {
  const t = useTranslations("client.merge");
  const tCommon = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState<ComboOption | null>(null);
  const [preview, setPreview] = React.useState<{
    counts: MergeCounts;
    source: string;
    target: string;
  } | null>(null);
  const [loading, startLoading] = React.useTransition();

  function choose(value: string, option: ComboOption | null) {
    setTarget(option);
    setPreview(null);
    if (!option || !value || value === sourceId) return;
    startLoading(async () => {
      const result: { error?: string; counts?: MergeCounts; source?: string; target?: string } =
        await mergePreviewAction(sourceId, value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.counts && result.source && result.target) {
        setPreview({ counts: result.counts, source: result.source, target: result.target });
      }
    });
  }

  const moved = preview
    ? (Object.entries(preview.counts) as [keyof MergeCounts, number][])
        .filter(([, n]) => n > 0)
        .map(([key, n]) => t(`counts.${key}`, { count: n }))
    : [];

  return (
    // A panel under its own button rather than a row pushed into the
    // header: opened in place it shoved the title and the other actions
    // sideways, and the page moved under the reader's eye.
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Merge />
        {t("open")}
      </Button>
      {open && (
        <div className="absolute end-0 top-full z-20 mt-2 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 rounded-control border border-border bg-card p-4 shadow-lg">
          <p className="text-sm font-medium text-foreground">{t("title")}</p>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
          <Combobox
            name="mergeTarget"
            options={[]}
            value={target}
            onValueChange={choose}
            onSearch={async (term) => {
              const found = await searchClientsAction(term);
              return {
                options: found.options.filter((o) => o.value !== sourceId),
                hasMore: found.hasMore,
              };
            }}
            placeholder={t("searchPlaceholder")}
            noResultsLabel={tCommon("noResults")}
            searchHintLabel={tCommon("searchMinChars")}
            searchingLabel={tCommon("searching")}
            searchFailedLabel={tCommon("searchFailed")}
            hasMoreLabel={tCommon("searchMore")}
            aria-describedby={undefined}
          />
          {loading && <p className="text-xs text-muted-foreground">{tCommon("searching")}</p>}
          {preview && target && (
            <ConfirmDialog
              title={t("confirmTitle", { source: preview.source, target: preview.target })}
              description={
                (moved.length > 0 ? t("confirmMoves", { list: moved.join(", ") }) : t("confirmNothing")) +
                " " +
                t("confirmArchive", { source: preview.source })
              }
              confirmLabel={t("confirm")}
              cancelLabel={tCommon("cancel")}
              tone="destructive"
              action={async () => mergeClientsAction(sourceId, target.value)}
            >
              {(openDialog) => (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-foreground">
                    {moved.length > 0 ? t("summary", { list: moved.join(", "), target: preview.target }) : t("confirmNothing")}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="destructive" onClick={openDialog}>
                      {t("confirm")}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                      {tCommon("cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </ConfirmDialog>
          )}
          {!preview && (
            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
