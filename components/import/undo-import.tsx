"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { UndoPreview, UndoResult } from "@/modules/import/service";

/**
 * "Undo this import", asked once with the exact numbers.
 *
 * Undo deletes, in one press, every record a run made that nobody has used
 * since -- on a first import that is the clinic's whole client list. So the
 * press asks first, and the question is the server's own count rather than
 * a sentence about "records": how many owners, animals and vaccinations
 * go, how many stay because the clinic has worked on them, and by name the
 * ones that stay because somebody edited them after the import.
 *
 * The counts are fetched when the button is pressed, not when the page is
 * drawn: an import from this morning gains visits all day, and a number
 * read at nine is wrong by noon.
 */
export function UndoImportButton({
  batchId,
  onDone,
  variant = "secondary",
}: {
  batchId: string;
  onDone: (result: UndoResult) => void;
  variant?: "secondary" | "ghost";
}) {
  const t = useTranslations("import");
  const [preview, setPreview] = React.useState<UndoPreview | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  async function ask(open: () => void) {
    setFailed(false);
    setLoading(true);
    try {
      const res = await fetch("/api/import/undo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchId, preview: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { preview: UndoPreview };
      setPreview(data.preview);
      open();
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  async function undo() {
    try {
      const res = await fetch("/api/import/undo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { result: UndoResult };
      onDone(data.result);
    } catch {
      setFailed(true);
    }
  }

  const description = preview ? undoDescription(preview, t) : undefined;

  return (
    <div className="flex flex-col items-start gap-2">
      <ConfirmDialog
        title={t("undoConfirmTitle")}
        description={description}
        confirmLabel={t("undoConfirmButton")}
        cancelLabel={t("undoConfirmCancel")}
        tone="destructive"
        action={undo}
      >
        {(open) => (
          <Button
            type="button"
            variant={variant}
            size="sm"
            className="self-start"
            disabled={loading}
            onClick={() => void ask(open)}
          >
            {loading ? t("undoCounting") : t("undoButton")}
          </Button>
        )}
      </ConfirmDialog>
      {failed && <Callout variant="danger">{t("undoFailed")}</Callout>}
    </div>
  );
}

type T = ReturnType<typeof useTranslations<"import">>;

function undoDescription(p: UndoPreview, t: T): string {
  const parts = [
    t("undoConfirmRemove", { clients: p.clientCount, pets: p.petCount, vaccinations: p.vaccinationCount }),
  ];
  if (p.keptClients + p.keptPets + p.keptVaccinations > 0) {
    parts.push(t("undoConfirmKeep", { clients: p.keptClients, pets: p.keptPets, vaccinations: p.keptVaccinations }));
  }
  const edited = [...p.editedPets, ...p.editedClients];
  if (edited.length > 0) parts.push(t("undoConfirmEdited", { names: edited.join(", ") }));
  parts.push(t("undoConfirmFinal"));
  return parts.join(" ");
}

/** The sentence after the undo: what went, and what stayed and why. */
export function undoDoneText(result: UndoResult, t: T): string {
  const done = t("undoDone", {
    clients: result.clientCount,
    pets: result.petCount,
    vaccinations: result.vaccinationCount,
  });
  const kept = result.keptClients + result.keptPets + (result.keptVaccinations ?? 0);
  return kept > 0
    ? `${done} ${t("undoKept", {
        clients: result.keptClients,
        pets: result.keptPets,
        vaccinations: result.keptVaccinations ?? 0,
      })}`
    : done;
}
