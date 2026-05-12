import { Router, type IRouter } from "express";
import {
  SimulateTradeBody,
  SimulateTradeResponse,
  GetSavedTradesQueryParams,
  GetSavedTradesResponse,
  SaveTradeBody,
  DeleteSavedTradeParams,
  RefreshSavedTradeParams,
  RefreshSavedTradeQueryParams,
} from "@workspace/api-zod";
import { db, savedTradesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { simulateTrade } from "../lib/tradeSimulator";
import { fetchLeagueTeams } from "../lib/espn";
import { getSession } from "../lib/sessions";

const router: IRouter = Router();

function formatTrade(t: typeof savedTradesTable.$inferSelect) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    lastRefreshedAt: t.lastRefreshedAt.toISOString(),
  };
}

router.post("/trades/simulate", async (req, res): Promise<void> => {
  const parsed = SimulateTradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { leagueId, participants, teams } = parsed.data;

  if (participants.length < 2) {
    res.status(400).json({ error: "A trade must involve at least 2 teams." });
    return;
  }

  const participatingTeamIds = new Set(participants.map((p) => p.teamId));
  if (participatingTeamIds.size < participants.length) {
    res.status(400).json({ error: "Duplicate teams in trade." });
    return;
  }

  const hasPlayers = participants.some((p) => p.givingPlayerIds.length > 0);
  if (!hasPlayers) {
    res.status(400).json({ error: "Each trade must involve at least one player." });
    return;
  }

  try {
    const result = simulateTrade(leagueId, participants, teams as any);
    res.json(SimulateTradeResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "Trade simulation error");
    res.status(400).json({ error: "Failed to simulate trade." });
  }
});

router.get("/trades/saved", async (req, res): Promise<void> => {
  const params = GetSavedTradesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const trades = await db
    .select()
    .from(savedTradesTable)
    .where(eq(savedTradesTable.sessionId, params.data.sessionId))
    .orderBy(savedTradesTable.createdAt);

  res.json(GetSavedTradesResponse.parse(trades.map(formatTrade)));
});

router.post("/trades/saved", async (req, res): Promise<void> => {
  const parsed = SaveTradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date();
  const [saved] = await db
    .insert(savedTradesTable)
    .values({
      sessionId: parsed.data.sessionId,
      leagueId: parsed.data.leagueId,
      name: parsed.data.name,
      result: parsed.data.result as any,
      participants: parsed.data.participants as any,
      lastRefreshedAt: now,
    })
    .returning();

  res.status(201).json(formatTrade(saved));
});

router.post("/trades/saved/:tradeId/refresh", async (req, res): Promise<void> => {
  const pathParams = RefreshSavedTradeParams.safeParse(req.params);
  if (!pathParams.success) {
    res.status(400).json({ error: "Invalid trade ID" });
    return;
  }

  const queryParams = RefreshSavedTradeQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const creds = await getSession(queryParams.data.sessionId);
  if (!creds) {
    res.status(401).json({ error: "Session not found or expired. Please reconnect your ESPN account." });
    return;
  }

  const [trade] = await db
    .select()
    .from(savedTradesTable)
    .where(eq(savedTradesTable.id, pathParams.data.tradeId));

  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  try {
    const season = new Date().getFullYear();
    const teams = await fetchLeagueTeams(creds, trade.leagueId, season);

    const participants = trade.participants as Array<{ teamId: string; givingPlayerIds: string[] }>;
    const freshResult = simulateTrade(trade.leagueId, participants, teams);

    const now = new Date();
    const [updated] = await db
      .update(savedTradesTable)
      .set({ result: freshResult as any, lastRefreshedAt: now })
      .where(eq(savedTradesTable.id, trade.id))
      .returning();

    res.json(formatTrade(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to refresh trade scores");
    res.status(500).json({ error: "Failed to fetch current data from ESPN. Please try again." });
  }
});

router.delete("/trades/saved/:tradeId", async (req, res): Promise<void> => {
  const params = DeleteSavedTradeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid trade ID" });
    return;
  }

  const [deleted] = await db
    .delete(savedTradesTable)
    .where(eq(savedTradesTable.id, params.data.tradeId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
