import { CardSkeleton, HeaderSkeleton } from "@/components/loaders";

export default function Loading() {
  // Three cards: enabled species, notifications, the clinic's own species.
  return (
    <div className="flex flex-col gap-6">
      <HeaderSkeleton />
      <CardSkeleton lines={4} />
      <CardSkeleton lines={5} />
      <CardSkeleton lines={2} />
    </div>
  );
}
