"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarClock,
  ClipboardList,
  History,
  Home,
  PawPrint,
  Pill,
  Receipt,
  Settings,
  Stethoscope,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { href: string; key: string; icon: typeof Home }[] = [
  { href: "/", key: "dashboard", icon: Home },
  { href: "/clients", key: "clients", icon: Users },
  { href: "/pets", key: "pets", icon: PawPrint },
  { href: "/visits", key: "visits", icon: Stethoscope },
  { href: "/appointments", key: "appointments", icon: CalendarClock },
  { href: "/prescriptions", key: "prescriptions", icon: Pill },
  { href: "/reminders", key: "reminders", icon: ClipboardList },
  { href: "/invoices", key: "invoices", icon: Receipt },
  { href: "/audit", key: "audit", icon: History },
];

export function Sidebar({
  canManageStaff = false,
  canManageSettings = false,
}: {
  canManageStaff?: boolean;
  canManageSettings?: boolean;
}) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();

  const items = [
    ...NAV,
    ...(canManageStaff ? [{ href: "/staff", key: "staff", icon: UserCog }] : []),
    ...(canManageSettings
      ? [{ href: "/settings", key: "settings", icon: Settings }]
      : []),
  ];

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col gap-6 border-r border-border bg-card px-3 py-5 md:w-60 md:px-4">
      <Link href="/" className="flex items-center gap-2.5 px-1.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-tile bg-primary text-primary-foreground">
          <PawPrint className="size-5" />
        </span>
        {/* `sr-only`, not `hidden`: below md the rail shows icons only, and
            `display: none` takes the name out of the accessibility tree as
            well as off the screen. The link would then be announced as
            "link", with nothing else. */}
        <span className="sr-only text-lg font-semibold tracking-tight md:not-sr-only md:inline">
          {tApp("name")}
        </span>
      </Link>

      <nav aria-label={t("primary")} className="flex flex-col gap-1">
        {items.map(({ href, key, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            // The active item is currently signalled by colour alone.
            aria-current={isActive(href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-control px-2.5 py-2 text-sm font-medium transition-colors",
              isActive(href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {/* See the note on the logo: on the narrow rail this is the
                only name the link has. */}
            <span className="sr-only md:not-sr-only md:inline">{t(key)}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
