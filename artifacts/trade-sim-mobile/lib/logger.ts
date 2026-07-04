/**
 * Lightweight structured logger for the Expo mobile app.
 *
 * All output goes to console so it appears in Replit workflow logs and
 * in the Expo dev client terminal. Each level uses a distinct prefix and
 * emoji tag so log lines are easy to grep and visually scan.
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log.info("Simulation started", { leagueId });
 *   log.warn("Slow ESPN response", { ms: 3200 });
 *   log.error("ESPN fetch failed", err, { endpoint: "/teams" });
 */

type Context = Record<string, unknown>;

function serialize(ctx?: Context): string {
  if (!ctx || Object.keys(ctx).length === 0) return "";
  try {
    return " " + JSON.stringify(ctx);
  } catch {
    return " [unserializable context]";
  }
}

function timestamp(): string {
  return new Date().toISOString();
}

export const log = {
  info(message: string, ctx?: Context) {
    console.log(`[${timestamp()}] ℹ️  INFO  ${message}${serialize(ctx)}`);
  },

  warn(message: string, ctx?: Context) {
    console.warn(`[${timestamp()}] ⚠️  WARN  ${message}${serialize(ctx)}`);
  },

  /**
   * Log an error with optional extra context.
   * Pass the raw Error object as the second argument so the stack trace is
   * always captured. Extra key/value pairs go in the third argument.
   */
  error(message: string, err?: unknown, ctx?: Context) {
    const errContext: Context = {};
    if (err instanceof Error) {
      errContext.errName = err.name;
      errContext.errMessage = err.message;
      errContext.stack = err.stack;
    } else if (err !== undefined) {
      errContext.rawError = String(err);
    }
    console.error(
      `[${timestamp()}] 🔴 ERROR  ${message}${serialize({ ...errContext, ...ctx })}`
    );
  },

  /**
   * Log a failed API/network request with enough detail to reproduce it.
   */
  apiError(endpoint: string, status: number | string, err?: unknown, ctx?: Context) {
    log.error(`API request failed: ${endpoint}`, err, { status, ...ctx });
  },
};
