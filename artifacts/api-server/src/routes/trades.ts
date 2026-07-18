import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  SimulateTradeBody,
  SimulateTradeResponse,
  GetSavedTradesResponse,
  SaveTradeBody,
  DeleteSavedTradeParams,
  RefreshSavedTradeParams,
} from "@workspace/api-zod";
import { db, savedTradesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { simulateTrade, TradeRejectedError, type PlayerTransfer } from "../lib/tradeSimulator";
import { fetchLeagueTeams } from "../lib/espn";
import { getSession } from "../lib/sessions";
import { extractToken, verifyToken } from "../lib/auth";

const router: IRouter = Router();

const SessionIdHeader = z.string().min(1);

function parseSessionHeader(raw: unknown): string | null {
  const parsed = SessionIdHeader.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

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

  const { leagueId, transfers, teams, settings } = parsed.data;

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
    const result = simulateTrade(leagueId, transfers, teams, settings ?? undefined);
    res.json(SimulateTradeResponse.parse(result));
  } catch (err) {
    if (err instanceof TradeRejectedError) {
      res.status(400).json({ error: (err as TradeRejectedError).message });
    } else {
      req.log.error({ err }, "Trade simulation unexpected error");
      res.status(500).json({ error: "Internal error" });
    }
  }
});

router.get("/trades/saved", async (req, res): Promise<void> => {
  const sessionId = parseSessionHeader(req.headers["x-session-id"]);
  if (!sessionId) {
    res.status(400).json({ error: "X-Session-Id header is required" });
    return;
  }

  // If a valid JWT is provided, also return trades saved under the user account.
  const jwtPayload = verifyToken(extractToken(req.headers.authorization) ?? "");

  const trades = await db
    .select()
    .from(savedTradesTable)
    .where(
      jwtPayload
        ? or(
            eq(savedTradesTable.sessionId, sessionId),
            eq(savedTradesTable.userId, jwtPayload.userId)
          )
        : eq(savedTradesTable.sessionId, sessionId)
    )
    .orderBy(savedTradesTable.createdAt);

  res.json(GetSavedTradesResponse.parse(trades.map(formatTrade)));
});

router.post("/trades/saved", async (req, res): Promise<void> => {
  const parsed = SaveTradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const jwtPayload = verifyToken(extractToken(req.headers.authorization) ?? "");
  const now = new Date();
  const [saved] = await db
    .insert(savedTradesTable)
    .values({
      sessionId: parsed.data.sessionId,
      userId: jwtPayload?.userId ?? null,
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

  const sessionId = parseSessionHeader(req.headers["x-session-id"]);
  if (!sessionId) {
    res.status(400).json({ error: "X-Session-Id header is required" });
    return;
  }

  const creds = await getSession(sessionId);
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
