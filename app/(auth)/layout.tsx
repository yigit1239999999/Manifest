import { redirect } from "next/navigation";
import { PawPrint } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { getThemePreference } from "@/lib/theme";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const [t, theme] = await Promise.all([
    getTranslations("app"),
    getThemePreference(),
  ]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <ThemeToggle initialTheme={theme} />
        <LocaleSwitcher />
      </div>
      <div className="flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <PawPrint className="size-6" />
        </span>
        <span className="text-xl font-semibold tracking-tight">{t("name")}</span>
      </div>
      {children}
      <p className="text-xs text-muted-foreground">{t("tagline")}</p>
    </div>
  );
}
