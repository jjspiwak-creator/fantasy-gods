import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import {
  db,
  usersTable,
  sessionsTable,
  savedTradesTable,
  manualLeaguesTable,
  manualTeamsTable,
  manualRosterPlayersTable,
} from "@workspace/db";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { hashPassword, signToken } from "../auth.ts";
import { deleteAccount } from "../accountDeletion.ts";
import app from "../../app.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUser(email: string, password = "testpass1234") {
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({ email: email.toLowerCase(), passwordHash, showLeagueWarnings: true })
    .returning();
  return user;
}

async function createSession(id?: string) {
  const sid = id ?? randomUUID();
  await db.insert(sessionsTable).values({
    id: sid,
    espnS2: "enc-s2",
    swid: "enc-swid",
    expiresAt: new Date(Date.now() + 86400_000),
  });
  return sid;
}

async function createLeague(creatorUserId: string) {
  const [league] = await db
    .insert(manualLeaguesTable)
    .values({
      name: "Test League",
      inviteCode: randomUUID().slice(0, 8).toUpperCase(),
      creatorUserId,
      teamCount: 2,
      rosterSlots: {},
      scoringBasics: {},
    })
    .returning();
  return league;
}

async function createTeam(leagueId: string, ownerUserId: string | null) {
  const [team] = await db
    .insert(manualTeamsTable)
    .values({ leagueId, name: "Team A", ownerUserId })
    .returning();
  return team;
}

async function createRosterPlayer(teamId: string) {
  const [player] = await db
    .insert(manualRosterPlayersTable)
    .values({ teamId, name: "Test Player", position: "QB" })
    .returning();
  return player;
}

async function createSavedTrade(opts: { userId?: string; sessionId?: string }) {
  const [trade] = await db
    .insert(savedTradesTable)
    .values({
      sessionId: opts.sessionId ?? null,
      userId: opts.userId ?? null,
      leagueId: "test-league",
      name: "Test Trade",
      result: {},
      participants: [],
    })
    .returning();
  return trade;
}

async function cleanup(userId?: string, sessionId?: string) {
  if (userId) {
    await db.delete(savedTradesTable).where(eq(savedTradesTable.userId, userId)).catch(() => {});
  }
  if (sessionId) {
    await db.delete(savedTradesTable).where(eq(savedTradesTable.sessionId, sessionId)).catch(() => {});
    await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId)).catch(() => {});
  }
  if (userId) {
    await db.delete(manualTeamsTable).where(eq(manualTeamsTable.ownerUserId, userId)).catch(() => {});
    await db.delete(usersTable).where(eq(usersTable.id, userId)).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// HTTP test server
// ---------------------------------------------------------------------------

let server: http.Server;
let baseUrl: string;

before(
  async () => {
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}/api`;
        resolve();
      });
    });
  },
  { timeout: 10_000 },
);

after(
  async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  },
  { timeout: 5_000 },
);

async function req(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let resBody: unknown;
  try {
    resBody = await res.json();
  } catch {
    resBody = null;
  }
  return { status: res.status, body: resBody };
}

// ---------------------------------------------------------------------------
// Test 1 — 401 with no token; 403 with wrong password
// ---------------------------------------------------------------------------

describe("DELETE /api/auth/account — auth guards", () => {
  it("returns 401 when no Authorization header is provided", async () => {
    const r = await req("DELETE", "/auth/account", { password: "irrelevant" });
    assert.strictEqual(r.status, 401);
  });

  it("returns 403 when a valid token is presented but the password is wrong", async () => {
    const email = `del-guard-${randomUUID().slice(0, 8)}@test.local`;
    const user = await createUser(email, "correctpassword");
    const token = signToken({ userId: user.id, email: user.email });
    try {
      const r = await req(
        "DELETE",
        "/auth/account",
        { password: "wrongpassword" },
        { Authorization: `Bearer ${token}` },
      );
      assert.strictEqual(r.status, 403);
    } finally {
      await db.delete(usersTable).where(eq(usersTable.id, user.id)).catch(() => {});
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2 — Happy path: user + saved trades gone, teams de-identified
// Team must be in a league created by someone else so it survives deletion.
// ---------------------------------------------------------------------------

describe("deleteAccount — happy path: user, trades, teams", () => {
  it("removes user row, their saved trades, and de-identifies their teams", async () => {
    const creatorEmail = `del-happy-creator-${randomUUID().slice(0, 8)}@test.local`;
    const memberEmail = `del-happy-member-${randomUUID().slice(0, 8)}@test.local`;
    const creator = await createUser(creatorEmail);
    const member = await createUser(memberEmail);
    const league = await createLeague(creator.id);
    await createTeam(league.id, creator.id);
    const memberTeam = await createTeam(league.id, member.id);
    const trade = await createSavedTrade({ userId: member.id });

    await deleteAccount(member.id, null);

    const [userRow] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, member.id));
    assert.equal(userRow, undefined, "user row should be gone");

    const [tradeRow] = await db.select({ id: savedTradesTable.id }).from(savedTradesTable).where(eq(savedTradesTable.id, trade.id));
    assert.equal(tradeRow, undefined, "saved trade should be gone");

    const [teamRow] = await db.select().from(manualTeamsTable).where(eq(manualTeamsTable.id, memberTeam.id));
    assert.ok(teamRow, "team row should still exist");
    assert.strictEqual(teamRow.ownerUserId, null, "ownerUserId should be null");
    assert.strictEqual(teamRow.ownerDeparted, true, "ownerDeparted should be true");

    // cleanup
    await db.delete(manualLeaguesTable).where(eq(manualLeaguesTable.id, league.id)).catch(() => {});
    await db.delete(usersTable).where(eq(usersTable.id, creator.id)).catch(() => {});
  });
});

// ---------------------------------------------------------------------------
// Test 3 — League with another claimed team: survives, creator_user_id = NULL
// ---------------------------------------------------------------------------

describe("deleteAccount — league with another claimed team: creator nulled, league survives", () => {
  it("sets creator_user_id to null and preserves league when another user owns a team", async () => {
    const creatorEmail = `del-creator-${randomUUID().slice(0, 8)}@test.local`;
    const memberEmail = `del-member-${randomUUID().slice(0, 8)}@test.local`;
    const creator = await createUser(creatorEmail);
    const member = await createUser(memberEmail);
    const league = await createLeague(creator.id);
    await createTeam(league.id, creator.id);
    await createTeam(league.id, member.id);

    await deleteAccount(creator.id, null);

    const [leagueRow] = await db.select().from(manualLeaguesTable).where(eq(manualLeaguesTable.id, league.id));
    assert.ok(leagueRow, "league should still exist");
    assert.strictEqual(leagueRow.creatorUserId, null, "creatorUserId should be null");

    // cleanup
    await db.delete(manualLeaguesTable).where(eq(manualLeaguesTable.id, league.id)).catch(() => {});
    await db.delete(usersTable).where(eq(usersTable.id, member.id)).catch(() => {});
  });
});

// ---------------------------------------------------------------------------
// Test 4 — League with no other claimed team: fully deleted (cascade)
// ---------------------------------------------------------------------------

describe("deleteAccount — league with no other claimed team: deleted entirely with teams and rosters", () => {
  it("deletes the league, its teams, and roster players when no other member has claimed a team", async () => {
    const email = `del-solo-${randomUUID().slice(0, 8)}@test.local`;
    const user = await createUser(email);
    const league = await createLeague(user.id);
    const team = await createTeam(league.id, user.id);
    const player = await createRosterPlayer(team.id);

    await deleteAccount(user.id, null);

    const [leagueRow] = await db.select({ id: manualLeaguesTable.id }).from(manualLeaguesTable).where(eq(manualLeaguesTable.id, league.id));
    assert.equal(leagueRow, undefined, "league should be deleted");

    const [teamRow] = await db.select({ id: manualTeamsTable.id }).from(manualTeamsTable).where(eq(manualTeamsTable.id, team.id));
    assert.equal(teamRow, undefined, "team should be deleted (cascade)");

    const [playerRow] = await db.select({ id: manualRosterPlayersTable.id }).from(manualRosterPlayersTable).where(eq(manualRosterPlayersTable.id, player.id));
    assert.equal(playerRow, undefined, "roster player should be deleted (cascade)");
  });
});

// ---------------------------------------------------------------------------
// Test 5 — Session row and session-linked saved trades are deleted
// ---------------------------------------------------------------------------

describe("deleteAccount — with sessionId: session row and session-linked trades deleted", () => {
  it("deletes the session and any saved trades linked to it when sessionId is provided", async () => {
    const email = `del-sess-${randomUUID().slice(0, 8)}@test.local`;
    const user = await createUser(email);
    const sessionId = await createSession();
    const trade = await createSavedTrade({ sessionId });

    await deleteAccount(user.id, sessionId);

    const [sessRow] = await db.select({ id: sessionsTable.id }).from(sessionsTable).where(eq(sessionsTable.id, sessionId));
    assert.equal(sessRow, undefined, "session row should be deleted");

    const [tradeRow] = await db.select({ id: savedTradesTable.id }).from(savedTradesTable).where(eq(savedTradesTable.id, trade.id));
    assert.equal(tradeRow, undefined, "session-linked saved trade should be deleted");
  });
});

// ---------------------------------------------------------------------------
// Test 6 — GET /api/auth/me with deleted user's old token returns 401
// ---------------------------------------------------------------------------

describe("GET /api/auth/me — after account deletion: returns 401", () => {
  it("returns 401 when the token is valid but the user row no longer exists", async () => {
    const email = `del-me-${randomUUID().slice(0, 8)}@test.local`;
    const user = await createUser(email);
    const token = signToken({ userId: user.id, email: user.email });

    await deleteAccount(user.id, null);

    const r = await req("GET", "/auth/me", undefined, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(r.status, 401);
  });
});
