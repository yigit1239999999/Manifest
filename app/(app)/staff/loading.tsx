import { ListSkeleton } from "@/components/loaders";

export default function Loading() {
  // A "New staff member" button, but no search and no filter tabs.
  return <ListSkeleton filter={false} />;
}
