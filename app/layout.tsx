import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { ThemeInitScript } from "@/components/theme-init-script";
import { ToastProvider } from "@/components/toast-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: `${t("name")} — ${t("tagline")}`,
    description: t("tagline"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  // SSR theme: trust an explicit cookie if present; otherwise the inline
  // script in <head> upgrades to the system preference before paint.
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get("theme")?.value;
  const initialTheme =
    cookieTheme === "dark"
      ? "dark"
      : cookieTheme === "light"
        ? "light"
        : "light";

  return (
    <html
      lang={locale}
      data-theme={initialTheme}
      className={`${geistSans.variable} antialiased`}
      // ThemeInitScript runs before paint to apply the OS preference
      // when no cookie is set, so the server-rendered data-theme will
      // legitimately not match the hydrated value. Suppress the warning
      // on this element only — every child still gets full hydration
      // checks.
      suppressHydrationWarning
    >
      <head>
        <ThemeInitScript />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <ToastProvider />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
