import {
  FieldSkeleton,
  FormSectionSkeleton,
  FormSkeleton,
} from "@/components/loaders";

/**
 * The same form as `/clients/new`, and it stops in the same place.
 *
 * Without a `loading.tsx` this route inherits `[id]`'s, which draws a
 * client's two-column detail page -- the wrong shape, and the one the
 * reader has just come from, which makes it read as "nothing happened".
 *
 * Two reasons to stop after the identity fields rather than one. The
 * consent question wraps in Turkish at 390px and not in English, and a
 * grey box cannot wrap where words do (`/clients/new` has the numbers).
 * Below it, `OptionalDetails` opens on arrival when the record has any
 * of those nine fields filled -- around four hundred pixels, decided by
 * the answer this page is still waiting for. Either one alone would be
 * enough to stop here.
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
          <FieldSkeleton hint />
        </FormSectionSkeleton>
      </div>
    </FormSkeleton>
  );
}
