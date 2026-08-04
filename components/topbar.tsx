import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOutAction } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { initials } from "@/lib/format";
import { getThemePreference } from "@/lib/theme";

export async function Topbar({
  clinicName,
  userName,
}: {
  clinicName: string;
  userName: string;
}) {
  const [t, theme] = await Promise.all([
    getTranslations("nav"),
    getThemePreference(),
  ]);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
      <span className="truncate text-sm font-semibold text-foreground">
        {clinicName}
      </span>

      <div className="flex items-center gap-3">
        <CommandPalette />
        <ThemeToggle initialTheme={theme} />
        <LocaleSwitcher />
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
            {initials(userName)}
          </span>
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {userName}
          </span>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut />
            <span className="hidden sm:inline">{t("signOut")}</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
