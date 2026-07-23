import { db, sessionsTable } from "@workspace/db";
import { lt } from "drizzle-orm";
import { logger } from "./logger";

export async function sweepExpiredSessions(): Promise<void> {
  try {
    await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
    logger.info("Expired sessions swept");
  } catch (err) {
    logger.error({ err }, "Failed to sweep expired sessions");
  }
}
