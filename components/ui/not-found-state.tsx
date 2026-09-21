import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";

/**
 * What a `notFound()` inside the app shell looks like.
 *
 * Shared by the generic boundary and the five section ones, which differ in
 * a single respect: where the way out goes. Sending someone who clicked a
 * dead pet link to the dashboard makes them find the route again; sending
 * them to the pet list is what they were trying to do.
 *
 * The wording never says *why*. The services answer "not found" rather than
 * "forbidden" for another clinic's record, so that its existence is not
 * leaked, and this screen holds the same line. Rejecting someone for lack of
 * a role is a different situation with a different screen, because there is
 * nothing to leak: /staff exists in every clinic.
 */
export function NotFoundState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <EmptyState
      icon={SearchX}
      title={title}
      description={description}
      action={
        <Link
          href={actionHref}
          className={buttonVariants({ variant: "secondary" })}
        >
          {actionLabel}
        </Link>
      }
    />
  );
}
