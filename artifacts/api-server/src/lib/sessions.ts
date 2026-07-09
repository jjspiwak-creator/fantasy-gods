import { EspnCredentials } from "./espn";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const stripWhitespace = (v: string) => v.replace(/\s+/g, "");

export async function createSession(creds: EspnCredentials, username?: string): Promise<string> {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessionsTable).values({
    id: sessionId,
    espnS2: stripWhitespace(creds.espnS2),
    swid: stripWhitespace(creds.swid),
    username: username || null,
    expiresAt,
  });

  return sessionId;
}

export async function getSession(sessionId: string): Promise<EspnCredentials | null> {
  try {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId));

    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
      return null;
    }

    return { espnS2: session.espnS2, swid: session.swid };
  } catch (err) {
    logger.error({ err }, "Failed to get session from DB");
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
}
