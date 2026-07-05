/**
 * Admin routes — internal operations not exposed to end users.
 *
 * All endpoints require the X-Admin-Key header to match the ADMIN_API_KEY
 * environment variable. If ADMIN_API_KEY is not set the routes return 503.
 *
 * Routes:
 *   GET  /admin/sync/status       — current sync state + last run timestamp
 *   POST /admin/sync/projections  — trigger an immediate projection sync
 */

import { Router } from "express";
import { syncProjections, getLastSyncAt, getIsSyncing } from "../lib/syncScheduler";
import { logger } from "../lib/logger";

const router = Router();

function requireAdminKey(
  req: any,
  res: any,
  next: () => void,
): void {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    res.status(503).json({
      error: "Admin endpoint not configured. Set ADMIN_API_KEY in environment.",
    });
    return;
  }
  const provided = req.headers["x-admin-key"];
  if (!provided || provided !== adminKey) {
    res.status(401).json({ error: "Invalid or missing X-Admin-Key header." });
    return;
  }
  next();
}

// GET /admin/sync/status
router.get("/admin/sync/status", requireAdminKey, (_req, res): void => {
  res.json({
    isSyncing: getIsSyncing(),
    lastSyncAt: getLastSyncAt()?.toISOString() ?? null,
  });
});

// POST /admin/sync/projections
// Body (optional): { season: number }
router.post(
  "/admin/sync/projections",
  requireAdminKey,
  async (req, res): Promise<void> => {
    if (getIsSyncing()) {
      res.status(409).json({
        error: "A sync is already in progress. Check /admin/sync/status and retry.",
      });
      return;
    }

    const season = req.body?.season ? Number(req.body.season) : undefined;
    if (season !== undefined && (isNaN(season) || season < 2010 || season > 2100)) {
      res.status(400).json({ error: "Invalid season value." });
      return;
    }

    try {
      logger.info({ season, triggeredBy: "admin-api" }, "Manual projection sync initiated");
      const result = await syncProjections(season);
      res.json({
        success: true,
        synced: result.synced,
        errors: result.errors,
        startedAt: result.startedAt.toISOString(),
        completedAt: result.completedAt.toISOString(),
        durationMs: result.completedAt.getTime() - result.startedAt.getTime(),
      });
    } catch (err: any) {
      logger.error({ err }, "Admin-triggered projection sync failed");
      res.status(500).json({ error: err?.message ?? "Sync failed. Check server logs." });
    }
  },
);

export default router;
