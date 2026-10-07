"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UndoImportButton, undoDoneText } from "@/components/import/undo-import";
import type { UndoResult } from "@/modules/import/service";

/**
 * The clinic's earlier imports, each with the way back.
 *
 * This list is the reason undo is worth building rather than a nicety on
 * the result card. Regret about an import does not arrive in the minute
 * after the button; it arrives when the vet opens the client list at noon
 * and does not recognise half of it. By then the result card is gone, and
 * without a list there is nothing left to press.
 *
 * The rows are formatted on the server and arrive as strings. A date
 * formatted in the browser would use the browser's locale rather than the
 * product's, which is the failure `lib/format.ts` takes a locale to avoid.
 */
export type ImportBatchRow = {
  id: string;
  fileName: string;
  summary: string;
  merged: string | null;
  by: string;
  undone: boolean;
};

export function ImportBatches({ batches, canUndo }: { batches: ImportBatchRow[]; canUndo: boolean }) {
  const t = useTranslations("import");
  const router = useRouter();
  const [done, setDone] = React.useState<Record<string, UndoResult>>({});

  if (batches.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("batchesTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{canUndo ? t("batchesHint") : t("batchesHintNoUndo")}</p>
        <ul className="flex flex-col gap-3">
          {batches.map((batch) => {
            const result = done[batch.id];
            return (
              <li
                key={batch.id}
                className="flex flex-col gap-2 rounded-control border border-border p-3"
              >
                {/* The vet's own file name, and it is the one string on this
                    row with no spaces in it: `musteri_hayvan_kayitlari_yedek_
                    2019_2024_son_hali.xlsx` is what a backup is actually
                    called. Measured at 390px before this was here -- the
                    paragraph's box was 218px and its text 388px, so the name
                    painted out over the card and the page scrolled 116px
                    sideways. The row's other two lines wrap on their own
                    spaces; this one needs to be told it may break inside a
                    word. */}
                <p className="break-words text-sm font-medium text-foreground">
                  {batch.fileName}
                </p>
                {/* The staff member's own name is in here (`batchBy`), so this
                    line can carry an unbroken word too. */}
                <p className="break-words text-sm text-muted-foreground">
                  {batch.summary}
                  {batch.merged ? ` · ${batch.merged}` : ""} · {batch.by}
                </p>
                {batch.undone || result ? (
                  <p className="text-sm text-muted-foreground">
                    {result ? undoDoneText(result, t) : t("batchUndone")}
                  </p>
                ) : canUndo ? (
                  <UndoImportButton
                    batchId={batch.id}
                    onDone={(r) => {
                      setDone((prev) => ({ ...prev, [batch.id]: r }));
                      // The counts stay on screen and the list behind them
                      // catches up: what was taken back and what STAYED is
                      // the sentence the vet needs, and a reload alone would
                      // leave them with a shorter list and no reason.
                      router.refresh();
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
