"use client";

import { ErrorState } from "@/components/error-state";

// Inside the shell on purpose. Before this file existed, an error on any app
// page bubbled to `app/error.tsx` and took the sidebar and topbar with it:
// if "try again" failed twice, the only way out was the browser's back
// button. A boundary that strands the user is half a state.
export default function AppSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState error={error} reset={reset} boundary="app.section" showHome />
  );
}
