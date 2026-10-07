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
  Syringe,
  Upload,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/permissions";

// Permission belongs to the entry, not to the component's signature.
//
// It used to arrive two ways at once: `/audit` was in this list
// unconditionally while `/staff` and `/settings` came in as two booleans
// from the layout. So the sidebar showed every role a link to the clinic's
// entire change history, and adding the check as a third boolean would have
// worked while guaranteeing a fourth one for the next permission.
//
// An entry with no `permission` is for everyone. An entry with a LIST of
// them needs all of them, and `/import` is why the field takes one: a row
// of that file is a client and an animal, so half the permission is no
// permission -- `modules/import/request.ts` refuses on exactly that pair,
// and a rail that asked for only one of the two would offer the door
// beside the locked one. A list rather than a new `import.write`
// permission, because the endpoint invented none either and two names for
// one rule is how they drift apart.
export type NavItem = {
  href: string;
  key: string;
  icon: typeof Home;
  permission?: Permission | readonly Permission[];
};

export const NAV: NavItem[] = [
  { href: "/", key: "dashboard", icon: Home },
  { href: "/clients", key: "clients", icon: Users },
  { href: "/pets", key: "pets", icon: PawPrint },
  { href: "/visits", key: "visits", icon: Stethoscope },
  { href: "/appointments", key: "appointments", icon: CalendarClock },
  { href: "/prescriptions", key: "prescriptions", icon: Pill },
  { href: "/reminders", key: "reminders", icon: ClipboardList },
  // Beside the reminders it feeds: the list of whom to call this week.
  { href: "/recalls", key: "recalls", icon: Syringe },
  { href: "/invoices", key: "invoices", icon: Receipt },
  // Under the day's work and above the history, because that is what it
  // is: not something a vet opens between patients, and not a record of
  // what happened either. Onboarding shows this door once -- the first-run
  // screen stops being the first-run screen the evening the first visit is
  // written -- and the second spreadsheet arrives months later, which is
  // when this is the only way back (ux).
  { href: "/import", key: "import", icon: Upload, permission: ["clients.write", "pets.write"] },
  { href: "/audit", key: "audit", icon: History, permission: "audit.read" },
  { href: "/staff", key: "staff", icon: UserCog, permission: "users.manage" },
  {
    href: "/settings",
    key: "settings",
    icon: Settings,
    permission: "settings.manage",
  },
];

/** The entries this role may open, in rail order. */
export function navItemsFor(permissions: readonly Permission[]): NavItem[] {
  return NAV.filter((item) => {
    if (!item.permission) return true;
    // `every`, so a list is an AND. The other reading -- any one of them
    // opens the door -- is the one that would be wrong here and wrong
    // quietly: the page behind it would still refuse, and the rail would
    // have promised.
    const needed =
      typeof item.permission === "string" ? [item.permission] : item.permission;
    return needed.every((p) => permissions.includes(p));
  });
}

export function isActiveHref(pathname: string, href: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  permissions,
}: {
  /**
   * What this role may do, resolved once in the layout.
   *
   * An array rather than a `Set`: this is a client component, so the prop
   * crosses the server boundary, and three strings in the payload read as
   * what they are. A `Set` would serialise too and save nothing at this
   * size.
   *
   * Hiding a link is not access control — every page behind one of these
   * checks its own permission and answers with the forbidden state. This
   * only stops the sidebar from offering a door the user cannot open.
   */
  permissions: readonly Permission[];
}) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();

  const items = navItemsFor(permissions);
  const isActive = (href: string) => isActiveHref(pathname, href);

  return (
    // Hidden below `md`, where `BottomNav` takes over: the 56px rail of
    // unlabelled icons was a row of riddles on a phone (pm B15, the vet:
    // "mobil kenar menü yalnız ikon"). From `md` up nothing changed.
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-border bg-card px-4 py-5 md:flex">
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
