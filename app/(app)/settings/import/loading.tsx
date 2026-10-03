import { HeaderSkeleton } from "@/components/loaders";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  // Stepper, then the drop area and the template card of the first step.
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Skeleton className="h-4 w-20" />
      <HeaderSkeleton />
      <Skeleton className="h-7 w-full" />
      <Skeleton className="h-56 w-full rounded-surface" />
      <Skeleton className="h-20 w-full rounded-surface" />
    </div>
  );
}
