import { formatPhone, telHref } from "@/lib/phone";
import { cn } from "@/lib/utils";

/**
 * A client's number wherever it is shown: dialable when it can be dialled,
 * plain text when it cannot. Something that looks tappable and does
 * nothing is worse than text.
 *
 * One component rather than the eight hand-written `<a href={telHref…}>`
 * the screens had, so the number is printed one way everywhere: a Turkish
 * number as "0532 411 22 33" whether it was typed "05324112233" or
 * "+90 (532) 411-22-33" (`formatPhone`). The stored text is untouched --
 * how somebody typed it is kept, how it is read is decided here.
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
      {formatPhone(phone)}
    </a>
  ) : (
    <span className={cn("whitespace-nowrap", className)}>{formatPhone(phone)}</span>
  );
}
