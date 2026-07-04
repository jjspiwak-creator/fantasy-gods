import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";

/**
 * Express 4-argument error handler — must be the last app.use() in app.ts.
 * Catches any error passed to next(err) or thrown inside async route handlers
 * (when wrapped by asyncHandler). Logs with full context so every server-side
 * crash appears in Replit logs with enough detail to diagnose.
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const error = err instanceof Error ? err : new Error(String(err));

  logger.error(
    {
      reqId: req.id,
      method: req.method,
      url: req.url,
      statusCode: (err as any)?.statusCode ?? 500,
      errName: error.name,
      errMessage: error.message,
      stack: error.stack,
    },
    "Unhandled route error"
  );

  const status = typeof (err as any)?.statusCode === "number" ? (err as any).statusCode : 500;

  if (!res.headersSent) {
    res.status(status).json({
      error: status < 500 ? error.message : "An unexpected server error occurred.",
    });
  }
};

/**
 * Thin wrapper so async route handlers don't need try/catch boilerplate.
 * Usage: router.get("/path", asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
