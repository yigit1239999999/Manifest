"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";
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

export function ImportBatches({ batches }: { batches: ImportBatchRow[] }) {
  const t = useTranslations("import");
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<Record<string, UndoResult>>({});
  const [failed, setFailed] = React.useState<string | null>(null);

  if (batches.length === 0) return null;

  async function undo(id: string) {
    setFailed(null);
    setBusy(id);
    try {
      const res = await fetch("/api/import/undo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchId: id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { result: UndoResult };
      setDone((prev) => ({ ...prev, [id]: data.result }));
      // The counts stay on screen and the list behind them catches up: what
      // was taken back and what STAYED is the sentence the vet needs, and a
      // reload alone would leave them with a shorter list and no reason.
      router.refresh();
    } catch {
      setFailed(id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("batchesTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("batchesHint")}</p>
        <ul className="flex flex-col gap-3">
          {batches.map((batch) => {
            const result = done[batch.id];
            return (
              <li
                key={batch.id}
                className="flex flex-col gap-2 rounded-control border border-border p-3"
              >
                <p className="text-sm font-medium text-foreground">{batch.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {batch.summary}
                  {batch.merged ? ` · ${batch.merged}` : ""} · {batch.by}
                </p>
                {batch.undone || result ? (
                  <p className="text-sm text-muted-foreground">
                    {result
                      ? `${t("undoDone", { clients: result.clientCount, pets: result.petCount })}${
                          result.keptClients + result.keptPets > 0
                            ? ` ${t("undoKept", {
                                clients: result.keptClients,
                                pets: result.keptPets,
                              })}`
                            : ""
                        }`
                      : t("batchUndone")}
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    disabled={busy === batch.id}
                    onClick={() => void undo(batch.id)}
                  >
                    {busy === batch.id ? t("undoing") : t("undoButton")}
                  </Button>
                )}
                {failed === batch.id && <Callout variant="danger">{t("undoFailed")}</Callout>}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
