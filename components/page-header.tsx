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
          {/* Clipped at three lines. Titles here are usually a name or
              a screen's name and never reach it; the one that can is a
              visit's, which takes the vet's own words for why the
              animal came. Simulated at 1280 and 390 by replacing the
              text in the browser -- the geometry is real, the strings
              are invented -- and at 280 characters the heading ate
              about 60% of a phone screen and pushed the record's
              particulars below the fold (ui).
              
              Three, and the number has a rule behind it rather than a
              preference: the clip may not fall below the longest thing
              the product has actually shown. The longest real complaint
              on file is 75 characters, which is three lines at 390 --
              so this crops nothing that exists today. Two would crop
              it; four would be a wall of `text-2xl` on a phone.
              
              This is only honest because the whole complaint is on the
              page: `visits/[id]` prints it as the first row of the SOAP
              card. A clipped title with no home for the full text stops
              being a presentation decision and becomes one about the
              record (ux). */}
          <h1 className="line-clamp-3 text-2xl font-semibold tracking-tight text-foreground">
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
