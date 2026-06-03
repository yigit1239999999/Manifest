// Structured logger. Writes JSON in production for log aggregators,
// pretty single-line text in development. Error-level entries are
// forwarded to Sentry (no-op when SENTRY_DSN is unset).

import * as Sentry from "@sentry/nextjs";

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

interface Logger {
  debug(message: string, ctx?: LogContext): void;
  info(message: string, ctx?: LogContext): void;
  warn(message: string, ctx?: LogContext): void;
  error(message: string, ctx?: LogContext): void;
  child(base: LogContext): Logger;
}

function forwardToSentry(message: string, ctx?: LogContext) {
  if (!process.env.SENTRY_DSN) return;
  const err = ctx?.err;
  if (err instanceof Error) {
    Sentry.captureException(err, { tags: { event: message }, extra: ctx });
  } else {
    Sentry.captureMessage(message, {
      level: "error",
      extra: ctx,
    });
  }
}

function emit(level: LogLevel, message: string, ctx?: LogContext): void {
  const entry = { ts: new Date().toISOString(), level, msg: message, ...ctx };
  if (process.env.NODE_ENV === "production") {
    if (level === "error") console.error(JSON.stringify(entry));
    else if (level === "warn") console.warn(JSON.stringify(entry));
    else console.log(JSON.stringify(entry));
  } else {
    const label = level.toUpperCase().padEnd(5);
    const tail = ctx && Object.keys(ctx).length > 0 ? " " + JSON.stringify(ctx) : "";
    if (level === "error") console.error(`[${label}] ${message}${tail}`);
    else if (level === "warn") console.warn(`[${label}] ${message}${tail}`);
    else console.log(`[${label}] ${message}${tail}`);
  }

  if (level === "error") forwardToSentry(message, ctx);
}

function build(base?: LogContext): Logger {
  const merge = (ctx?: LogContext) =>
    base || ctx ? { ...base, ...ctx } : undefined;
  return {
    debug: (m, c) => emit("debug", m, merge(c)),
    info: (m, c) => emit("info", m, merge(c)),
    warn: (m, c) => emit("warn", m, merge(c)),
    error: (m, c) => emit("error", m, merge(c)),
    child: (extra) => build({ ...base, ...extra }),
  };
}

export const logger: Logger = build();
