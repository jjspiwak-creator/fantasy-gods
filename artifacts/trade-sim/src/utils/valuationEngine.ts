import type { Player, LeagueSettings, PlayerHistoryFrame, TeamRoster } from "../types/league.ts";

const SEASON_END_WEEK = 17;

// ─── ROS Valuation ────────────────────────────────────────────────────────────

/**
 * Computes Rest-of-Season fantasy value for a player from `currentWeek` onward.
 *
 * Steps:
 *  1. Enumerate remaining weeks (currentWeek → SEASON_END_WEEK), excluding bye.
 *  2. Deduct suspension weeks from the available window.
 *  3. Score each week by multiplying stat projections against flat scoring rule values
 *     (nested rule objects are skipped — callers should pre-flatten complex tiers).
 *  4. Discount by injuryRiskMultiplier (0–1; 1 = healthy).
 *  5. Apply teamProe as a percentage uplift (e.g. 0.05 = +5%).
 */
export function computeRosValue(
  player: Player,
  settings: LeagueSettings,
  currentWeek: number,
): number {
  const remainingWeeks = Array.from(
    { length: Math.max(0, SEASON_END_WEEK - currentWeek + 1) },
    (_, i) => currentWeek + i,
  ).filter((w) => w !== player.byeWeek);

  const availableWeeks = Math.max(0, remainingWeeks.length - player.riskProfile.suspensionWeeks);

  let totalPoints = 0;
  for (let i = 0; i < availableWeeks; i++) {
    const week = remainingWeeks[i];
    const weekProjections = player.weeklyProjections[week] ?? {};
    let weekPoints = 0;
    for (const [statKey, ruleValue] of Object.entries(settings.scoringRules)) {
      if (typeof ruleValue !== "number") continue;
      const statValue = (weekProjections as Record<string, number>)[statKey] ?? 0;
      weekPoints += statValue * ruleValue;
    }
    totalPoints += weekPoints;
  }

  const riskAdjusted = totalPoints * player.riskProfile.injuryRiskMultiplier;
  const schemeAdjusted = riskAdjusted * (1 + player.schemeModifiers.teamProe);
  return Math.max(0, schemeAdjusted);
}

// ─── Most-Recent Flag Recomputation ──────────────────────────────────────────

/**
 * Recomputes isMostRecentMoveForTeam across all players for a given teamId.
 *
 * Rules:
 *  - Candidates: all players whose lastMovedByTeamId === teamId.
 *  - Most recent: the candidate whose top history frame has the largest movedAt value.
 *  - Exactly one (or zero, if no candidates) player is flagged true per team.
 *
 * Returns a new players map with flags updated; original map is not mutated.
 */
export function recomputeMostRecentFlags(
  players: Record<string, Player>,
  teamId: string,
): Record<string, Player> {
  let latestMovedAt = -1;
  let latestPlayerId: string | null = null;

  for (const [pid, p] of Object.entries(players)) {
    if (p.lastMovedByTeamId !== teamId) continue;
    const topFrame = p.playerHistoryStack.at(-1);
    if (topFrame && topFrame.origin.movedAt > latestMovedAt) {
      latestMovedAt = topFrame.origin.movedAt;
      latestPlayerId = pid;
    }
  }

  const updated: Record<string, Player> = { ...players };
  for (const [pid, p] of Object.entries(players)) {
    if (p.lastMovedByTeamId !== teamId) continue;
    updated[pid] = { ...p, isMostRecentMoveForTeam: pid === latestPlayerId };
  }
  return updated;
}

// ─── Asset-Isolated Undo ──────────────────────────────────────────────────────

export interface UndoResult {
  players: Record<string, Player>;
  teams: Record<string, TeamRoster>;
  poppedFrame: PlayerHistoryFrame;
}

/**
 * Pops the top history frame from a single player's stack and restores them
 * to the location recorded in that frame's origin fields.
 *
 * - Restores originTeamId / originSlot from the popped frame's origin.
 * - Restores priorAcquiredTimestamp from the popped frame's origin.
 * - Does not hard-set isMostRecentMoveForTeam; calls recomputeMostRecentFlags
 *   instead so flags remain consistent across all players for the affected team(s).
 *
 * Throws if the player has no history or does not exist.
 */
export function undoLastPlayerMove(
  playerId: string,
  players: Record<string, Player>,
  teams: Record<string, TeamRoster>,
): UndoResult {
  const player = players[playerId];
  if (!player) throw new Error(`Player '${playerId}' not found`);
  if (player.playerHistoryStack.length === 0) {
    throw new Error(`Player '${playerId}' has no move history to undo`);
  }

  const newStack = [...player.playerHistoryStack];
  const poppedFrame = newStack.pop()!;

  // Restore placement from the popped frame's origin.
  const { originTeamId, originSlot, priorAcquiredTimestamp } = poppedFrame.origin;

  // Derive lastMovedByTeamId from the new top frame (null if stack is now empty).
  const newTopFrame = newStack.length > 0 ? newStack[newStack.length - 1] : null;
  const restoredLastMovedByTeamId = newTopFrame?.executedByTeamId ?? null;

  const updatedPlayer: Player = {
    ...player,
    playerHistoryStack: newStack,
    lastMovedByTeamId: restoredLastMovedByTeamId,
    acquiredTimestamp: priorAcquiredTimestamp,
    isMostRecentMoveForTeam: false,
  };

  // Remove player from all current slot positions across all teams.
  const updatedTeams: Record<string, TeamRoster> = { ...teams };
  for (const [tid, team] of Object.entries(updatedTeams)) {
    const hasPlayer = Object.values(team.rosterSlots).flat().includes(playerId);
    if (hasPlayer) {
      const updatedSlots: Record<string, string[]> = {};
      for (const [slot, ids] of Object.entries(team.rosterSlots)) {
        updatedSlots[slot] = ids.filter((id) => id !== playerId);
      }
      updatedTeams[tid] = { ...team, rosterSlots: updatedSlots };
    }
  }

  // Re-insert into the restored slot if origin was on a team.
  if (originTeamId && originSlot && updatedTeams[originTeamId]) {
    const restoredTeam = updatedTeams[originTeamId];
    const slots = { ...restoredTeam.rosterSlots };
    if (!slots[originSlot]) slots[originSlot] = [];
    slots[originSlot] = [...slots[originSlot], playerId];
    updatedTeams[originTeamId] = { ...restoredTeam, rosterSlots: slots };
  }

  // Recompute most-recent flags for every affected team.
  const teamIdsToRecompute = new Set<string>();
  teamIdsToRecompute.add(poppedFrame.executedByTeamId);
  if (newTopFrame) teamIdsToRecompute.add(newTopFrame.executedByTeamId);

  let finalPlayers: Record<string, Player> = { ...players, [playerId]: updatedPlayer };
  for (const tid of teamIdsToRecompute) {
    finalPlayers = recomputeMostRecentFlags(finalPlayers, tid);
  }

  return { players: finalPlayers, teams: updatedTeams, poppedFrame };
}
