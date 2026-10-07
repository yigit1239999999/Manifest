import {
  FieldSkeleton,
  FieldsetSkeleton,
  FormSkeleton,
  SubmitSkeleton,
} from "@/components/loaders";

/**
 * The same form as `/visits/new`. Its own `loading.tsx` because without
 * one this route inherits `[id]`'s, which draws the two-column detail
 * page of a visit -- a shape the edit form never settles into.
 *
 * An edit never opens the new-animal block (`createVisitIntakeAction` is
 * for new visits only), so here the mirror is exact.
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
