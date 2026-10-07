import { HeaderSkeleton } from "@/components/loaders";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  // Header, the two tabs, the filter row, then rows the height of a
  // two-line recall row.
  return (
    <div className="flex flex-col gap-6">
      <HeaderSkeleton />
      <Skeleton className="h-10 w-72 rounded-control" />
      <Skeleton className="h-14 rounded-control" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-control" />
        ))}
      </div>
    </div>
  );
}
