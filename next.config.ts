import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // The Sentry webpack/Turbopack plugin only emits warnings and uploads
  // source maps when an auth token is provided. Without one — e.g. in
  // dev or CI — the plugin runs silently and the SDK still captures
  // runtime errors using the (optional) DSN.
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
