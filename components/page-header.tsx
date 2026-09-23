import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  badge,
  titleIsFreeText = false,
  children,
}: {
  title: string;
  description?: string;
  /**
   * Whether this page's title is something a vet typed rather than a
   * record's name.
   *
   * It names a CATEGORY and not an effect, which is the difference
   * between a rule and a style switch (ux). `clampTitle` would have
   * been the effect, and the next person would have read it as a
   * look they could take or leave; "this heading is free text" is a
   * fact about the page, and a second page of that kind gets the
   * right behaviour without anyone deciding again.
   *
   * What it buys today is a three-line clip, and the clip is only
   * honest where the whole title is also somewhere else on the page.
   * Clipping text that has no other home stops being a presentation
   * decision and becomes one about the record, and the person making
   * it does not notice (ux). `visits/[id]` qualifies
   * because the complaint is the first row of its SOAP card; it is the
   * only caller, and `page-header.test` says so out loud rather than
   * leaving that to whoever adds the second one.
   *
   * Off everywhere else, and that is not caution: other headings are a
   * name or a screen's name, so a clip would never fire -- and a
   * setting that never fires is how the rule above gets copied to a
   * page where it does.
   */
  titleIsFreeText?: boolean;
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
          {/* Three lines when the caller asks, and the number has a
              rule behind it rather than a preference: a clip may not
              fall below the longest thing the product has actually
              shown. The longest complaint on file is 75 characters,
              which is three lines at 390px, so this crops nothing that
              exists today. Two would crop it; four would be a wall of
              `text-2xl` on a phone. ui simulated 140 and 280 in the
              browser -- real geometry, invented strings -- and at 280
              the heading took about 60% of a phone screen and pushed
              the record's particulars below the fold. */}
          <h1
            className={cn(
              "text-2xl font-semibold tracking-tight text-foreground",
              titleIsFreeText && "line-clamp-3",
            )}
          >
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
