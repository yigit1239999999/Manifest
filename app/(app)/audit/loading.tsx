import { ListSkeleton } from "@/components/loaders";

export default function Loading() {
  // Read-only log: nothing to create, nothing to filter.
  return <ListSkeleton action={false} filter={false} rows={8} />;
}
