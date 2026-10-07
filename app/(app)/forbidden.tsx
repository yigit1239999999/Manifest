import { ForbiddenView } from "@/components/ui/forbidden-state";

/**
 * The 403 screen for every page in the app shell, inside the shell: the
 * sidebar and the top bar stay, so the way on is where it always is.
 * Reached through `ForbiddenState` (`forbidden()`), never directly.
 */
export default function Forbidden() {
  return <ForbiddenView />;
}
