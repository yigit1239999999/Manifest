"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/**
 * The recall list's filters, applied as they change: vaccine, species,
 * how overdue, what has been tried, and the order.
 *
 * Every value lives in the URL, so a filtered list can be bookmarked or
 * handed to the person on the phone, and the back button undoes a filter.
 * A change resets the page: page 3 of a narrower list is usually empty.
 */
export function RecallFilters({
  view,
  vaccines,
  species,
}: {
  view: "overdue" | "upcoming";
  vaccines: Option[];
  species: Option[];
}) {
  const t = useTranslations("recall.filters");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  const field = (
    key: string,
    label: string,
    options: Option[],
    allLabel: string | null,
    fallback = "",
  ) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <Select
        value={params.get(key) ?? fallback}
        onChange={(e) => set(key, e.currentTarget.value)}
      >
        {allLabel !== null && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );

  return (
    <div
      role="group"
      aria-label={t("label")}
      aria-busy={pending || undefined}
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5",
        pending && "opacity-70",
      )}
    >
      {field("vaccine", t("vaccine"), vaccines, t("allVaccines"))}
      {field("species", t("species"), species, t("allSpecies"))}
      {view === "overdue" &&
        field(
          "age",
          t("age"),
          [
            { value: "month", label: t("ages.month") },
            { value: "recent", label: t("ages.recent") },
            { value: "older", label: t("ages.older") },
            { value: "all", label: t("ages.all") },
          ],
          null,
          "recent",
        )}
      {field(
        "contact",
        t("contact"),
        [
          { value: "none", label: t("contacts.none") },
          { value: "called", label: t("contacts.called") },
          { value: "unreachable", label: t("contacts.unreachable") },
        ],
        t("contacts.any"),
      )}
      {field(
        "sort",
        t("sort"),
        [
          { value: "due", label: view === "overdue" ? t("sorts.dueOverdue") : t("sorts.dueUpcoming") },
          { value: "pet", label: t("sorts.pet") },
          { value: "owner", label: t("sorts.owner") },
        ],
        null,
        "due",
      )}
    </div>
  );
}
