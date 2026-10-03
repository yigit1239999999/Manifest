import {
  FieldSkeleton,
  FormSkeleton,
  SubmitSkeleton,
} from "@/components/loaders";

/**
 * `AppointmentForm`, box for box.
 *
 * The one thing this cannot know is whether the page will draw the form
 * at all: a clinic with no animals gets `MissingLink` here instead. That
 * is the first-run screen and it is short, so the skeleton reserves the
 * form -- the shape every clinic past its first animal sees -- and a
 * brand new clinic sees the page settle upward once.
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
