import {
  ConsentSkeleton,
  FieldSkeleton,
  FormSectionSkeleton,
  FormSkeleton,
} from "@/components/loaders";

/**
 * The same form as `/clients/new`, and it stops early on purpose.
 *
 * Without a `loading.tsx` this route inherits `[id]`'s, which draws a
 * client's two-column detail page -- the wrong shape, and the one the
 * reader has just come from, which makes it read as "nothing happened".
 *
 * It ends above the fold because `OptionalDetails` opens on arrival when
 * the record has any of those nine fields filled, and that answer is the
 * one the page is still waiting for. An open fold is around four hundred
 * pixels; a skeleton that guessed would put the button in the wrong
 * place for whichever half of the clinic's clients it guessed against.
 * So the fold and the button are not drawn at all, and everything above
 * them lands where it is drawn. Same call as `DashboardSkeleton` makes
 * about the first-run card it cannot see.
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
        <ConsentSkeleton />
      </div>
    </FormSkeleton>
  );
}
