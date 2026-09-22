import {
  FieldSkeleton,
  FormSectionSkeleton,
  FormSkeleton,
} from "@/components/loaders";

/**
 * `ClientForm`, as far as it can be reserved.
 *
 * Its own `loading.tsx` because without one this route inherits
 * `/clients`'s, which draws the client list: a search box and six rows.
 * The counter is on its way to a form, and the screen it waits under is
 * the one it just left.
 *
 * It stops above the consent question, and the reason is a measurement.
 * The three answers sit side by side until the line runs out, and at
 * 390px the line runs out in Turkish and not in English: pm measured the
 * group at 64px in TR (two rows) against 28px in EN, in a container that
 * is 244px wide -- the shell keeps a 64px rail at every width
 * (`components/sidebar.tsx:86`), which is where the room goes.
 *
 * A skeleton cannot read that. Its own text is grey boxes, so it cannot
 * wrap where the words wrap, and a fixed height would be 36px short in
 * one language or 36px long in the other -- the second being the worse
 * of the two, since it would invent a jump where there is none today.
 * Text width is data like any other, and the rule is the same: reserve
 * the same box or draw nothing. So the fold and the button are not drawn
 * either; everything above lands where it is drawn.
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
      </div>
    </FormSkeleton>
  );
}
