import {
  FieldSkeleton,
  FormSkeleton,
  SubmitSkeleton,
} from "@/components/loaders";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * `InvoiceForm`, box for box, at its width (`wide`).
 *
 * The line editor starts with exactly one line, always -- an empty one,
 * or the visit being billed -- so it is reserved rather than guessed.
 * What cannot be known here is whether the page draws the form at all: a
 * clinic with no clients gets `MissingLink` instead. See
 * `/appointments/new` for why the form is the shape reserved.
 */
export default function Loading() {
  return (
    <FormSkeleton wide>
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <FieldSkeleton hint />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-24" />
          {/* One line row, at the height the real one has: a bordered
              `p-3` box around controls that are `h-10` like every other
              control in the product. */}
          <div className="rounded-control border border-border p-3">
            <Skeleton className="h-10 w-full" />
          </div>
          {/* "+ Add line" is a `size="sm"` ghost button, which is `h-8`
              and not `h-10`. */}
          <Skeleton className="h-8 w-28" />
        </div>
        <FieldSkeleton rows={3} />
        <SubmitSkeleton />
      </div>
    </FormSkeleton>
  );
}
