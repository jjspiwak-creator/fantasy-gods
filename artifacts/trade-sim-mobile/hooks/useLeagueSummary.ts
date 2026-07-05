import { useQuery } from "@tanstack/react-query";

// ─── Response types (mirror artifacts/api-server/src/lib/analytics.ts) ────────

export interface PositionalGrade {
  grade: string;
  score: number;
  totalVorp: number;
  playerCount: number;
  /** Team VORP vs league average, e.g. +23.5 = 23.5 % above average. */
  vsLeagueAvgPct: number;
}

export interface TeamPositionalGrades {
  QB: PositionalGrade;
  RB: PositionalGrade;
  WR: PositionalGrade;
  TE: PositionalGrade;
}

export interface LineupSlot {
  playerId: string;
  name: string;
  position: string;
  slot: string;
  projectedPoints: number;
}

export interface TeamMetrics {
  teamId: string;
  teamName: string;
  ownerName: string;
  record: string;
  weeklyRank: number;
  rosRank: number;
  weeklyProjectedScore: number;
  rosRosterVorp: number;
  optimalLineup: LineupSlot[];
  positionalGrades: TeamPositionalGrades;
}

export interface LeagueSummary {
  leagueId: string;
  generatedAt: string;
  teamCount: number;
  replacementBaselines: Record<string, number>;
  weeklyBaselines: Record<string, number>;
  leagueAvgWeeklyScore: number;
  leagueAvgRosVorp: number;
  weeklyRankings: TeamMetrics[];
  rosRankings: TeamMetrics[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches VORP-based power rankings and positional grades for a league.
 * Calls GET /api/metrics/league-summary — result is cached for 5 minutes.
 * Both the Dashboard and Roster Matrix screens share this cache key.
 */
export function useLeagueSummary(
  sessionId: string | null,
  leagueId: string | null,
) {
  return useQuery<LeagueSummary>({
    queryKey: ["league-summary", sessionId, leagueId],
    queryFn: async () => {
      const base = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const url =
        `${base}/api/metrics/league-summary` +
        `?sessionId=${encodeURIComponent(sessionId!)}` +
        `&leagueId=${encodeURIComponent(leagueId!)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as any)?.error ?? `League summary failed (${res.status})`,
        );
      }
      return res.json() as Promise<LeagueSummary>;
    },
    enabled: !!sessionId && !!leagueId,
    staleTime: 5 * 60 * 1000,
  });
}
