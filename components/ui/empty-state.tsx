import * as React from "react";
import type { LucideIcon } from "lucide-react";

// "There is nothing here" is said at two very different scales, and until
// now only the larger one had a component.
//
//   - `page` owns the whole area a list would have filled: a dashed card, an
//     icon, and room for the action that would fix the emptiness. It is the
//     main event on the screen.
//   - `inline` is a section inside a card that happens to have no rows —
//     one of four on `/pets/[id]`, three on the dashboard, both chart
//     components. Eleven call sites wrote it by hand as
//     `<p className="text-sm text-muted-foreground">`, identical in all
//     eleven, which is the copy-count at which the twelfth starts to differ
//     (TEAM.md #18).
//
// The difference is not a style choice: giving a card section the dashed
// frame and the 56px icon would make the absence louder than the sections
// around it that do have content, and four of them on one page would be all
// the reader sees. So `inline` takes no icon, and no description or action
// either — no call site has one, and the three props `page` carries are
// exactly what makes it the wrong size for a card section. The type makes
// each of those a compile error rather than a convention; a rule a caller
// cannot read is a rule that lasts until the next caller (TEAM.md #6, #30).

type EmptyStateProps =
  | {
      size?: "page";
      icon: LucideIcon;
      title: string;
      description?: string;
      action?: React.ReactNode;
    }
  | {
      size: "inline";
      title: string;
      icon?: never;
      description?: never;
      action?: never;
    };

export function EmptyState(props: EmptyStateProps) {
  if (props.size === "inline") {
    return <p className="text-sm text-muted-foreground">{props.title}</p>;
  }

  const { icon: Icon, title, description, action } = props;

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-surface border border-dashed border-border bg-card/60 px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-pill bg-accent text-accent-foreground">
        <Icon className="size-7" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
