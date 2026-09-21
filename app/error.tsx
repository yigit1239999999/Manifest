"use client";

import { ErrorState } from "@/components/error-state";

// The outermost boundary below the root layout. Everything inside `(app)` is
// caught one level down by `app/(app)/error.tsx`, which keeps the navigation
// shell; this one is what is left: the auth pages and the root layout's own
// children.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} boundary="app.error" />;
}
