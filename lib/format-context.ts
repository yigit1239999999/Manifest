import { cache } from "react";
import { getLocale } from "next-intl/server";
import { getClinicSettings } from "@/modules/clinics/queries";
import { requireSession } from "@/lib/session";
import type { FormatContext } from "@/lib/format";

/**
 * Locale and clinic time zone for everything a signed-in page displays.
 *
 * Dates are instants; the clinic's clock is the only one that matters for
 * showing them. Deployed on Vercel the server runs on UTC, so formatting
 * without a zone would show a clinic in Istanbul every appointment three
 * hours early — and disagree with the WhatsApp messages, which have always
 * used the clinic zone.
 *
 * Deduplicated per request, so pages can call it freely.
 */
export const getFormatContext = cache(async (): Promise<FormatContext> => {
  const [locale, session] = await Promise.all([getLocale(), requireSession()]);
  const clinic = await getClinicSettings(session.user.clinicId);
  return { locale, timeZone: clinic?.timezone || undefined };
});
