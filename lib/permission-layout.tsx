import { forbidden } from "next/navigation";
import { requireSession } from "@/lib/session";
import { can, type Permission } from "@/lib/permissions";

/**
 * A segment layout that refuses a role before anything is streamed.
 *
 * Why a layout and not only the page's own guard: every one of these
 * routes has a `loading.tsx`, so its page renders inside a Suspense
 * boundary and the response has already gone out as `200` by the time
 * the page can say no -- Next cannot change a status once streaming has
 * started (`node_modules/next/dist/docs/01-app/03-api-reference/
 * 04-functions/forbidden.md`). The segment's layout renders outside that
 * boundary, so `forbidden()` here is a real 403 (pm C14).
 *
 * The page keeps its own `ForbiddenState` guard: the layout is the status
 * code, the page is the rule, and `app/route-states.test.ts` reads the
 * page. `app/(app)/forbidden.tsx` draws the refusal either way.
 */
export function permissionLayout(...needed: Permission[]) {
  return async function PermissionLayout({ children }: { children: React.ReactNode }) {
    const session = await requireSession();
    if (!needed.every((p) => can(session.user.role, p))) forbidden();
    return children;
  };
}
