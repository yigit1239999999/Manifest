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
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-4 md:px-8">
      <span className="truncate text-sm font-semibold text-foreground">
        {clinicName}
      </span>

      {/* `min-w-0` so this group can give way at all. Everything in it
          but the user's name is a fixed size, so when the header runs
          out of room the name is the only thing that can yield — and
          without this it refuses, because a flex item will not go
          below its content. That is the long-name half of the defect;
          the breakpoint below is the short-name half. */}
      <div className="flex min-w-0 items-center gap-3">
        <CommandPalette />
        <ThemeToggle initialTheme={theme} />
        <LocaleSwitcher />
        <div className="flex items-center gap-2.5">
          {/* The initials are a picture of the name that follows, so they
              are hidden from assistive technology rather than read out as
              two stray letters. */}
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-pill bg-accent text-sm font-semibold text-accent-foreground"
          >
            {initials(userName)}
          </span>
          {/* `lg`, not `sm`, and this is the third time we have fixed
              this exact shape.

              pm measured 31px of sideways scroll on every one of seven
              routes between 768 and 799. The cause is two thresholds
              chosen independently and firing against each other: these
              two labels open at `sm` (640), and the sidebar widens from
              64px to 240px at `md` (768). So at 768 the header is handed
              176px less room at the moment it is already carrying two
              labels it took on at 640.

              `/staff` was the same shape and took the same answer
              (`a126330`), so the codebase now has one rule rather than
              two: a label that costs header width opens at `lg`, after
              the sidebar has taken its share. The measured band clears
              at 800 and `lg` is 1024, which is later than strictly
              needed — deliberately. The exact edge moves with how long
              the clinic and user names are, so a threshold tuned to
              today's data would be a fourth instance of this bug
              waiting for a longer name.

              `truncate` for the same reason: the number is measured,
              the names are not. */}
          <span className="sr-only truncate text-sm font-medium text-foreground lg:not-sr-only lg:inline">
            {userName}
          </span>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut />
            {/* Without this the narrow layout leaves an unnamed button whose
                only action is to sign the user out. */}
            <span className="sr-only lg:not-sr-only lg:inline">
              {t("signOut")}
            </span>
          </Button>
        </form>
      </div>
    </header>
  );
}
