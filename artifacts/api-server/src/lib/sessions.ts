import { EspnCredentials } from "./espn";
import { randomUUID } from "crypto";

interface Session {
  espnS2: string;
  swid: string;
  username?: string;
  createdAt: number;
}

const sessions = new Map<string, Session>();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function createSession(creds: EspnCredentials, username?: string): string {
  const sessionId = randomUUID();
  sessions.set(sessionId, {
    espnS2: creds.espnS2,
    swid: creds.swid,
    username,
    createdAt: Date.now(),
  });
  return sessionId;
}

export function getSession(sessionId: string): EspnCredentials | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }
  return { espnS2: session.espnS2, swid: session.swid };
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 60 * 60 * 1000);
