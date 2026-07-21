/**
 * useLiveTradeGrade — client-side mirror of the server's grading formula.
 *
 * SOURCE OF TRUTH: artifacts/api-server/src/lib/tradeSimulator.ts
 *   — calculateGrade() (exported)
 *   — roster-bucketing loop inside simulateTrade()
 *
 * MIRROR CONTRACT: any change to the grading formula in tradeSimulator.ts
 * MUST be reflected here verbatim, and vice versa.
 * Parity tests enforce agreement:
 *   artifacts/api-server/src/lib/__tests__/tradeSimulator.grades.test.ts
 *   artifacts/trade-sim/src/hooks/__tests__/useLiveTradeGrade.test.ts
 *
 * V1 LIMITATION: slot-legality runs only at the confirm-step POST
 * (POST /api/trades/simulate via the engine gate). A live grade may appear
 * on a trade the engine gate later rejects. Live legality hinting is
 * banked for a future sprint.
 *
 * RUNTIME GUARD: if any involved player's tradeValue is missing or
 * non-numeric, returns null so the badge is simply not rendered.
 */

import type { Team, PlayerTransfer } from "@workspace/api-client-react";

export interface LiveTeamGrade {
  teamId: string;
  grade: string;
  score: number;
  gradeRationale: string;
  tradeValueChange: number;
}

/** VERBATIM COPY of calculateGrade from tradeSimulator.ts. Do not alter. */
function calculateGrade(
  valueGiven: number,
  valueReceived: number,
  tradeValueChange: number,
  rosterValueBefore: number,
): { grade: string; score: number; gradeRationale: string } {
  if (valueGiven === 0 && valueReceived === 0) {
    return { grade: "C", score: 70, gradeRationale: "No players exchanged on this side." };
  }

  if (valueGiven === 0) {
    return { grade: "A+", score: 100, gradeRationale: "Receiving value without giving anything up." };
  }

  if (valueReceived === 0) {
    return { grade: "F", score: 20, gradeRationale: "Giving up value without receiving anything in return." };
  }

  const ratio = valueReceived / valueGiven;
  const rosterImpactPct = rosterValueBefore > 0 ? Math.abs(tradeValueChange) / rosterValueBefore : 0;

  let score = Math.round(50 + ratio * 25);
  score = Math.max(0, Math.min(100, score));

  if (tradeValueChange > 0 && rosterImpactPct > 0.05) {
    score = Math.min(100, score + Math.round(rosterImpactPct * 40));
  }
  if (tradeValueChange < 0 && rosterImpactPct > 0.05) {
    score = Math.max(0, score - Math.round(rosterImpactPct * 40));
  }

  const pct = Math.round((ratio - 1) * 100);
  let rationale: string;
  if (ratio >= 1.05) {
    rationale = `Receiving ${pct}% more value than giving up.`;
  } else if (ratio >= 0.95) {
    rationale = `Roughly even swap (within 5% value).`;
  } else {
    rationale = `Giving up ${Math.abs(pct)}% more value than receiving.`;
  }

  let grade: string;
  if (score >= 97) grade = "A+";
  else if (score >= 93) grade = "A";
  else if (score >= 90) grade = "A-";
  else if (score >= 87) grade = "B+";
  else if (score >= 83) grade = "B";
  else if (score >= 80) grade = "B-";
  else if (score >= 77) grade = "C+";
  else if (score >= 73) grade = "C";
  else if (score >= 70) grade = "C-";
  else if (score >= 67) grade = "D+";
  else if (score >= 63) grade = "D";
  else if (score >= 60) grade = "D-";
  else grade = "F";

  return { grade, score, gradeRationale: rationale };
}

/**
 * Pure computation hook. Takes the full teams array and the current transfer
 * list; returns per-team grade results for every team appearing in at least
 * one transfer, or null if the inputs are insufficient or any tradeValue is
 * missing/non-numeric.
 *
 * Does NOT call any React hooks internally — safe to call directly in tests
 * and safe to call from React component bodies.
 */
export function useLiveTradeGrade(
  teams: Team[] | undefined,
  transfers: PlayerTransfer[],
): LiveTeamGrade[] | null {
  if (!teams || transfers.length === 0) return null;

  const playerTradeValueByTeam: Record<string, Record<string, number>> = {};
  for (const team of teams) {
    playerTradeValueByTeam[team.id] = {};
    for (const player of team.roster) {
      if (typeof player.tradeValue !== "number" || !isFinite(player.tradeValue)) {
        return null;
      }
      playerTradeValueByTeam[team.id][player.id] = player.tradeValue;
    }
  }

  const participatingTeamIds = new Set<string>();
  for (const t of transfers) {
    participatingTeamIds.add(t.fromTeamId);
    participatingTeamIds.add(t.toTeamId);
  }

  const valGiven: Record<string, number> = {};
  const valReceived: Record<string, number> = {};
  for (const teamId of participatingTeamIds) {
    valGiven[teamId] = 0;
    valReceived[teamId] = 0;
  }

  for (const t of transfers) {
    const tv = playerTradeValueByTeam[t.fromTeamId]?.[t.playerId];
    if (tv === undefined || typeof tv !== "number" || !isFinite(tv)) return null;
    valGiven[t.fromTeamId] += tv;
    valReceived[t.toTeamId] += tv;
  }

  const teamMap: Record<string, Team> = {};
  for (const team of teams) teamMap[team.id] = team;

  const results: LiveTeamGrade[] = [];
  for (const teamId of participatingTeamIds) {
    const team = teamMap[teamId];
    if (!team) return null;

    const rosterValueBefore = team.roster.reduce((s, p) => s + p.tradeValue, 0);
    const given = valGiven[teamId] ?? 0;
    const received = valReceived[teamId] ?? 0;
    const tradeValueChange = received - given;

    const { grade, score, gradeRationale } = calculateGrade(
      given,
      received,
      tradeValueChange,
      rosterValueBefore,
    );
    results.push({ teamId, grade, score, gradeRationale, tradeValueChange });
  }

  return results;
}
