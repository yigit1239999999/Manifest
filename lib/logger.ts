// Structured logger. Writes JSON in production for log aggregators,
// pretty single-line text in development. A drop-in replacement with
// Pino / Sentry can be wired in `emit()` without touching call sites.

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

interface Logger {
  debug(message: string, ctx?: LogContext): void;
  info(message: string, ctx?: LogContext): void;
  warn(message: string, ctx?: LogContext): void;
  error(message: string, ctx?: LogContext): void;
  child(base: LogContext): Logger;
}

function emit(level: LogLevel, message: string, ctx?: LogContext): void {
  const entry = { ts: new Date().toISOString(), level, msg: message, ...ctx };
  if (process.env.NODE_ENV === "production") {
    // One JSON line per log entry — easy to ingest in any log aggregator.
    if (level === "error") console.error(JSON.stringify(entry));
    else if (level === "warn") console.warn(JSON.stringify(entry));
    else console.log(JSON.stringify(entry));
    return;
  }
  const label = level.toUpperCase().padEnd(5);
  const tail = ctx && Object.keys(ctx).length > 0 ? " " + JSON.stringify(ctx) : "";
  if (level === "error") console.error(`[${label}] ${message}${tail}`);
  else if (level === "warn") console.warn(`[${label}] ${message}${tail}`);
  else console.log(`[${label}] ${message}${tail}`);
}

function build(base?: LogContext): Logger {
  const merge = (ctx?: LogContext) => (base || ctx ? { ...base, ...ctx } : undefined);
  return {
    debug: (m, c) => emit("debug", m, merge(c)),
    info:  (m, c) => emit("info",  m, merge(c)),
    warn:  (m, c) => emit("warn",  m, merge(c)),
    error: (m, c) => emit("error", m, merge(c)),
    child: (extra) => build({ ...base, ...extra }),
  };
}

export const logger: Logger = build();
