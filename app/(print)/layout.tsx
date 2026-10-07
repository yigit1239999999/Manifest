import { requireSession } from "@/lib/session";

/**
 * Printed documents: an invoice or receipt, a prescription.
 *
 * Outside the `(app)` group on purpose. A printout is the document and
 * nothing else -- no sidebar, no top bar, no skip link -- and those come
 * from the app layout, so the only way to leave them out is not to be
 * under it. The session is still required: these pages show a client's
 * money and an animal's medication.
 *
 * The page is drawn on the card colour on screen and on white paper when
 * printed (`globals.css`, `@media print`), in either theme.
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <main id="main" className="min-h-screen bg-muted/40 px-4 py-6 print:bg-white print:p-0">
      <div className="print-sheet mx-auto w-full max-w-3xl rounded-surface border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-10 print:max-w-none print:border-0 print:p-0 print:shadow-none">
        {children}
      </div>
    </main>
  );
}
