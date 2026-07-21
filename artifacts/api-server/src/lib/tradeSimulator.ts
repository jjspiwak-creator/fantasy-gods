import type {
  Team as ApiTeam,
  LeagueSettings as ApiLeagueSettings,
  Player as ApiPlayer,
} from "@workspace/api-zod";
import { buildEngineState, executeTransaction } from "@workspace/engine";
import { buildTransactionMoves, SlotResolveError } from "./slotResolver";

export interface PlayerTransfer {
  playerId: string;
  fromTeamId: string;
  toTeamId: string;
}

export interface RosterOverflow {
  /** How many players this team must drop to reach a legal roster size. */
  excess: number;
}

export interface TeamTradeResult {
  teamId: string;
  teamName: string;
  ownerName: string;
  playersGiven: ApiPlayer[];
  playersReceived: ApiPlayer[];
  rosterBefore: ApiPlayer[];
  rosterAfter: ApiPlayer[];
  tradeValueBefore: number;
  tradeValueAfter: number;
  tradeValueChange: number;
  verdict: string;
  grade: string;
  score: number;
  gradeRationale: string;
  /** Only present when rosterAfter exceeds the team's pre-trade roster size. */
  rosterOverflow?: RosterOverflow;
}

export interface TradeSimulationResult {
  leagueId: string;
  teamResults: TeamTradeResult[];
  overallBalance: number;
  summary: string;
  /** True when at least one team's post-trade roster exceeds their pre-trade size. */
  hasRosterOverflow: boolean;
  /**
   * Human-readable descriptions of league rule violations produced by this trade.
   * The frontend shows a soft warning banner when this array is non-empty.
   */
  leagueWarnings: string[];
}

/**
 * Thrown when the engine or slot resolver rejects a trade.
 * Route catches this and responds HTTP 400 with the error message.
 * All other errors are treated as unexpected and produce HTTP 500.
 */
export class TradeRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TradeRejectedError";
  }
}

/**
 * MIRROR CONTRACT — source of truth for the live grading formula.
 * Any change to this function MUST be reflected verbatim in:
 *   artifacts/trade-sim/src/hooks/useLiveTradeGrade.ts
 * Parity tests enforce agreement:
 *   artifacts/api-server/src/lib/__tests__/tradeSimulator.grades.test.ts
 *   artifacts/trade-sim/src/hooks/__tests__/useLiveTradeGrade.test.ts
 */
export function calculateGrade(
  valueGiven: number,
  valueReceived: number,
  tradeValueChange: number,
  rosterValueBefore: number
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
 * Simulate a multi-team trade using an explicit origin-to-destination matrix.
 *
 * Each `PlayerTransfer` specifies exactly one player movement: which player moves,
 * which team it leaves, and which team it arrives at. This supports any trade
 * topology — A↔B, A→B + B→C + C→A, A→B + C→B, etc. — without assuming a
 * fixed circular chain.
 *
 * Engine gate: runs before the legacy value calculation.
 * If the engine or slot resolver rejects the trade, throws `TradeRejectedError`.
 *
 * Participating teams are derived automatically from the union of all
 * `fromTeamId` and `toTeamId` values in the transfer list.
 */
export function simulateTrade(
  leagueId: string,
  transfers: PlayerTransfer[],
  teams: ApiTeam[],
  settings?: ApiLeagueSettings,
): TradeSimulationResult {
  // Build team and player lookup maps for the legacy calc
  const teamMap: Record<string, ApiTeam> = {};
  const playerByTeam: Record<string, Record<string, ApiPlayer>> = {};

  for (const team of teams) {
    teamMap[team.id] = team;
    playerByTeam[team.id] = {};
    for (const player of team.roster) {
      playerByTeam[team.id][player.id] = player;
    }
  }

  // Step 5a: reject unknown players — never skip silently
  for (const transfer of transfers) {
    const player = playerByTeam[transfer.fromTeamId]?.[transfer.playerId];
    if (!player) {
      throw new TradeRejectedError(
        `Unknown player '${transfer.playerId}' on team '${transfer.fromTeamId}'`,
      );
    }
  }

  // Engine gate: hydrate, resolve slots, execute atomic transaction.
  // Any rejection from the engine or slot resolver becomes a TradeRejectedError (→ HTTP 400).
  // Anything else re-throws as-is (→ HTTP 500 in the route).
  try {
    const { players: enginePlayers, teams: engineTeams, settings: engineSettings } =
      buildEngineState(leagueId, teams as ApiTeam[], settings);

    const moves = buildTransactionMoves(
      transfers,
      enginePlayers,
      engineTeams,
      engineSettings,
    );

    executeTransaction(enginePlayers, engineTeams, engineSettings, moves);
  } catch (err) {
    if (err instanceof SlotResolveError || err instanceof Error) {
      throw new TradeRejectedError((err as Error).message);
    }
    throw err;
  }

  // Derive the full set of participating team IDs from the transfer matrix
  const participatingTeamIds = new Set<string>();
  for (const t of transfers) {
    participatingTeamIds.add(t.fromTeamId);
    participatingTeamIds.add(t.toTeamId);
  }

  // Initialize per-team given/received buckets
  const playersGivenByTeam: Record<string, ApiPlayer[]> = {};
  const playersReceivedByTeam: Record<string, ApiPlayer[]> = {};
  for (const teamId of participatingTeamIds) {
    playersGivenByTeam[teamId] = [];
    playersReceivedByTeam[teamId] = [];
  }

  // Resolve each transfer: look up the player on the giving team's original roster
  for (const transfer of transfers) {
    const player = playerByTeam[transfer.fromTeamId]?.[transfer.playerId];
    // Unknown players already rejected above; this branch is unreachable.
    if (!player) throw new TradeRejectedError(`Unknown player '${transfer.playerId}'`);
    playersGivenByTeam[transfer.fromTeamId].push(player);
    playersReceivedByTeam[transfer.toTeamId].push(player);
  }

  // Compute per-team results
  const teamResults: TeamTradeResult[] = [];

  for (const teamId of participatingTeamIds) {
    const team = teamMap[teamId];
    if (!team) continue;

    const rosterBefore = [...team.roster];
    const given = playersGivenByTeam[teamId] ?? [];
    const received = playersReceivedByTeam[teamId] ?? [];
    const givenIds = new Set(given.map((p) => p.id));

    const rosterAfter = [
      ...rosterBefore.filter((p) => !givenIds.has(p.id)),
      ...received,
    ];

    const tradeValueBefore = rosterBefore.reduce((s, p) => s + p.tradeValue, 0);
    const tradeValueAfter = rosterAfter.reduce((s, p) => s + p.tradeValue, 0);
    const tradeValueChange = tradeValueAfter - tradeValueBefore;

    const valueGiven = given.reduce((s, p) => s + p.tradeValue, 0);
    const valueReceived = received.reduce((s, p) => s + p.tradeValue, 0);

    let verdict = "neutral";
    if (tradeValueChange > 5) verdict = "win";
    else if (tradeValueChange < -5) verdict = "loss";

    const { grade, score, gradeRationale } = calculateGrade(
      valueGiven,
      valueReceived,
      tradeValueChange,
      tradeValueBefore
    );

    // Roster overflow: team receives more players than they gave up, exceeding
    // their pre-trade roster size (assumed to be at/near the league maximum).
    // Guard: if a team had zero players before (edge case), suppress false overflow.
    const excess =
      rosterBefore.length === 0 ? 0 : Math.max(0, rosterAfter.length - rosterBefore.length);
    const rosterOverflow: RosterOverflow | undefined =
      excess > 0 ? { excess } : undefined;

    teamResults.push({
      teamId,
      teamName: team.name,
      ownerName: team.ownerName,
      playersGiven: given,
      playersReceived: received,
      rosterBefore,
      rosterAfter,
      tradeValueBefore,
      tradeValueAfter,
      tradeValueChange,
      verdict,
      grade,
      score,
      gradeRationale,
      rosterOverflow,
    });
  }

  const overallBalance = teamResults.reduce((s, r) => s + r.tradeValueChange, 0);
  const hasRosterOverflow = teamResults.some((r) => r.rosterOverflow !== undefined);

  const winners = teamResults.filter((r) => r.verdict === "win").map((r) => r.teamName);
  const losers = teamResults.filter((r) => r.verdict === "loss").map((r) => r.teamName);

  let summary = "";
  if (winners.length > 0 && losers.length > 0) {
    summary = `${winners.join(", ")} ${winners.length === 1 ? "wins" : "win"} this trade. ${losers.join(", ")} ${losers.length === 1 ? "loses" : "lose"}.`;
  } else if (winners.length === 0 && losers.length === 0) {
    summary = "This trade is roughly even for all teams involved.";
  } else {
    summary = "Mixed results — check individual team breakdowns.";
  }

  // Build human-readable league warning messages from any overflow detected
  const leagueWarnings: string[] = teamResults
    .filter((r) => r.rosterOverflow)
    .map(
      (r) =>
        `${r.teamName} will have ${r.rosterOverflow!.excess} extra player${
          r.rosterOverflow!.excess > 1 ? "s" : ""
        } above their roster limit — ${r.rosterOverflow!.excess} drop${
          r.rosterOverflow!.excess > 1 ? "s" : ""
        } required before this trade can be processed.`
    );

  return { leagueId, teamResults, overallBalance, summary, hasRosterOverflow, leagueWarnings };
}
