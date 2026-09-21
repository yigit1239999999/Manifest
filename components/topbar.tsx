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
      {/* `min-w-0` beside `truncate`: this is the one thing in the
          header that may give way, so it has to be able to. */}
      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
        {clinicName}
      </span>

      {/* `shrink-0`, and the reason is a correction: `min-w-0` was
          here first and it moved the failure instead of removing it.
          Everything in this group is a fixed size — three theme
          segments, two language buttons, the avatar, sign out — so
          letting the group shrink does not make its contents
          smaller. It made the group 215px wide with 278px of buttons
          hanging out of it, and the page scrolled by 46px on every
          route. My own sweep caught that, pointed at a clinic whose
          name is long enough to produce it.

          So the group keeps its size and the clinic name is the
          thing that yields, which is the right way round: a name can
          be shortened and read, a row of controls cannot. */}
      <div className="flex shrink-0 items-center gap-3">
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
