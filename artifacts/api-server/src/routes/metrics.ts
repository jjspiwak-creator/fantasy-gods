/**
 * GET /api/metrics/league-summary
 *
 * Returns VORP-based power rankings and positional grades for a league.
 *
 * Headers:
 *   X-Session-Id  string (required) — ESPN session cookie ID
 *
 * Query params:
 *   leagueId   string (required) — ESPN fantasy league ID
 *   season     number (optional) — defaults to current calendar year
 *
 * The endpoint re-uses the same fetchLeagueTeams() call as the trade simulator,
 * which automatically blends synced ROS projections (from player_projections table)
 * with the heuristic fallback, so the analytics engine always operates on the
 * best available player values.
 */

import { Router } from "express";
import { z } from "zod";
import { fetchLeagueTeams } from "../lib/espn";
import { getSession } from "../lib/sessions";
import { computeLeagueSummary } from "../lib/analytics";
import { logger } from "../lib/logger";

const router = Router();

const QuerySchema = z.object({
  leagueId:  z.string().min(1, "leagueId is required"),
  season:    z.string().regex(/^\d{4}$/).optional(),
});

router.get("/metrics/league-summary", async (req, res): Promise<void> => {
  const rawSessionId = req.headers["x-session-id"];
  const sessionParsed = z.string().min(1).safeParse(rawSessionId);
  if (!sessionParsed.success) {
    res.status(400).json({ error: "X-Session-Id header is required" });
    return;
  }
  const sessionId = sessionParsed.data;

  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Invalid query parameters.",
    });
    return;
  }

  const { leagueId, season: seasonStr } = parsed.data;
  const season = seasonStr ? parseInt(seasonStr, 10) : new Date().getFullYear();

  const creds = await getSession(sessionId);
  if (!creds) {
    res.status(401).json({
      error: "Session not found or expired. Please reconnect your ESPN account.",
    });
    return;
  }

  try {
    const teams = await fetchLeagueTeams(creds, leagueId, season);

    if (teams.length === 0) {
      res.status(404).json({
        error: "No teams found for this league. Verify the league ID and season.",
      });
      return;
    }

    const summary = computeLeagueSummary(leagueId, teams);
    res.json(summary);
  } catch (err: any) {
    logger.error({ err, leagueId, season }, "Failed to compute league summary");
    res.status(500).json({
      error: err?.message ?? "Failed to compute league summary. Check server logs.",
    });
  }
});

export default router;
