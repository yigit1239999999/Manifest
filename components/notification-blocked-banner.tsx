import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Callout } from "@/components/ui/callout";

/**
 * One notice at the top of a list when nothing on it can be sent.
 *
 * It exists so the rows do not have to say it. A clinic-wide reason — the
 * master switch is off, the sender title was never approved, the credit ran
 * out — is one fact about the clinic, and repeating it on every row turns
 * one setting into forty identical sentences and sends the vet off to phone
 * forty owners about something no owner did. The row says what is true of
 * that owner, or says nothing; this says what is true of the clinic.
 *
 * The link is offered only to a role that can follow it (`settings.manage`),
 * and when it is not, the notice says who to ask rather than disappearing:
 * being unable to act on a fact is not a reason to be kept from it.
 */
export async function NotificationBlockedBanner({
  children,
  settingsHref,
}: {
  /** What has gone wrong, in the caller's own words. */
  children: React.ReactNode;
  settingsHref?: string;
}) {
  const t = await getTranslations("reminder.delivery");
  return (
    <Callout variant="warning">
      <span>
        {children}{" "}
        {settingsHref ? (
          <Link href={settingsHref} className="underline hover:no-underline">
            {t("openSettings")}
          </Link>
        ) : (
          t("askAdmin")
        )}
      </span>
    </Callout>
  );
}
