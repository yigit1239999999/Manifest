import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The three classes that make something a surface, in one place.
 *
 * `Card` is the usual way to get them, but a surface is not always a div:
 * the confirm dialog is a `<dialog>`, the command palette floats, the visit
 * form groups its fields in a `<fieldset>`, and three list rows are links.
 * Each of those wrote the same three classes by hand, which is how a fourth
 * value of the radius gets introduced (TEAM.md #18).
 *
 * The shadow is deliberately not in here. It says "this floats above the
 * page", which is true of the dialog and the toast and false of a card.
 */
export const surface = "rounded-surface border border-border bg-card";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(surface, "shadow-sm", className)} {...props} />;
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-6", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-3 p-6 pt-0", className)} {...props} />
  );
}
