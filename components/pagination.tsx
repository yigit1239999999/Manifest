import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

interface Props {
  basePath: string;
  total: number;
  page: number;
  perPage: number;
  /** Extra query params to preserve in the page links. */
  params?: Record<string, string | undefined>;
}

function hrefFor(
  basePath: string,
  page: number,
  params?: Record<string, string | undefined>,
): string {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) qs.set(key, value);
    }
  }
  if (page > 1) qs.set("page", String(page));
  const tail = qs.toString();
  return tail ? `${basePath}?${tail}` : basePath;
}

export async function Pagination({ basePath, total, page, perPage, params }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (totalPages <= 1) return null;

  const t = await getTranslations("common");
  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  const pageNumbers: number[] = [];
  const window = 1;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - window && p <= page + window)) {
      pageNumbers.push(p);
    }
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 text-sm"
    >
      <p className="text-xs text-muted-foreground">
        {from}–{to} / {total}
      </p>
      <div className="flex items-center gap-1">
        <PageLink
          href={hrefFor(basePath, page - 1, params)}
          disabled={page <= 1}
          ariaLabel={t("back")}
        >
          <ChevronLeft className="size-4" />
        </PageLink>
        {pageNumbers.map((p, i) => {
          const previous = pageNumbers[i - 1];
          const showEllipsis = previous != null && p - previous > 1;
          return (
            <span key={p} className="flex items-center gap-1">
              {showEllipsis && (
                <span className="px-1 text-muted-foreground">…</span>
              )}
              <PageLink
                href={hrefFor(basePath, p, params)}
                active={p === page}
              >
                {p}
              </PageLink>
            </span>
          );
        })}
        <PageLink
          href={hrefFor(basePath, page + 1, params)}
          disabled={page >= totalPages}
          ariaLabel="Next"
        >
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  active,
  disabled,
  children,
  ariaLabel,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const className = cn(
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-foreground hover:bg-muted",
    disabled && "pointer-events-none opacity-40",
  );

  if (disabled) {
    return (
      <span aria-disabled className={className} aria-label={ariaLabel}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
