import {
  FieldSkeleton,
  FieldsetSkeleton,
  FormSkeleton,
  SubmitSkeleton,
} from "@/components/loaders";

/**
 * `VisitForm`, box for box, at its width (`wide`).
 *
 * One thing it cannot reserve: the new-animal block, which opens when a
 * vet comes back to a draft they left with it open. It is theirs and it
 * is rare; drawing it for everybody would move the button down for the
 * many to keep it still for the few.
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
        <FieldSkeleton rows={2} />
        {/* SOAP: four four-row boxes, which is where most of this form's
            height lives. A skeleton that drew them as one-line inputs
            would put the button two hundred pixels too high. */}
        <FieldsetSkeleton cols={2}>
          <FieldSkeleton rows={4} />
          <FieldSkeleton rows={4} />
          <FieldSkeleton rows={4} />
          <FieldSkeleton rows={4} />
        </FieldsetSkeleton>
        <FieldsetSkeleton cols={4}>
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
        </FieldsetSkeleton>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <SubmitSkeleton />
      </div>
    </FormSkeleton>
  );
}
