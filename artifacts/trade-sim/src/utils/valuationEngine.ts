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

// ─── Asset-Isolated Undo ──────────────────────────────────────────────────────

export interface UndoResult {
  players: Record<string, Player>;
  teams: Record<string, TeamRoster>;
  poppedFrame: PlayerHistoryFrame;
}

/**
 * Pops the top history frame from a single player's stack and restores them
 * to the slot recorded in the previous frame. Only the target player's state
 * and their owning team's rosterSlots are mutated — all other players are untouched.
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
  const previousFrame = newStack.length > 0 ? newStack[newStack.length - 1] : null;

  const restoredSlot = previousFrame?.rosterSlot ?? null;
  const restoredTeamId = previousFrame?.executedByTeamId ?? null;

  const updatedPlayer: Player = {
    ...player,
    playerHistoryStack: newStack,
    lastMovedByTeamId: restoredTeamId,
    isMostRecentMoveForTeam: previousFrame !== null,
    acquiredTimestamp: player.acquiredTimestamp,
  };

  // Remove player from all current slot positions
  const updatedTeams = { ...teams };
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

  // Re-insert into restored slot if a prior frame exists
  if (restoredTeamId && restoredSlot && updatedTeams[restoredTeamId]) {
    const restoredTeam = updatedTeams[restoredTeamId];
    const slots = { ...restoredTeam.rosterSlots };
    if (!slots[restoredSlot]) slots[restoredSlot] = [];
    slots[restoredSlot] = [...slots[restoredSlot], playerId];
    updatedTeams[restoredTeamId] = { ...restoredTeam, rosterSlots: slots };
  }

  return { players: { ...players, [playerId]: updatedPlayer }, teams: updatedTeams, poppedFrame };
}
