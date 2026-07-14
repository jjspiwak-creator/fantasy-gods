import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  db,
  manualLeaguesTable,
  manualTeamsTable,
  manualRosterPlayersTable,
} from "@workspace/db";
import { eq, and, isNull, asc, inArray } from "drizzle-orm";
import { extractToken, verifyToken } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

const INVITE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes)
    .map((b) => INVITE_CHARS[b % 32])
    .join("");
}

function requireAuth(
  req: Request,
  res: Response,
): { userId: string; email: string } | null {
  const token = extractToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "Not authenticated." });
    return null;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Token is invalid or expired. Please sign in again." });
    return null;
  }
  return payload;
}

async function isMember(leagueId: string, userId: string): Promise<boolean> {
  const [team] = await db
    .select({ id: manualTeamsTable.id })
    .from(manualTeamsTable)
    .where(
      and(
        eq(manualTeamsTable.leagueId, leagueId),
        eq(manualTeamsTable.ownerUserId, userId),
      ),
    );
  return !!team;
}

const CreateLeagueBody = z.object({
  name: z.string().min(1).max(60),
  teamCount: z.number().int().min(2).max(20),
  myTeamName: z.string().min(1).max(60).optional(),
  rosterSlots: z.record(z.unknown()),
  scoringBasics: z.record(z.unknown()),
});

const JoinLeagueBody = z.object({
  inviteCode: z.string().min(1),
  teamName: z.string().min(1).max(60).optional(),
});

const AddPlayerBody = z.object({
  name: z.string().min(1).max(60),
  position: z.string().min(1).max(10),
  isStarter: z.boolean().optional().default(false),
  realTeam: z.string().max(5).optional(),
  byeWeek: z.number().int().min(1).max(18).optional(),
});

function serializeLeague(l: typeof manualLeaguesTable.$inferSelect) {
  return {
    id: l.id,
    name: l.name,
    inviteCode: l.inviteCode,
    creatorUserId: l.creatorUserId,
    teamCount: l.teamCount,
    rosterSlots: l.rosterSlots,
    scoringBasics: l.scoringBasics,
    createdAt: l.createdAt.toISOString(),
  };
}

function serializeTeam(t: typeof manualTeamsTable.$inferSelect) {
  return {
    id: t.id,
    leagueId: t.leagueId,
    name: t.name,
    ownerUserId: t.ownerUserId,
    createdAt: t.createdAt.toISOString(),
  };
}

function serializePlayer(p: typeof manualRosterPlayersTable.$inferSelect) {
  return {
    id: p.id,
    teamId: p.teamId,
    name: p.name,
    position: p.position,
    realTeam: p.realTeam,
    byeWeek: p.byeWeek,
    isStarter: p.isStarter,
    createdAt: p.createdAt.toISOString(),
  };
}

// R1: POST /manual/leagues
router.post("/manual/leagues", async (req, res): Promise<void> => {
  const caller = requireAuth(req, res);
  if (!caller) return;

  const parsed = CreateLeagueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body." });
    return;
  }

  const { name, teamCount, myTeamName, rosterSlots, scoringBasics } = parsed.data;

  try {
    let league: typeof manualLeaguesTable.$inferSelect | undefined;
    let myTeam: typeof manualTeamsTable.$inferSelect | undefined;

    for (let attempt = 0; attempt < 5; attempt++) {
      const inviteCode = generateInviteCode();
      try {
        await db.transaction(async (tx) => {
          const [inserted] = await tx
            .insert(manualLeaguesTable)
            .values({
              name,
              inviteCode,
              creatorUserId: caller.userId,
              teamCount,
              rosterSlots,
              scoringBasics,
            })
            .returning();
          league = inserted;

          const teamValues = Array.from({ length: teamCount }, (_, i) => ({
            leagueId: inserted.id,
            name: i === 0 ? (myTeamName ?? "Team 1") : `Team ${i + 1}`,
            ownerUserId: i === 0 ? caller.userId : (null as string | null),
          }));

          const teams = await tx
            .insert(manualTeamsTable)
            .values(teamValues)
            .returning();
          myTeam = teams[0];
        });
        break;
      } catch (e: any) {
        if (e.code === "23505" && attempt < 4) continue;
        throw e;
      }
    }

    res.status(201).json({ league: serializeLeague(league!), myTeam: serializeTeam(myTeam!) });
  } catch (err) {
    logger.error({ err }, "Error creating manual league");
    res.status(500).json({ error: "Failed to create league." });
  }
});

// R2: POST /manual/leagues/join  (registered BEFORE /:leagueId routes)
router.post("/manual/leagues/join", async (req, res): Promise<void> => {
  const caller = requireAuth(req, res);
  if (!caller) return;

  const parsed = JoinLeagueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body." });
    return;
  }

  const { inviteCode, teamName } = parsed.data;

  try {
    const [league] = await db
      .select()
      .from(manualLeaguesTable)
      .where(eq(manualLeaguesTable.inviteCode, inviteCode));

    if (!league) {
      res.status(404).json({ error: "League not found." });
      return;
    }

    const [existing] = await db
      .select()
      .from(manualTeamsTable)
      .where(
        and(
          eq(manualTeamsTable.leagueId, league.id),
          eq(manualTeamsTable.ownerUserId, caller.userId),
        ),
      );

    if (existing) {
      res.status(200).json({ league: serializeLeague(league), myTeam: serializeTeam(existing) });
      return;
    }

    const [unowned] = await db
      .select()
      .from(manualTeamsTable)
      .where(
        and(
          eq(manualTeamsTable.leagueId, league.id),
          isNull(manualTeamsTable.ownerUserId),
        ),
      )
      .orderBy(asc(manualTeamsTable.createdAt), asc(manualTeamsTable.id))
      .limit(1);

    if (!unowned) {
      res.status(409).json({ error: "No available teams in this league." });
      return;
    }

    const [claimed] = await db
      .update(manualTeamsTable)
      .set({ ownerUserId: caller.userId, ...(teamName ? { name: teamName } : {}) })
      .where(eq(manualTeamsTable.id, unowned.id))
      .returning();

    res.status(200).json({ league: serializeLeague(league), myTeam: serializeTeam(claimed) });
  } catch (err) {
    logger.error({ err }, "Error joining manual league");
    res.status(500).json({ error: "Failed to join league." });
  }
});

// R3: GET /manual/leagues
router.get("/manual/leagues", async (req, res): Promise<void> => {
  const caller = requireAuth(req, res);
  if (!caller) return;

  try {
    const myTeams = await db
      .select()
      .from(manualTeamsTable)
      .where(eq(manualTeamsTable.ownerUserId, caller.userId));

    if (myTeams.length === 0) {
      res.status(200).json([]);
      return;
    }

    const leagueIds = [...new Set(myTeams.map((t) => t.leagueId))];
    const leagues = await db
      .select()
      .from(manualLeaguesTable)
      .where(inArray(manualLeaguesTable.id, leagueIds));

    const allTeamsInLeagues = await db
      .select()
      .from(manualTeamsTable)
      .where(inArray(manualTeamsTable.leagueId, leagueIds));

    const result = leagues.map((league) => {
      const myTeam = myTeams.find((t) => t.leagueId === league.id)!;
      const creatorTeam = allTeamsInLeagues.find(
        (t) => t.leagueId === league.id && t.ownerUserId === league.creatorUserId,
      );
      return {
        league: serializeLeague(league),
        myTeamId: myTeam.id,
        creatorTeamId: creatorTeam?.id ?? null,
      };
    });

    res.status(200).json(result);
  } catch (err) {
    logger.error({ err }, "Error listing manual leagues");
    res.status(500).json({ error: "Failed to list leagues." });
  }
});

// R4: GET /manual/leagues/:leagueId/teams (member-gated)
router.get("/manual/leagues/:leagueId/teams", async (req, res): Promise<void> => {
  const caller = requireAuth(req, res);
  if (!caller) return;

  const { leagueId } = req.params;

  try {
    const [league] = await db
      .select()
      .from(manualLeaguesTable)
      .where(eq(manualLeaguesTable.id, leagueId));

    if (!league) {
      res.status(404).json({ error: "League not found." });
      return;
    }

    const member = await isMember(leagueId, caller.userId);
    if (!member) {
      res.status(403).json({ error: "You are not a member of this league." });
      return;
    }

    const allTeams = await db
      .select()
      .from(manualTeamsTable)
      .where(eq(manualTeamsTable.leagueId, leagueId));

    const teamIds = allTeams.map((t) => t.id);
    const allPlayers =
      teamIds.length > 0
        ? await db
            .select()
            .from(manualRosterPlayersTable)
            .where(inArray(manualRosterPlayersTable.teamId, teamIds))
        : [];

    const result = allTeams.map((team) => {
      const teamPlayers = allPlayers.filter((p) => p.teamId === team.id);
      return {
        id: team.id,
        name: team.name,
        ownerName: team.ownerUserId ? "Claimed" : "Unowned",
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        totalTradeValue: 0,
        roster: teamPlayers.map((p) => ({
          id: p.id,
          name: p.name,
          position: p.position,
          nflTeam: p.realTeam ?? "",
          points: 0,
          projectedPoints: 0,
          tradeValue: 0,
          isStarter: p.isStarter,
          injuryStatus: null,
        })),
      };
    });

    res.status(200).json(result);
  } catch (err) {
    logger.error({ err }, "Error fetching manual league teams");
    res.status(500).json({ error: "Failed to fetch teams." });
  }
});

// R5: POST /manual/leagues/:leagueId/teams/:teamId/players (member-gated)
router.post(
  "/manual/leagues/:leagueId/teams/:teamId/players",
  async (req, res): Promise<void> => {
    const caller = requireAuth(req, res);
    if (!caller) return;

    const { leagueId, teamId } = req.params;

    const parsed = AddPlayerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body." });
      return;
    }

    try {
      const [team] = await db
        .select()
        .from(manualTeamsTable)
        .where(
          and(
            eq(manualTeamsTable.id, teamId),
            eq(manualTeamsTable.leagueId, leagueId),
          ),
        );

      if (!team) {
        res.status(404).json({ error: "Team not found in this league." });
        return;
      }

      const member = await isMember(leagueId, caller.userId);
      if (!member) {
        res.status(403).json({ error: "You are not a member of this league." });
        return;
      }

      const { name, position, isStarter, realTeam, byeWeek } = parsed.data;

      const [player] = await db
        .insert(manualRosterPlayersTable)
        .values({
          teamId,
          name,
          position: position.toUpperCase(),
          isStarter: isStarter ?? false,
          realTeam: realTeam ? realTeam.toUpperCase() : null,
          byeWeek: byeWeek ?? null,
        })
        .returning();

      res.status(201).json(serializePlayer(player));
    } catch (err) {
      logger.error({ err }, "Error adding manual player");
      res.status(500).json({ error: "Failed to add player." });
    }
  },
);

// R6: DELETE /manual/leagues/:leagueId/teams/:teamId/players/:playerId (member-gated)
router.delete(
  "/manual/leagues/:leagueId/teams/:teamId/players/:playerId",
  async (req, res): Promise<void> => {
    const caller = requireAuth(req, res);
    if (!caller) return;

    const { leagueId, teamId, playerId } = req.params;

    try {
      const [player] = await db
        .select()
        .from(manualRosterPlayersTable)
        .where(eq(manualRosterPlayersTable.id, playerId));

      if (!player || player.teamId !== teamId) {
        res.status(404).json({ error: "Player not found." });
        return;
      }

      const [team] = await db
        .select({ id: manualTeamsTable.id })
        .from(manualTeamsTable)
        .where(
          and(
            eq(manualTeamsTable.id, teamId),
            eq(manualTeamsTable.leagueId, leagueId),
          ),
        );

      if (!team) {
        res.status(404).json({ error: "Team not found in this league." });
        return;
      }

      const member = await isMember(leagueId, caller.userId);
      if (!member) {
        res.status(403).json({ error: "You are not a member of this league." });
        return;
      }

      await db
        .delete(manualRosterPlayersTable)
        .where(eq(manualRosterPlayersTable.id, playerId));

      res.status(204).send();
    } catch (err) {
      logger.error({ err }, "Error removing manual player");
      res.status(500).json({ error: "Failed to remove player." });
    }
  },
);

export default router;
