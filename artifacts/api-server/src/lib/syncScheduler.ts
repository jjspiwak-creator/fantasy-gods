/**
 * Player Projection Sync Scheduler
 *
 * Provides:
 *   syncProjections(season?)     — on-demand sync: fetch ESPN public projections
 *                                  and upsert into player_projections table
 *   startProjectionSyncScheduler() — weekly Thursday scheduler stub; call once
 *                                    from src/index.ts to activate background sync
 *
 * Production upgrade path:
 *   Replace the setInterval stub below with a proper scheduler such as:
 *     • node-cron:  cron.schedule("0 9 * * 4", syncProjections)   // 9am every Thu
 *     • pg-boss / BullMQ for distributed job queues
 *     • Render / Railway / Fly.io Cron Jobs (external trigger via POST /admin/sync/projections)
 */

import { sql } from "drizzle-orm";
import { db, playerProjectionsTable } from "@workspace/db";
import { fetchPublicPlayerProjections } from "./espnPublicApi";
import { logger } from "./logger";

const UPSERT_BATCH_SIZE = 100;

export interface SyncResult {
  synced: number;
  errors: number;
  startedAt: Date;
  completedAt: Date;
}

let lastSyncAt: Date | null = null;
let isSyncing = false;

export function getLastSyncAt(): Date | null { return lastSyncAt; }
export function getIsSyncing(): boolean { return isSyncing; }

// ─── Core sync function ───────────────────────────────────────────────────────

export async function syncProjections(season?: number): Promise<SyncResult> {
  if (isSyncing) throw new Error("Projection sync already in progress.");
  isSyncing = true;
  const startedAt = new Date();
  let synced = 0;
  let errors = 0;

  try {
    logger.info({ season: season ?? "current" }, "Player projection sync starting");

    const projections = await fetchPublicPlayerProjections(season);

    if (projections.length === 0) {
      logger.warn("ESPN public API returned 0 projections — nothing to upsert");
      return { synced: 0, errors: 0, startedAt, completedAt: new Date() };
    }

    // Upsert in batches — avoids hitting postgres parameter limits
    for (let i = 0; i < projections.length; i += UPSERT_BATCH_SIZE) {
      const batch = projections.slice(i, i + UPSERT_BATCH_SIZE);
      try {
        await db
          .insert(playerProjectionsTable)
          .values(
            batch.map((p) => ({
              playerId: p.playerId,
              playerName: p.playerName,
              position: p.position,
              proTeam: p.proTeam,
              rosProjection: p.rosProjection,
              weeklyProjection: p.weeklyProjection,
              auctionValue: p.auctionValue ?? null,
              lastSyncedAt: new Date(),
            })),
          )
          .onConflictDoUpdate({
            target: playerProjectionsTable.playerId,
            set: {
              playerName: sql`excluded.player_name`,
              position: sql`excluded.position`,
              proTeam: sql`excluded.pro_team`,
              rosProjection: sql`excluded.ros_projection`,
              weeklyProjection: sql`excluded.weekly_projection`,
              auctionValue: sql`excluded.auction_value`,
              lastSyncedAt: sql`excluded.last_synced_at`,
            },
          });
        synced += batch.length;
      } catch (err) {
        logger.error({ err, batchStart: i, batchSize: batch.length }, "Projection batch upsert failed");
        errors += batch.length;
      }
    }

    lastSyncAt = new Date();
    logger.info({ synced, errors }, "Player projection sync complete");
  } catch (err) {
    logger.error({ err }, "Player projection sync failed");
    throw err;
  } finally {
    isSyncing = false;
  }

  return { synced, errors, startedAt, completedAt: new Date() };
}

// ─── Weekly Thursday Scheduler (stub) ────────────────────────────────────────
//
// Fires immediately on startup if today is Thursday (and no sync has run today),
// then rechecks every 6 hours.
//
// This is a lightweight stub that requires no additional packages. To replace it
// with a production-grade scheduler:
//
//   import cron from "node-cron";
//   cron.schedule("0 9 * * 4", () => syncProjections().catch(logger.error));
//
// ─────────────────────────────────────────────────────────────────────────────

const THURSDAY = 4;               // Date.getDay(): 0=Sun … 6=Sat
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export function startProjectionSyncScheduler(): void {
  const maybeSync = async () => {
    const now = new Date();
    if (now.getDay() !== THURSDAY) return;

    const alreadySyncedToday =
      lastSyncAt !== null && lastSyncAt.toDateString() === now.toDateString();
    if (alreadySyncedToday) return;

    logger.info("Thursday projection sync scheduler: initiating weekly sync");
    try {
      await syncProjections();
    } catch (err) {
      logger.error({ err }, "Thursday projection sync scheduler: sync failed");
    }
  };

  maybeSync();
  setInterval(maybeSync, CHECK_INTERVAL_MS);

  logger.info(
    { checkInterval: "6h", firesOn: "Thursday" },
    "Projection sync scheduler started",
  );
}
