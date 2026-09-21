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
        {/* `h-24` and not `h-20` since the rows gained a delivery sentence:
            one `text-xs` line plus its `mt-1` is 20px, and a skeleton a
            fifth shorter than what replaces it makes the whole list jump
            under the reader's eye at the moment it becomes readable. */}
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-surface" />
        ))}
      </div>
    </div>
  );
}
