"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileDown, Loader2, RotateCcw, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Announcer } from "@/components/ui/announcer";
import { Skeleton } from "@/components/ui/skeleton";
import { surface } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ColumnMapping } from "@/modules/import/fields";
import type { Analysis } from "@/modules/import/analyze";
import { Stepper, type Step } from "./stepper";
import { Dropzone } from "./dropzone";
import { MappingStep } from "./mapping-step";
import { PreviewStep, type SpeciesOption } from "./preview-step";
import { issueText } from "./issue-text";
import { download, skippedReport } from "./report";

interface Inspected {
  fileName: string;
  sheetName: string | null;
  headers: string[];
  samples: string[][];
  rows: number;
  mapping: ColumnMapping;
}

interface Previewed {
  headers: string[];
  analysis: Analysis;
  skippedCells: Record<string, string[]>;
}

interface Imported {
  pets: number;
  newClients: number;
  existingClients: number;
  vaccinations: number;
  newSpecies: number;
  skipped: number;
}

type Reply<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

type Run =
  | { status: "working" }
  | { status: "done"; result: Imported }
  | { status: "error"; message: string };

export function ImportWizard({
  builtInSpecies,
  customSpecies,
}: {
  builtInSpecies: SpeciesOption[];
  customSpecies: { id: string; name: string }[];
}) {
  const t = useTranslations("import");
  const tFlat = t as unknown as (key: string, values?: Record<string, string | number>) => string;
  const locale = useLocale();

  const [step, setStep] = React.useState<Step>("upload");
  const [file, setFile] = React.useState<File | null>(null);
  const [reading, setReading] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [inspected, setInspected] = React.useState<Inspected | null>(null);
  const [mapping, setMapping] = React.useState<ColumnMapping>([]);
  const [preview, setPreview] = React.useState<Previewed | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [updating, setUpdating] = React.useState(false);
  const [dateOrder, setDateOrder] = React.useState<"DMY" | "MDY" | null>(null);
  const [speciesChoices, setSpeciesChoices] = React.useState<Record<string, string>>({});
  const [run, setRun] = React.useState<Run | null>(null);
  const [announcement, setAnnouncement] = React.useState<string | null>(null);

  // Each step change moves focus to the new step's heading, so a keyboard
  // or screen reader user lands where the page now is instead of on a
  // button that has just disappeared. Not on first render: arriving on
  // the page is not something to interrupt.
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const arrived = React.useRef(false);
  React.useEffect(() => {
    if (arrived.current) headingRef.current?.focus();
    arrived.current = true;
  }, [step]);
  // The import step swaps its heading when the write finishes ("writing"
  // becomes "done"), and focus on a heading that left the page falls to
  // the body. Follow it to the new one.
  React.useEffect(() => {
    if (run?.status === "done" || run?.status === "error") headingRef.current?.focus();
  }, [run?.status]);

  // Only the newest preview request may land: changing two choices in
  // quick succession must not let the first answer overwrite the second.
  const latest = React.useRef(0);

  async function call<T>(
    action: "inspect" | "preview" | "commit",
    upload: File,
    fields: Record<string, unknown> = {},
  ): Promise<Reply<T>> {
    const form = new FormData();
    form.set("step", action);
    form.set("file", upload);
    for (const [k, v] of Object.entries(fields)) form.set(k, JSON.stringify(v));
    let res: Response;
    try {
      res = await fetch("/api/import", { method: "POST", body: form });
    } catch {
      return { ok: false, code: "network", message: t("errors.network") };
    }
    const body = (await res.json().catch(() => null)) as
      | (T & { error?: string; message?: string })
      | null;
    if (!res.ok || !body)
      return {
        ok: false,
        code: body?.error ?? "internal",
        message: body?.message ?? t("errors.internal"),
      };
    return { ok: true, data: body };
  }

  function summaryOf(a: Analysis) {
    const head =
      a.counts.pets > 0
        ? t("preview.summary", {
            pets: a.counts.pets,
            clients: a.counts.newClients + a.counts.existingClients,
          })
        : t("preview.summaryNone");
    return a.counts.skipped > 0
      ? `${head} · ${t("preview.summarySkipped", { count: a.counts.skipped })}`
      : head;
  }

  async function onFile(upload: File) {
    setReading(upload.name);
    setUploadError(null);
    const reply = await call<Inspected>("inspect", upload);
    setReading(null);
    if (!reply.ok) {
      setUploadError(reply.message);
      return;
    }
    setFile(upload);
    setInspected(reply.data);
    setMapping(reply.data.mapping);
    setPreview(null);
    setDateOrder(null);
    setSpeciesChoices({});
    setStep("map");
  }

  async function loadPreview(
    options: { dateOrder: "DMY" | "MDY" | null; speciesChoices: Record<string, string> },
    keep = true,
  ) {
    if (!file) return;
    const id = ++latest.current;
    if (keep) setUpdating(true);
    else setPreview(null);
    setPreviewError(null);
    const reply = await call<Previewed>("preview", file, { mapping, options });
    if (id !== latest.current) return;
    setUpdating(false);
    if (!reply.ok) {
      setPreviewError(reply.message);
      return;
    }
    setPreview(reply.data);
    setAnnouncement(summaryOf(reply.data.analysis));
  }

  function toPreview() {
    setStep("preview");
    void loadPreview({ dateOrder, speciesChoices }, false);
  }

  function chooseDateOrder(order: "DMY" | "MDY") {
    setDateOrder(order);
    void loadPreview({ dateOrder: order, speciesChoices });
  }

  function chooseSpecies(key: string, choice: string) {
    const next = { ...speciesChoices, [key]: choice };
    setSpeciesChoices(next);
    void loadPreview({ dateOrder, speciesChoices: next });
  }

  async function runImport() {
    if (!file || !preview) return;
    setStep("import");
    setRun({ status: "working" });
    const c = preview.analysis.counts;
    const reply = await call<Imported>("commit", file, {
      mapping,
      options: { dateOrder, speciesChoices },
      expected: {
        pets: c.pets,
        newClients: c.newClients,
        existingClients: c.existingClients,
        vaccinations: c.vaccinations,
      },
    });
    if (reply.ok) {
      setRun({ status: "done", result: reply.data });
      setAnnouncement(`${t("run.successTitle")}. ${t("run.successBody", { pets: reply.data.pets })}`);
      return;
    }
    if (reply.code === "changedSincePreview") {
      // Nothing was written. Back to the preview, refreshed, with the
      // reason on top, so the clinic approves what is true now.
      setRun(null);
      setStep("preview");
      await loadPreview({ dateOrder, speciesChoices });
      setPreviewError(reply.message);
      return;
    }
    setRun({ status: "error", message: reply.message });
  }

  function startOver() {
    setStep("upload");
    setFile(null);
    setInspected(null);
    setMapping([]);
    setPreview(null);
    setPreviewError(null);
    setRun(null);
    setUploadError(null);
    setDateOrder(null);
    setSpeciesChoices({});
  }

  function downloadReport() {
    if (!preview) return;
    const text = skippedReport({
      analysis: preview.analysis,
      headers: preview.headers,
      cells: preview.skippedCells,
      reason: (row) => row.issues.map((i) => issueText(tFlat, i)).join(" "),
      labels: { line: t("run.reportLine"), reason: t("run.reportReason") },
      delimiter: locale === "tr" ? ";" : ",",
    });
    download(text, t("run.reportFileName"));
  }

  const done = run?.status === "done";
  const heading =
    step === "import"
      ? done
        ? run.result.skipped > 0
          ? t("run.partialTitle")
          : t("run.successTitle")
        : run?.status === "error"
          ? t("errors.commitTitle")
          : t("run.working")
      : t(`${step === "upload" ? "upload" : step === "map" ? "map" : "preview"}.heading`);
  const description =
    step === "upload"
      ? t("upload.description")
      : step === "map"
        ? t("map.description")
        : step === "preview"
          ? t("preview.description")
          : null;

  return (
    <div className="flex flex-col gap-6">
      <Stepper current={done ? "import" : step} />
      <Announcer message={announcement} />

      <section aria-labelledby="import-step-heading" className="flex flex-col gap-5">
        {step !== "import" && (
          <div className="flex flex-col gap-1">
            <h2
              id="import-step-heading"
              ref={headingRef}
              tabIndex={-1}
              className="text-lg font-semibold tracking-tight text-foreground focus:outline-none"
            >
              {heading}
            </h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        )}

        {step === "upload" && (
          <div className="flex flex-col gap-4">
            {uploadError && (
              <Callout variant="danger" title={t("errors.title")}>
                {uploadError}
              </Callout>
            )}
            <Dropzone onFile={onFile} busyName={reading} />
            <div className={cn(surface, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5")}>
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-tile bg-accent text-accent-foreground">
                  <FileDown className="size-4" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-foreground">{t("upload.templateTitle")}</p>
                  <p className="text-sm text-muted-foreground">{t("upload.templateBody")}</p>
                </div>
              </div>
              <a
                href="/api/import/template"
                download
                className={cn(buttonVariants({ variant: "secondary" }), "shrink-0")}
              >
                <Download aria-hidden="true" />
                {t("upload.templateAction")}
              </a>
            </div>
            <p className="text-xs text-muted-foreground">{t("upload.privacy")}</p>
          </div>
        )}

        {step === "map" && inspected && (
          <MappingStep
            fileName={inspected.fileName}
            sheetName={inspected.sheetName}
            rows={inspected.rows}
            headers={inspected.headers}
            samples={inspected.samples}
            mapping={mapping}
            onChange={setMapping}
            onBack={startOver}
            onNext={toPreview}
            announce={setAnnouncement}
          />
        )}

        {step === "preview" &&
          (preview ? (
            <PreviewStep
              analysis={preview.analysis}
              updating={updating}
              builtInSpecies={builtInSpecies}
              customSpecies={customSpecies}
              dateOrder={dateOrder}
              speciesChoices={speciesChoices}
              onDateOrder={chooseDateOrder}
              onSpeciesChoice={chooseSpecies}
              onBack={() => setStep("map")}
              onImport={runImport}
              error={previewError}
            />
          ) : previewError ? (
            <div className="flex flex-col gap-3">
              <Callout variant="danger">{previewError}</Callout>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={toPreview}>
                  <RotateCcw aria-hidden="true" />
                  {t("actions.retry")}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setStep("map")}>
                  {t("actions.back")}
                </Button>
              </div>
            </div>
          ) : (
            <PreviewSkeleton label={t("preview.updating")} />
          ))}

        {step === "import" && (
          <div className={cn(surface, "flex flex-col items-center gap-4 px-6 py-10 text-center")}>
            {run?.status === "working" && preview && (
              <>
                <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-pill bg-accent text-accent-foreground">
                  <Loader2 className="size-7 animate-spin" />
                </span>
                <h2 id="import-step-heading" ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-foreground focus:outline-none">
                  {heading}
                </h2>
                <p role="status" className="max-w-md text-sm text-muted-foreground">
                  {t("run.workingBody", { pets: preview.analysis.counts.pets })}
                </p>
              </>
            )}

            {run?.status === "error" && (
              <>
                <h2 id="import-step-heading" ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-foreground focus:outline-none">
                  {heading}
                </h2>
                <Callout variant="danger" className="w-full max-w-md text-start">
                  {run.message}
                </Callout>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" onClick={runImport}>
                    <RotateCcw aria-hidden="true" />
                    {t("actions.retry")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setRun(null); setStep("preview"); }}>
                    {t("actions.back")}
                  </Button>
                </div>
              </>
            )}

            {run?.status === "done" && (
              <Result
                headingRef={headingRef}
                heading={heading}
                result={run.result}
                onReport={downloadReport}
                onAgain={startOver}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function PreviewSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div className={cn(surface, "flex flex-col gap-4 p-5")}>
        <Skeleton className="h-5 w-64 max-w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
      <Skeleton className="h-16 w-full" />
      <div className={cn(surface, "flex flex-col divide-y divide-border")}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-5 w-16 rounded-pill" />
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Result({
  headingRef,
  heading,
  result,
  onReport,
  onAgain,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  heading: string;
  result: Imported;
  onReport: () => void;
  onAgain: () => void;
}) {
  const t = useTranslations("import");
  const stats = [
    { key: "statPets", value: result.pets },
    { key: "statNewClients", value: result.newClients },
    { key: "statExisting", value: result.existingClients },
    { key: "statVaccines", value: result.vaccinations },
  ] as const;
  // Past tense where the preview's labels are future: by now it happened.
  const label = (key: (typeof stats)[number]["key"]) =>
    key === "statExisting" ? t("run.statExisting") : t(`preview.${key}`);

  return (
    <>
      <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-pill bg-accent text-accent-foreground">
        <CheckCircle2 className="size-7" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 id="import-step-heading" ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-foreground focus:outline-none">
          {heading}
        </h2>
        <p className="text-sm text-muted-foreground">{t("run.successBody", { pets: result.pets })}</p>
      </div>

      <dl className="grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.key} className="rounded-tile bg-muted/40 px-3 py-2.5 text-start">
            <dt className="text-xs text-muted-foreground">{label(s.key)}</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{s.value}</dd>
          </div>
        ))}
      </dl>

      {result.skipped > 0 && (
        <div className="flex w-full max-w-xl flex-col gap-3 text-start">
          <Callout variant="warning">{t("run.skippedBody", { count: result.skipped })}</Callout>
          <Button type="button" variant="secondary" className="self-start" onClick={onReport}>
            <Download aria-hidden="true" />
            {t("run.downloadReport")}
          </Button>
        </div>
      )}

      <p className="max-w-xl text-xs text-muted-foreground">{t("run.consentReminder")}</p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/clients" className={buttonVariants()}>
          <Users aria-hidden="true" />
          {t("run.goClients")}
        </Link>
        <Button type="button" variant="ghost" onClick={onAgain}>
          {t("run.again")}
        </Button>
      </div>
    </>
  );
}
