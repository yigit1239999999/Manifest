"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, PawPrint, CalendarClock, Syringe } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/pets", label: "Pets", icon: PawPrint },
];

const SOON = [
  { label: "Appointments", icon: CalendarClock },
  { label: "Care & vaccines", icon: Syringe },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col gap-6 border-r border-border bg-card px-3 py-5 md:w-64 md:px-4">
      <Link href="/" className="flex items-center gap-2.5 px-1.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <PawPrint className="size-5" />
        </span>
        <span className="hidden text-lg font-semibold tracking-tight md:inline">
          PetTrack
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              isActive(href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span className="hidden md:inline">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="hidden flex-col gap-1 md:flex">
        <p className="px-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
          Coming soon
        </p>
        {SOON.map(({ label, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground/55"
          >
            <Icon className="size-5 shrink-0" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto hidden rounded-xl bg-accent/60 p-3 md:block">
        <p className="text-xs font-semibold text-accent-foreground">Built with care</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Happier pets, calmer clinics.
        </p>
      </div>
    </aside>
  );
}
