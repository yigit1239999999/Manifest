import {
  FieldSkeleton,
  FormSkeleton,
  SubmitSkeleton,
} from "@/components/loaders";

/**
 * The same form as `/appointments/new`, and its own `loading.tsx`
 * because without one this route falls through to `[id]`'s -- which
 * draws a record's two-column detail page. Waiting for a form under the
 * shape of a page that is not coming is worse than waiting under
 * nothing: everything on screen moves when the form arrives.
 */
export default function Loading() {
  return (
    <FormSkeleton>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton rows={3} />
        <SubmitSkeleton />
      </div>
    </FormSkeleton>
  );
}
