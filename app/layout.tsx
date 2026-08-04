import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { ToastProvider } from "@/components/toast-provider";
import { getThemePreference } from "@/lib/theme";
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
  const [locale, messages, theme] = await Promise.all([
    getLocale(),
    getMessages(),
    getThemePreference(),
  ]);

  // `data-theme` is derived purely from the cookie ("light" | "dark" |
  // "system"), so the server and client render the same value — no
  // hydration mismatch. CSS resolves "system" via a prefers-color-scheme
  // media query, so there's no flash and no inline script needed.
  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${geistSans.variable} antialiased`}
    >
      <body className="min-h-screen bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <ToastProvider />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
