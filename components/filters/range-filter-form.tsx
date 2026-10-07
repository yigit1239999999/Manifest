import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * A list's filters as one plain GET form: a date range, optionally a
 * search and a select, and the params of other filters carried along.
 *
 * A server component and a native form on purpose: the filter is the URL,
 * so a filtered list is a link the vet can bookmark or send the
 * accountant, and it works before any script has loaded.
 */
export function RangeFilterForm({
  action,
  labels,
  from,
  to,
  search,
  select,
  hidden,
  clearHref,
  showClear,
}: {
  action: string;
  labels: { from: string; to: string; apply: string; clear: string };
  from?: string;
  to?: string;
  search?: { name: string; label: string; value?: string };
  select?: {
    name: string;
    label: string;
    value?: string;
    allLabel: string;
    options: Array<{ value: string; label: string }>;
  };
  hidden?: Record<string, string | undefined>;
  clearHref: string;
  showClear: boolean;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      {Object.entries(hidden ?? {}).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      {search && (
        <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-56">
          <Label htmlFor={`filter-${search.name}`}>{search.label}</Label>
          <Input id={`filter-${search.name}`} type="search" name={search.name} defaultValue={search.value} />
        </div>
      )}
      {select && (
        <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-52">
          <Label htmlFor={`filter-${select.name}`}>{select.label}</Label>
          <Select id={`filter-${select.name}`} name={select.name} defaultValue={select.value ?? ""}>
            <option value="">{select.allLabel}</option>
            {select.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-40 sm:flex-none">
        <Label htmlFor="filter-from">{labels.from}</Label>
        <Input id="filter-from" type="date" name="from" defaultValue={from} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-40 sm:flex-none">
        <Label htmlFor="filter-to">{labels.to}</Label>
        <Input id="filter-to" type="date" name="to" defaultValue={to} />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary">
          {labels.apply}
        </Button>
        {showClear && (
          <Link href={clearHref} className={buttonVariants({ variant: "ghost" })}>
            {labels.clear}
          </Link>
        )}
      </div>
    </form>
  );
}
