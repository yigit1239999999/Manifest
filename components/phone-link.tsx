import { telHref } from "@/lib/phone";
import { cn } from "@/lib/utils";

/**
 * A client's number wherever it is shown: dialable when it can be dialled,
 * plain text when it cannot. Something that looks tappable and does
 * nothing is worse than text.
 *
 * One component rather than the eight hand-written `<a href={telHref…}>`
 * the screens had, so the number is printed one way everywhere.
 */
export function PhoneLink({
  phone,
  className,
}: {
  phone: string | null | undefined;
  className?: string;
}) {
  if (!phone) return null;
  const dial = telHref(phone);
  return dial ? (
    <a href={dial} className={cn("whitespace-nowrap hover:underline", className)}>
      {phone}
    </a>
  ) : (
    <span className={cn("whitespace-nowrap", className)}>{phone}</span>
  );
}
