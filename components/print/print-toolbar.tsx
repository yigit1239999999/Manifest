"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * "Yazdır" and the way back, above a printable document and never on it.
 *
 * The browser's own print dialog, not a PDF library: it already offers
 * "save as PDF", picks the clinic's printer, and costs no bundle.
 */
export function PrintToolbar({
  backHref,
  backLabel,
  printLabel,
}: {
  backHref: string;
  backLabel: string;
  printLabel: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Link href={backHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        {backLabel}
      </Link>
      <Button type="button" onClick={() => window.print()}>
        <Printer />
        {printLabel}
      </Button>
    </div>
  );
}
