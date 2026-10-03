"use client";

import * as React from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const ACCEPT =
  ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

/**
 * Drag a file in, or press the button. The button is the control: it is
 * what keyboard and screen reader users reach, and it opens the same file
 * picker the drop area stands for. The area around it only adds the drop
 * target for a mouse.
 *
 * `.xls` is accepted here on purpose, although it cannot be read. Hiding
 * it in the picker would leave a clinic with an .xls file looking at a
 * greyed-out file and no reason; letting it through gets them the
 * sentence that says how to convert it.
 */
export function Dropzone({
  onFile,
  busyName,
  describedBy,
}: {
  onFile: (file: File) => void;
  /** The name of the file being read, while it is. */
  busyName: string | null;
  describedBy?: string;
}) {
  const t = useTranslations("import.upload");
  const input = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const busy = busyName !== null;

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file && !busy) onFile(file);
  };

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-surface border-2 border-dashed px-6 py-12 text-center transition-colors",
        dragging ? "border-primary bg-accent" : "border-border bg-card/60",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "flex size-14 items-center justify-center rounded-pill transition-colors",
          dragging ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
        )}
      >
        {busy ? (
          <Loader2 className="size-7 animate-spin" />
        ) : dragging ? (
          <Upload className="size-7" />
        ) : (
          <FileSpreadsheet className="size-7" />
        )}
      </div>

      {busy ? (
        <p className="text-base font-semibold text-foreground" role="status">
          {t("reading", { name: busyName })}
        </p>
      ) : (
        <>
          <p className="text-base font-semibold text-foreground">
            {dragging ? t("dragging") : t("drop")}
          </p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            // The visible words are the name (a voice user says what they
            // see); the formats and the size limit are its description.
            aria-describedby={cn("import-formats", describedBy)}
            className={buttonVariants()}
          >
            <Upload className="size-4" aria-hidden="true" />
            {t("choose")}
          </button>
        </>
      )}
      <p id="import-formats" className="text-xs text-muted-foreground">
        {t("formats")}
      </p>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          take(e.target.files);
          // So choosing the same file again after an error still fires.
          e.target.value = "";
        }}
      />
    </div>
  );
}
