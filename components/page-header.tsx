import * as React from "react";

export function PageHeader({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description?: string;
  /**
   * A status badge belonging to the record this page is about.
   *
   * It has its own slot beside the heading because the detail pages were
   * putting it in `children`, which is the action row: a pill sitting
   * between "Edit" and "Archive" reads as a third button. Status is
   * something the page *is*, not something you can do to it.
   */
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {badge}
        </div>
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
