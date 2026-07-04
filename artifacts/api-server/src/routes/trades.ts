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
import { simulateTrade, type PlayerTransfer } from "../lib/tradeSimulator";
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

  const { leagueId, transfers, teams } = parsed.data;

  if (transfers.length < 1) {
    res.status(400).json({ error: "A trade must include at least one player transfer." });
    return;
  }

  // Derive the set of participating teams from the transfer matrix
  const participatingTeamIds = new Set<string>();
  for (const t of transfers) {
    participatingTeamIds.add(t.fromTeamId);
    participatingTeamIds.add(t.toTeamId);
  }

  if (participatingTeamIds.size < 2) {
    res.status(400).json({ error: "A trade must involve at least 2 different teams." });
    return;
  }

  // Ensure no player is sent to the same team they came from
  const selfTransfer = transfers.find((t) => t.fromTeamId === t.toTeamId);
  if (selfTransfer) {
    res.status(400).json({ error: "A player cannot be traded to their own team." });
    return;
  }

  try {
    const result = simulateTrade(leagueId, transfers as PlayerTransfer[], teams as any);
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
      // Store the transfer matrix in the `participants` column (JSONB — column name is legacy)
      participants: parsed.data.transfers as any,
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

    // The participants column stores PlayerTransfer[] (explicit origin-to-destination matrix)
    const transfers = trade.participants as PlayerTransfer[];
    const freshResult = simulateTrade(trade.leagueId, transfers, teams);

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
