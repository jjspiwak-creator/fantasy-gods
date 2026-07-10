/**
 * League Analytics Engine — VORP-based power rankings and positional grading.
 *
 * All calculations are pure functions over EspnTeam[] — no I/O, no side effects.
 * The public entry point is computeLeagueSummary().
 *
 * Terminology:
 *   tradeValue      — ROS projected fantasy pts (synced) or heuristic (seasonPts × 1.5)
 *   projectedPoints — current-week projection (from ESPN live roster data)
 *   VORP            — Value Over Replacement Player: player value minus the
 *                     positional replacement baseline for this league
 */

import type { EspnPlayer, EspnTeam } from "./espn";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Standard dedicated starter slots per position. */
const STARTER_SLOTS: Record<string, number> = {
  QB:    1,
  RB:    2,
  WR:    2,
  TE:    1,
  K:     1,
  "D/ST": 1,
};

/** Positions that are eligible to fill the FLEX slot. */
const FLEX_POSITIONS = new Set(["RB", "WR", "TE"]);

/** Positions included in the positional grading matrix. */
const GRADED_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
type GradedPosition = (typeof GRADED_POSITIONS)[number];

/**
 * Letter-grade thresholds based on percentage deviation from league average VORP.
 * Evaluated in order — first matching entry wins.
 */
const GRADE_THRESHOLDS: Array<{ min: number; grade: string; score: number }> = [
  { min:  0.40, grade: "A+", score: 100 },
  { min:  0.25, grade: "A",  score: 95  },
  { min:  0.15, grade: "A-", score: 92  },
  { min:  0.08, grade: "B+", score: 88  },
  { min:  0.03, grade: "B",  score: 83  },
  { min: -0.03, grade: "B-", score: 80  },
  { min: -0.08, grade: "C+", score: 77  },
  { min: -0.15, grade: "C",  score: 73  },
  { min: -0.25, grade: "C-", score: 70  },
  { min: -0.35, grade: "D+", score: 67  },
  { min: -0.45, grade: "D",  score: 63  },
  { min: -0.55, grade: "D-", score: 60  },
];

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ReplacementBaselines {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  K: number;
  "D/ST": number;
  [pos: string]: number;
}

export interface LineupSlot {
  playerId: string;
  name: string;
  position: string;
  slot: string;
  projectedPoints: number;
}

export interface PositionalGrade {
  grade: string;
  score: number;
  totalVorp: number;
  playerCount: number;
  /** Team VORP vs league average as a percentage, e.g. +23.5 means 23.5% above avg. */
  vsLeagueAvgPct: number;
}

export interface TeamPositionalGrades {
  QB: PositionalGrade;
  RB: PositionalGrade;
  WR: PositionalGrade;
  TE: PositionalGrade;
}

export interface TeamMetrics {
  teamId: string;
  teamName: string;
  ownerName: string;
  record: string;
  /** Current-week power ranking (1 = best projected score this week). */
  weeklyRank: number;
  /** Rest-of-season power ranking (1 = highest cumulative roster VORP). */
  rosRank: number;
  /** Sum of optimal starting lineup projected fantasy points this week. */
  weeklyProjectedScore: number;
  /** Cumulative VORP of all players on this team's full roster (starters + bench). */
  rosRosterVorp: number;
  /** Optimal starting lineup for the current scoring period. */
  optimalLineup: LineupSlot[];
  positionalGrades: TeamPositionalGrades;
}

export interface LeagueSummary {
  leagueId: string;
  generatedAt: string;
  teamCount: number;
  /** ROS replacement baselines (tradeValue of the marginal player at each position). */
  replacementBaselines: ReplacementBaselines;
  /** Weekly projection replacement baselines (projectedPoints). */
  weeklyBaselines: ReplacementBaselines;
  leagueAvgWeeklyScore: number;
  leagueAvgRosVorp: number;
  /** Teams ordered 1→N by weeklyProjectedScore. */
  weeklyRankings: TeamMetrics[];
  /** Teams ordered 1→N by rosRosterVorp. */
  rosRankings: TeamMetrics[];
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getGradeForDeviation(deviation: number): { grade: string; score: number } {
  for (const { min, grade, score } of GRADE_THRESHOLDS) {
    if (deviation >= min) return { grade, score };
  }
  return { grade: "F", score: 40 };
}

/**
 * Compute the replacement-level value for each position.
 *
 * Strategy: pool every player across all rosters, sort descending by value,
 * then take the player at index (teamCount × starterSlots) as the replacement.
 * Example: 12-team league, 1 QB starter each → replacement QB = 13th-ranked QB
 * across all rosters (index 12).
 *
 * If there are fewer rostered players than that index (thin position group),
 * we fall back to the last available player's value.
 */
function computeReplacementBaselines(
  teams: EspnTeam[],
  teamCount: number,
  mode: "ros" | "weekly",
): ReplacementBaselines {
  const byPosition: Record<string, number[]> = {};

  for (const team of teams) {
    for (const player of team.roster) {
      const pos = player.position;
      if (!byPosition[pos]) byPosition[pos] = [];
      byPosition[pos].push(mode === "ros" ? player.tradeValue : player.projectedPoints);
    }
  }

  const baselines: Record<string, number> = {};
  for (const [pos, values] of Object.entries(byPosition)) {
    values.sort((a, b) => b - a);
    const slots = STARTER_SLOTS[pos] ?? 1;
    const idx = teamCount * slots;
    baselines[pos] = values[idx] ?? values.at(-1) ?? 0;
  }

  return baselines as ReplacementBaselines;
}

/**
 * Greedy optimal lineup builder for the current scoring period.
 *
 * Algorithm:
 *  1. Fill each dedicated slot (QB, RB×2, WR×2, TE, K, D/ST) with the highest
 *     projectedPoints player at that position.
 *  2. FLEX: best unused player from the RB/WR/TE pool.
 *
 * This greedy approach is optimal for standard lineups because position slots
 * are position-locked — there is no scenario where withholding a player from
 * a dedicated slot produces a higher total.
 */
function buildOptimalLineup(roster: EspnPlayer[]): {
  lineup: LineupSlot[];
  projectedScore: number;
} {
  const byPos: Record<string, EspnPlayer[]> = {};
  for (const p of roster) {
    if (!byPos[p.position]) byPos[p.position] = [];
    byPos[p.position].push(p);
  }
  for (const arr of Object.values(byPos)) {
    arr.sort((a, b) => b.projectedPoints - a.projectedPoints);
  }

  const used = new Set<string>();
  const lineup: LineupSlot[] = [];

  const pickN = (pos: string, n: number, slotLabel?: string) => {
    const pool = byPos[pos] ?? [];
    let picked = 0;
    for (const p of pool) {
      if (picked >= n) break;
      if (!used.has(p.id)) {
        used.add(p.id);
        lineup.push({
          playerId: p.id,
          name: p.name,
          position: p.position,
          slot: slotLabel ?? pos,
          projectedPoints: round2(p.projectedPoints),
        });
        picked++;
      }
    }
  };

  pickN("QB", 1);
  pickN("RB", 2);
  pickN("WR", 2);
  pickN("TE", 1);
  pickN("K", 1);
  pickN("D/ST", 1);

  // FLEX — best unused RB/WR/TE
  const flexPool: EspnPlayer[] = [];
  for (const pos of FLEX_POSITIONS) {
    for (const p of byPos[pos] ?? []) {
      if (!used.has(p.id)) flexPool.push(p);
    }
  }
  flexPool.sort((a, b) => b.projectedPoints - a.projectedPoints);
  if (flexPool[0]) {
    const flex = flexPool[0];
    used.add(flex.id);
    lineup.push({
      playerId: flex.id,
      name: flex.name,
      position: flex.position,
      slot: "FLEX",
      projectedPoints: round2(flex.projectedPoints),
    });
  }

  return {
    lineup,
    projectedScore: round2(lineup.reduce((s, p) => s + p.projectedPoints, 0)),
  };
}

/** Aggregate VORP per graded position for a single team's roster. */
function computeTeamPositionalVorp(
  roster: EspnPlayer[],
  rosBaselines: ReplacementBaselines,
): Record<GradedPosition, { totalVorp: number; playerCount: number }> {
  const result = Object.fromEntries(
    GRADED_POSITIONS.map((p) => [p, { totalVorp: 0, playerCount: 0 }]),
  ) as Record<GradedPosition, { totalVorp: number; playerCount: number }>;

  for (const player of roster) {
    const pos = player.position as GradedPosition;
    if (!GRADED_POSITIONS.includes(pos)) continue;
    const baseline = rosBaselines[pos] ?? 0;
    result[pos].totalVorp += player.tradeValue - baseline;
    result[pos].playerCount++;
  }

  for (const pos of GRADED_POSITIONS) {
    result[pos].totalVorp = round2(result[pos].totalVorp);
  }

  return result;
}

/** League-wide average positional VORP across all teams. */
function computeLeaguePositionalAverages(
  teamVorps: Record<GradedPosition, { totalVorp: number; playerCount: number }>[],
): Record<GradedPosition, number> {
  return Object.fromEntries(
    GRADED_POSITIONS.map((pos) => {
      const total = teamVorps.reduce((s, t) => s + t[pos].totalVorp, 0);
      return [pos, round2(total / teamVorps.length)];
    }),
  ) as Record<GradedPosition, number>;
}

/** Build a PositionalGrade by comparing a team's VORP to the league average. */
function buildPositionalGrade(
  teamVorp: { totalVorp: number; playerCount: number },
  leagueAvg: number,
): PositionalGrade {
  const deviation =
    leagueAvg !== 0
      ? (teamVorp.totalVorp - leagueAvg) / Math.abs(leagueAvg)
      : 0;
  const { grade, score } = getGradeForDeviation(deviation);
  return {
    grade,
    score,
    totalVorp: teamVorp.totalVorp,
    playerCount: teamVorp.playerCount,
    vsLeagueAvgPct: round2(deviation * 100),
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Compute the full league analytics summary from an array of EspnTeam objects.
 *
 * Steps:
 *  1. Derive replacement baselines (ROS + weekly) from the pooled player population.
 *  2. Build each team's optimal weekly lineup and sum projected scores.
 *  3. Sum full-roster VORP for ROS power rankings.
 *  4. Compute league-average positional VORP for the grading reference point.
 *  5. Grade each team's QB/RB/WR/TE groups vs that reference.
 *  6. Assign weekly and ROS ranks.
 */
export function computeLeagueSummary(
  leagueId: string,
  teams: EspnTeam[],
): LeagueSummary {
  if (teams.length === 0) throw new Error("computeLeagueSummary: no teams provided");

  const teamCount = teams.length;
  const rosBaselines = computeReplacementBaselines(teams, teamCount, "ros");
  const weeklyBaselines = computeReplacementBaselines(teams, teamCount, "weekly");

  // ── Per-team pre-metrics (no ranks or grades yet) ──────────────────────────
  const preMetrics = teams.map((team) => {
    const { lineup, projectedScore } = buildOptimalLineup(team.roster);
    const posVorpRaw = computeTeamPositionalVorp(team.roster, rosBaselines);

    const rosRosterVorp = round2(
      team.roster.reduce(
        (s, p) => s + (p.tradeValue - (rosBaselines[p.position] ?? 0)),
        0,
      ),
    );

    const record =
      team.ties > 0
        ? `${team.wins}-${team.losses}-${team.ties}`
        : `${team.wins}-${team.losses}`;

    return {
      teamId: team.id,
      teamName: team.name,
      ownerName: team.ownerName,
      record,
      weeklyProjectedScore: projectedScore,
      rosRosterVorp,
      optimalLineup: lineup,
      posVorpRaw,
    };
  });

  // ── League-wide positional averages ────────────────────────────────────────
  const leaguePosAvg = computeLeaguePositionalAverages(
    preMetrics.map((m) => m.posVorpRaw),
  );

  // ── Build full TeamMetrics with positional grades (ranks = 0, set below) ──
  const unranked: (Omit<TeamMetrics, "weeklyRank" | "rosRank">)[] = preMetrics.map((m) => {
    const positionalGrades = Object.fromEntries(
      GRADED_POSITIONS.map((pos) => [
        pos,
        buildPositionalGrade(m.posVorpRaw[pos], leaguePosAvg[pos]),
      ]),
    ) as unknown as TeamPositionalGrades;

    return {
      teamId: m.teamId,
      teamName: m.teamName,
      ownerName: m.ownerName,
      record: m.record,
      weeklyProjectedScore: m.weeklyProjectedScore,
      rosRosterVorp: m.rosRosterVorp,
      optimalLineup: m.optimalLineup,
      positionalGrades,
    };
  });

  // ── Assign ranks ───────────────────────────────────────────────────────────
  const weeklyOrder = [...unranked].sort(
    (a, b) => b.weeklyProjectedScore - a.weeklyProjectedScore,
  );
  const rosOrder = [...unranked].sort(
    (a, b) => b.rosRosterVorp - a.rosRosterVorp,
  );

  const weeklyRankOf = new Map(weeklyOrder.map((t, i) => [t.teamId, i + 1]));
  const rosRankOf = new Map(rosOrder.map((t, i) => [t.teamId, i + 1]));

  const ranked: TeamMetrics[] = unranked.map((m) => ({
    ...m,
    weeklyRank: weeklyRankOf.get(m.teamId)!,
    rosRank: rosRankOf.get(m.teamId)!,
  }));

  // ── League averages ────────────────────────────────────────────────────────
  const leagueAvgWeeklyScore = round2(
    ranked.reduce((s, t) => s + t.weeklyProjectedScore, 0) / ranked.length,
  );
  const leagueAvgRosVorp = round2(
    ranked.reduce((s, t) => s + t.rosRosterVorp, 0) / ranked.length,
  );

  return {
    leagueId,
    generatedAt: new Date().toISOString(),
    teamCount,
    replacementBaselines: rosBaselines,
    weeklyBaselines,
    leagueAvgWeeklyScore,
    leagueAvgRosVorp,
    weeklyRankings: [...ranked].sort((a, b) => a.weeklyRank - b.weeklyRank),
    rosRankings: [...ranked].sort((a, b) => a.rosRank - b.rosRank),
  };
}
