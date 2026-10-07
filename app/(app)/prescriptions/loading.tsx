import { ListSkeleton } from "@/components/loaders";

export default function Loading() {
  // Prescriptions are created from a visit, so this route has no action of
  // its own and no filter.
  return <ListSkeleton action={false} filter={false} />;
}
