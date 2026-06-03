// Next.js calls register() once per worker before any route handlers run.
// We dispatch to the Sentry config for the active runtime so a Node.js
// server gets the Node SDK, while edge functions get the edge SDK.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
