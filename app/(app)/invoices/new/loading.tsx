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
          {/* The number is not a field any more: a label and the sentence
              that it is given on save. */}
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-56" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-24" />
          {/* One line row, at the height the real one has: a bordered
              `p-3` box around labelled controls -- a label line over an
              `h-10` control, like every other field in the product. */}
          <div className="rounded-control border border-border p-3">
            <Skeleton className="h-16 w-full" />
          </div>
          {/* "+ Add line" is a `size="sm"` ghost button, which is `h-8`
              and not `h-10`. */}
          <Skeleton className="h-8 w-28" />
        </div>
        {/* The totals box: the VAT rate and three lines of figures. */}
        <div className="flex w-full flex-col gap-3 rounded-control border border-border p-4 sm:ms-auto sm:w-80">
          <FieldSkeleton />
          <Skeleton className="h-16 w-full" />
        </div>
        <FieldSkeleton rows={3} />
        <SubmitSkeleton />
      </div>
    </FormSkeleton>
  );
}
