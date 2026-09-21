import { cookies } from "next/headers";

export type ThemePreference = "light" | "dark" | "system";

/**
 * The user's saved theme selection, read from the `theme` cookie on the
 * server. Passed into <ThemeToggle> so its initial (server-rendered) active
 * state matches what the client hydrates with — avoiding a hydration
 * mismatch on the toggle. Defaults to "system" when no cookie is set.
 */
export async function getThemePreference(): Promise<ThemePreference> {
  const value = (await cookies()).get("theme")?.value;
  return value === "dark" || value === "light" || value === "system"
    ? value
    : "system";
}
