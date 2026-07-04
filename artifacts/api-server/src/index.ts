import app from "./app";
import { logger } from "./lib/logger";

// ── Process-level crash guards ──────────────────────────────────────────────
// These catch anything that escapes the Express error handler — e.g. errors
// thrown in callbacks, timers, or third-party code. Without these, Node exits
// silently with no log entry.

process.on("uncaughtException", (err) => {
  logger.error(
    { errName: err.name, errMessage: err.message, stack: err.stack },
    "UNCAUGHT EXCEPTION — process will exit"
  );
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error(
    { errName: err.name, errMessage: err.message, stack: err.stack },
    "UNHANDLED PROMISE REJECTION"
  );
  // Don't exit — let the request timeout naturally so in-flight requests finish
});

// ── Server startup ───────────────────────────────────────────────────────────

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
