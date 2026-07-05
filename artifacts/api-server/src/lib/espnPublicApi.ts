/**
 * ESPN Public Player Pool API client.
 *
 * Uses the ESPN fantasy leaguedefaults endpoint which is publicly accessible —
 * no espn_s2/SWID cookies required. The `kona_player_info` view returns the
 * global player pool with projected season stats for the requested scoring type.
 *
 * Endpoint:
 *   GET https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}
 *         /segments/0/leaguedefaults/{scoringType}?view=kona_player_info
 *
 * Scoring type bucket:
 *   0 = Standard  |  1 = Half-PPR  |  3 = PPR (default)
 *
 * Stat keys used:
 *   statSourceId    0 = actual   |  1 = projected
 *   statSplitTypeId 0 = full season | 1 = rest-of-season | 5 = single scoring period
 */

import { logger } from "./logger";

const ESPN_PUBLIC_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";

const POSITION_MAP: Record<number, string> = {
  1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "D/ST",
};

const NFL_TEAM_MAP: Record<number, string> = {
  1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE",
  6: "DAL", 7: "DEN", 8: "DET", 9: "GB", 10: "TEN",
  11: "IND", 12: "KC", 13: "LV", 14: "LAR", 15: "MIA",
  16: "MIN", 17: "NE", 18: "NO", 19: "NYG", 20: "NYJ",
  21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC", 25: "SF",
  26: "SEA", 27: "TB", 28: "WSH", 29: "CAR", 30: "JAX",
  33: "BAL", 34: "HOU",
};

export interface PublicPlayerProjection {
  playerId: string;
  playerName: string;
  position: string;
  proTeam: string;
  /** Rest-of-season projected fantasy points (statSplitTypeId=1, statSourceId=1).
   *  Falls back to full-season projection if ROS is unavailable. */
  rosProjection: number;
  /** Current scoring-period projection (statSplitTypeId=5, statSourceId=1). */
  weeklyProjection: number;
  /** PPR auction value from draft rankings, if available. */
  auctionValue: number | null;
}

/**
 * Fetches the full player pool with ROS projections from ESPN's public API.
 *
 * @param season      NFL season year (defaults to current calendar year)
 * @param scoringType 0=Standard, 1=Half-PPR, 3=PPR (default)
 * @param limit       Max players to fetch per request (ESPN cap ~1500)
 */
export async function fetchPublicPlayerProjections(
  season = new Date().getFullYear(),
  scoringType: 0 | 1 | 3 = 3,
  limit = 1500,
): Promise<PublicPlayerProjection[]> {
  const filter = JSON.stringify({
    players: {
      filterSlotIds: {
        value: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
      },
      filterStatus: { value: ["FREEAGENT", "WAIVERS", "ONTEAM"] },
      filterRanksForRankTypes: { value: ["PPR"] },
      sortAppliedStatTotal: { sortAsc: false, sortPriority: 1, value: "0" },
      limit,
      offset: 0,
    },
  });

  const url =
    `${ESPN_PUBLIC_BASE}/seasons/${season}/segments/0/leaguedefaults/${scoringType}?view=kona_player_info`;

  logger.info({ url, season, scoringType, limit }, "Fetching public ESPN player projections");

  const resp = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Fantasy-Filter": filter,
    },
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(
      `ESPN public API returned ${resp.status} ${resp.statusText}. Body: ${body.slice(0, 200)}`,
    );
  }

  const data: any = await resp.json();
  const rawPlayers: any[] = data.players ?? [];

  logger.info({ count: rawPlayers.length }, "Raw players received from ESPN public API");

  const results: PublicPlayerProjection[] = [];

  for (const entry of rawPlayers) {
    const pool = entry.playerPoolEntry;
    const player = pool?.player;
    if (!player) continue;

    const playerId = String(player.id ?? entry.id ?? "");
    if (!playerId) continue;

    const playerName: string = player.fullName ?? "Unknown";
    const position = POSITION_MAP[player.defaultPositionId as number] ?? "FLEX";
    const proTeam = NFL_TEAM_MAP[player.proTeamId as number] ?? "FA";

    const stats: any[] = player.stats ?? [];

    // ROS projection: remainder-of-season projected (split=1, source=1)
    const rosStats = stats.find(
      (s: any) => s.statSplitTypeId === 1 && s.statSourceId === 1,
    );
    // Full-season projection fallback (split=0, source=1)
    const fullStats = stats.find(
      (s: any) => s.statSplitTypeId === 0 && s.statSourceId === 1 && s.scoringPeriodId === 0,
    );

    const rosProjection: number = rosStats?.appliedTotal ?? fullStats?.appliedTotal ?? 0;

    // Single-period (weekly) projection: split=5, source=1
    const weeklyStats = stats.find(
      (s: any) => s.statSplitTypeId === 5 && s.statSourceId === 1,
    );
    const weeklyProjection: number = weeklyStats?.appliedTotal ?? 0;

    // Auction value from draft rankings (PPR preferred, Standard fallback)
    const rankings = entry.draftRanksByRankType ?? {};
    const auctionValue: number | null =
      rankings.PPR?.auctionValue ?? rankings.STANDARD?.auctionValue ?? null;

    results.push({
      playerId,
      playerName,
      position,
      proTeam,
      rosProjection,
      weeklyProjection,
      auctionValue,
    });
  }

  return results;
}
