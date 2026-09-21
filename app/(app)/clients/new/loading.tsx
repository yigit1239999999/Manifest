import {
  ConsentSkeleton,
  FieldSkeleton,
  FoldSkeleton,
  FormSectionSkeleton,
  FormSkeleton,
  SubmitSkeleton,
} from "@/components/loaders";

/**
 * `ClientForm`, box for box.
 *
 * Its own `loading.tsx` because without one this route inherits
 * `/clients`'s, which draws the client list: a search box and six rows.
 * The counter is on its way to a form, and the screen it waits under is
 * the one it just left.
 *
 * A new client never opens the fold -- `defaultOpen` is derived from a
 * record, and there is no record here -- so the closed fold and the
 * button under it are reserved exactly.
 */
export default function Loading() {
  return (
    <FormSkeleton>
      <div className="flex flex-col gap-8">
        <FormSectionSkeleton description>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton hint />
          </div>
          <FieldSkeleton hint />
        </FormSectionSkeleton>
        <ConsentSkeleton />
        <FoldSkeleton />
        <SubmitSkeleton hint />
      </div>
    </FormSkeleton>
  );
}
