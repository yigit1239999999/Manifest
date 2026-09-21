import { CardSkeleton, HeaderSkeleton } from "@/components/loaders";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  // The route is a "new reminder" form card followed by the list of
  // reminders, so neither the list nor the detail skeleton fits it.
  return (
    <div className="flex flex-col gap-6">
      <HeaderSkeleton />
      <CardSkeleton lines={3} description={false} />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
