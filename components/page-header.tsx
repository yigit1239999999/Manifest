import * as React from "react";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {/* `flex-wrap` is load-bearing, not tidiness. The actions are buttons
          with `whitespace-nowrap`, and `/pets/[id]` puts four of them here
          ("New visit", "New appointment", "Edit", "Archive"). Without
          wrapping they ran past the right edge at 390px, and an action off
          the screen is an action that does not exist (TEAM.md #27). A
          proper overflow menu would be better and is not built yet; until
          it is, the actions take a second line rather than disappear. */}
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
