import {
  FieldSkeleton,
  FormSectionSkeleton,
  FormSkeleton,
} from "@/components/loaders";

/**
 * `PetForm`, as far as it can be reserved.
 *
 * It stops after the owner and the name, and the species picker is the
 * reason. That control is a row of chips, one per species the clinic has
 * enabled, and it wraps: on a phone it is one line for a clinic with
 * four species and four lines for one with eleven. Nothing below it can
 * be placed without knowing a number the page has not loaded yet, so
 * nothing below it is drawn -- including the button. Reserving the same
 * box or drawing nothing is the rule; there is no third option that is
 * only a bit wrong.
 */
export default function Loading() {
  return (
    <FormSkeleton>
      <div className="flex flex-col gap-8">
        <FormSectionSkeleton description>
          <FieldSkeleton />
          <FieldSkeleton />
        </FormSectionSkeleton>
      </div>
    </FormSkeleton>
  );
}
