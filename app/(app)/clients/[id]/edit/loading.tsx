import {
  ConsentSkeleton,
  FieldSkeleton,
  FormSectionSkeleton,
  FormSkeleton,
  PhoneFieldSkeleton,
} from "@/components/loaders";

/**
 * The same form as `/clients/new`, and it stops one box earlier.
 *
 * Without a `loading.tsx` this route inherits `[id]`'s, which draws a
 * client's two-column detail page -- the wrong shape, and the one the
 * reader has just come from, which makes it read as "nothing happened".
 *
 * The consent question is drawn here too, now that stacking made its
 * height independent of the language. What is still not drawn is the
 * fold and the button under it: `OptionalDetails` opens on arrival when
 * the record has any of its nine fields filled, which is around four
 * hundred pixels decided by the answer this page is waiting for. That
 * was always the second of two reasons to stop here, and only the first
 * one was fixed. Same call as `DashboardSkeleton` makes about the
 * first-run card it cannot see.
 */
export default function Loading() {
  return (
    <FormSkeleton description>
      <div className="flex flex-col gap-8">
        <FormSectionSkeleton description>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton hint />
          </div>
          <PhoneFieldSkeleton />
        </FormSectionSkeleton>
        <ConsentSkeleton />
      </div>
    </FormSkeleton>
  );
}
