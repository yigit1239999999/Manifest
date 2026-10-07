"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarClock, Home, MoreHorizontal, PawPrint, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/permissions";
import { isActiveHref, navItemsFor } from "@/components/sidebar";
import { OPEN_SEARCH_EVENT } from "@/components/command-palette";

/** The four destinations a phone gets one tap to; the rest are in "Diğer". */
const TABS = ["/", "/appointments", "/pets"] as const;

/**
 * The phone's navigation, below `md`: five labelled tabs along the bottom
 * edge, where a thumb is (pm B15).
 *
 * It replaces a 56px rail of thirteen unlabelled icons down the left side,
 * which the vet tried on the phone and gave up on: an icon a vet has to
 * guess is a door they will not open. The shape is the one every phone
 * app with more destinations than fit uses -- Instagram, the iOS App
 * Store, and closer to home ezyVet's and Vetspire's mobile views -- four
 * labelled tabs and a "More" that opens the rest.
 *
 * Which four: what is done standing up, between rooms. The day (Panel),
 * the appointments, finding somebody (Ara, which opens the same search as
 * the header's), and the animals. Clients are one search away; invoices,
 * reminders and settings are desk work and live behind "Diğer".
 *
 * Safe-area aware: padded by the home indicator's inset, and the page's
 * `main` is padded by the bar's height so nothing ends up underneath it.
 */
export function BottomNav({ permissions }: { permissions: readonly Permission[] }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const sheet = React.useRef<HTMLDialogElement>(null);
  const items = navItemsFor(permissions);
  const tabs = TABS.map((href) => items.find((i) => i.href === href)).filter(
    (i): i is NonNullable<typeof i> => Boolean(i),
  );
  const rest = items.filter((i) => !(TABS as readonly string[]).includes(i.href));
  const moreActive = rest.some((i) => isActiveHref(pathname, i.href));

  const closeSheet = () => sheet.current?.close();

  const tabClass = (active: boolean) =>
    cn(
      "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium leading-tight transition-colors",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
    );

  const iconFor = (href: string) =>
    href === "/" ? Home : href === "/appointments" ? CalendarClock : PawPrint;

  const tab = (href: string, key: string) => {
    const Icon = iconFor(href);
    const active = isActiveHref(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={tabClass(active)}
      >
        <Icon className="size-5" aria-hidden="true" />
        {t(key)}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label={t("primary")}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {tabs.slice(0, 2).map((i) => tab(i.href, i.key))}
          <button
            type="button"
            className={tabClass(false)}
            onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
          >
            <Search className="size-5" aria-hidden="true" />
            {t("search")}
          </button>
          {tabs.slice(2).map((i) => tab(i.href, i.key))}
          <button
            type="button"
            aria-haspopup="dialog"
            className={tabClass(moreActive)}
            onClick={() => sheet.current?.showModal()}
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
            {t("more")}
          </button>
        </div>
      </nav>

      {/* A bottom sheet, as a native modal dialog: focus is trapped and
          Escape closes it for free, which is why it is not a div. */}
      <dialog
        ref={sheet}
        aria-label={t("more")}
        onClick={(e) => {
          if (e.target === sheet.current) closeSheet();
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none rounded-t-surface border-t border-border bg-card p-0 pb-[env(safe-area-inset-bottom)] text-foreground shadow-lg backdrop:bg-black/40 md:hidden"
      >
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <p className="text-sm font-semibold">{t("more")}</p>
          <button
            type="button"
            onClick={closeSheet}
            aria-label={t("close")}
            className="inline-flex size-10 items-center justify-center rounded-control text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <ul className="grid grid-cols-3 gap-1 px-2 pb-4">
          {rest.map(({ href, key, icon: Icon }) => {
            const active = isActiveHref(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={closeSheet}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-18 flex-col items-center justify-center gap-1.5 rounded-control px-1 py-2 text-center text-xs font-medium",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </dialog>
    </>
  );
}
