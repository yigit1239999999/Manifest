import {
  FieldSkeleton,
  FormSkeleton,
  SubmitSkeleton,
} from "@/components/loaders";

/**
 * `StaffForm`, box for box.
 *
 * Its own `loading.tsx` because without one this route inherits
 * `/staff`'s, which draws a list: six rows with avatars, a heading and a
 * "New staff member" button. A form route that opens as a list of people
 * is not a hint about what is coming, it is a different screen.
 *
 * `description` because this page's `PageHeader` carries a subtitle.
 */
export default function Loading() {
  return (
    <FormSkeleton description>
      <div className="flex flex-col gap-4">
        <FieldSkeleton />
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton hint />
        </div>
        <SubmitSkeleton />
      </div>
    </FormSkeleton>
  );
}
