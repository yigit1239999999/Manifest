import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const LOCALES = ["en", "tr"] as const;
export type Locale = (typeof LOCALES)[number];
/**
 * Turkish, because the clinics are.
 *
 * It was English, and a new receptionist whose browser asked for anything
 * else opened the app in a language nobody in the room speaks. It also
 * disagreed with the other default we set: new clinics bill in lira. A
 * product that defaults to lira and defaults to English is arguing with
 * itself.
 *
 * This is the fallback, not a setting. A browser that asks for English
 * still gets English, and a per-clinic language choice — if it is ever
 * needed — goes the way the currency did: a default here, a field in
 * Settings.
 */
export const DEFAULT_LOCALE: Locale = "tr";

export const LOCALE_COOKIE = "locale";

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const accept = (await headers()).get("accept-language")?.toLowerCase() ?? "";
  // Asked for by name, in either direction; otherwise the clinic's own.
  if (accept.includes("tr")) return "tr";
  if (accept.includes("en")) return "en";
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`@/messages/${locale}.json`)).default;
  return { locale, messages };
});
