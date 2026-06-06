"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Title as DialogTitle } from "@radix-ui/react-dialog";
import {
  CalendarClock,
  PawPrint,
  Receipt,
  Search,
  Stethoscope,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ClientResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

interface PetResult {
  id: string;
  name: string;
  species: string;
  owner: { firstName: string; lastName: string };
}

interface SearchResults {
  clients: ClientResult[];
  pets: PetResult[];
}

const EMPTY: SearchResults = { clients: [], pets: [] };

export function CommandPalette() {
  const router = useRouter();
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing fetch loading state is the intended use
    setPending(true);
    fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((data: SearchResults) => setResults(data))
      .catch(() => undefined)
      .finally(() => setPending(false));
    return () => controller.abort();
  }, [query, open]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults(EMPTY);
    }
  }

  function go(href: string) {
    handleOpenChange(false);
    router.push(href);
  }

  const visibleResults = query.trim().length >= 2 ? results : EMPTY;

  const QUICK_ACTIONS = [
    { href: "/clients/new", label: `+ ${tNav("clients")}`, icon: Users },
    { href: "/pets/new", label: `+ ${tNav("pets")}`, icon: PawPrint },
    { href: "/visits/new", label: `+ ${tNav("visits")}`, icon: Stethoscope },
    {
      href: "/appointments/new",
      label: `+ ${tNav("appointments")}`,
      icon: CalendarClock,
    },
    { href: "/invoices/new", label: `+ ${tNav("invoices")}`, icon: Receipt },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:bg-muted sm:inline-flex"
        aria-label={tCommon("search")}
      >
        <Search className="size-3.5" />
        <span>{tCommon("search")}</span>
        <kbd className="ml-2 inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={handleOpenChange}
        label={tCommon("search")}
        shouldFilter={false}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      >
        {/* cmdk renders a Radix Dialog under the hood, which requires a
            DialogTitle for screen readers. Keep it visually hidden. */}
        <DialogTitle className="sr-only">{tCommon("search")}</DialogTitle>
        <button
          type="button"
          aria-label="Close"
          onClick={() => handleOpenChange(false)}
          className="fixed inset-0 bg-foreground/30 backdrop-blur-sm animate-in fade-in"
        />
        <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in mx-4">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={tCommon("search")}
              className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {pending && (
              <span className="text-[10px] text-muted-foreground">…</span>
            )}
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-xs text-muted-foreground">
              {tCommon("noResults")}
            </Command.Empty>

            {query.trim().length < 2 && (
              <Command.Group heading={tCommon("add")}>
                {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
                  <PaletteItem
                    key={href}
                    value={`new-${href}`}
                    onSelect={() => go(href)}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <span>{label}</span>
                  </PaletteItem>
                ))}
              </Command.Group>
            )}

            {visibleResults.clients.length > 0 && (
              <Command.Group heading={tNav("clients")}>
                {visibleResults.clients.map((c) => (
                  <PaletteItem
                    key={c.id}
                    value={`client-${c.id}`}
                    onSelect={() => go(`/clients/${c.id}`)}
                  >
                    <Users className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {c.firstName} {c.lastName}
                    </span>
                    {c.email && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {c.email}
                      </span>
                    )}
                  </PaletteItem>
                ))}
              </Command.Group>
            )}

            {visibleResults.pets.length > 0 && (
              <Command.Group heading={tNav("pets")}>
                {visibleResults.pets.map((p) => (
                  <PaletteItem
                    key={p.id}
                    value={`pet-${p.id}`}
                    onSelect={() => go(`/pets/${p.id}`)}
                  >
                    <PawPrint className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {p.owner.firstName} {p.owner.lastName}
                    </span>
                  </PaletteItem>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </div>
      </Command.Dialog>
    </>
  );
}

function PaletteItem({
  value,
  onSelect,
  children,
}: {
  value: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors",
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
      )}
    >
      {children}
    </Command.Item>
  );
}
