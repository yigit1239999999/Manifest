import {
  ConsentSkeleton,
  FieldSkeleton,
  FoldSkeleton,
  FormSectionSkeleton,
  FormSkeleton,
  PhoneFieldSkeleton,
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
 * The consent question came back into it once the answers stacked
 * (`ConsentChoice`): its height is now a fact of the layout rather than
 * of the language, so a grey box can hold its place. Before that it was
 * 64px in Turkish and 28px in English at 390px, and this route had to
 * stop above it.
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
          <PhoneFieldSkeleton />
        </FormSectionSkeleton>
        <ConsentSkeleton />
        <FoldSkeleton />
        <SubmitSkeleton hint />
      </div>
    </FormSkeleton>
  );
}
