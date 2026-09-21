import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  // `next dev` and `next start` both default to `.next`, so running the
  // production server beside the dev server made them overwrite each
  // other's chunks: the running server kept a manifest in memory while
  // the other rewrote the files it pointed at, and pages died with a
  // 500 on a chunk that no longer existed on disk. The page still
  // rendered, so it read as a product defect rather than an environment
  // one — twice. Set NEXT_DIST_DIR to give the production build its own
  // directory (`NEXT_DIST_DIR=.next-prod npm run build && … npm start`).
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
