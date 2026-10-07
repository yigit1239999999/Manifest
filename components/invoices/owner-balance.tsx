import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatMoney, type FormatTarget } from "@/lib/format";
import type { ClientBalance } from "@/modules/invoices/queries";
import { cn } from "@/lib/utils";

/**
 * "Toplam borç ₺350 · 1 fatura", linking to exactly those invoices.
 *
 * The vet's question at the counter is "does this owner owe us anything",
 * and before this the answer was opening every invoice in the list. Drawn
 * only when something is owed: a "no debt" line on every client page is
 * a sentence the eye learns to skip, and then skips on the day it changes.
 *
 * `compact` is the one-line form for a visit's owner row, where the owner
 * is standing in front of the vet.
 */
export async function OwnerBalance({
  clientId,
  balance,
  fmt,
  compact = false,
}: {
  clientId: string;
  balance: ClientBalance;
  fmt: FormatTarget;
  compact?: boolean;
}) {
  if (balance.invoiceCount === 0) return null;
  const t = await getTranslations("invoice");
  const amount = balance.owed.map((o) => formatMoney(fmt, o.cents, o.currency)).join(" + ");
  const href = `/invoices?clientId=${encodeURIComponent(clientId)}&status=unpaid`;
  const text = t("ownerBalance", { amount, count: balance.invoiceCount });
  if (compact) {
    return (
      <Link href={href} className="text-sm font-medium text-warning underline-offset-2 hover:underline">
        {text}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-surface border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground",
        "transition-colors hover:border-warning",
      )}
    >
      <span className="font-semibold tabular-nums">{text}</span>
      <span className="text-sm font-medium text-primary">{t("ownerBalanceOpen")}</span>
    </Link>
  );
}
