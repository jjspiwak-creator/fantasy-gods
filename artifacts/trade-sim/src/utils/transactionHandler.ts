import type {
  Player,
  TeamRoster,
  LeagueSettings,
  TransactionMove,
  DropDestination,
  PlayerHistoryFrame,
} from "../types/league.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isSameCalendarDay(timestampMs: number): boolean {
  const acquired = new Date(timestampMs);
  const now = new Date();
  return (
    acquired.getFullYear() === now.getFullYear() &&
    acquired.getMonth() === now.getMonth() &&
    acquired.getDate() === now.getDate()
  );
}

// ─── Validation ──────────────────────────────────────────────────────────────

interface ValidationError {
  teamId: string;
  reason: string;
}

function validateRosterAfterMove(
  team: TeamRoster,
  settings: LeagueSettings,
): ValidationError | null {
  const totalPlayers = Object.values(team.rosterSlots).flat().length;
  const totalCap = Object.values(settings.rosterCaps).reduce((a, b) => a + b, 0);
  if (totalCap > 0 && totalPlayers > totalCap) {
    return { teamId: team.teamId, reason: `Roster cap exceeded: ${totalPlayers} > ${totalCap}` };
  }
  for (const [slot, cap] of Object.entries(settings.rosterCaps)) {
    const count = team.rosterSlots[slot]?.length ?? 0;
    if (count > cap) {
      return { teamId: team.teamId, reason: `Slot '${slot}' cap exceeded: ${count} > ${cap}` };
    }
  }
  if (settings.totalAuctionBudget !== undefined) {
    const spent = Object.values(team.financialBalances).reduce((a, b) => a + b, 0);
    if (spent > settings.totalAuctionBudget) {
      return {
        teamId: team.teamId,
        reason: `Financial ceiling breached: spent ${spent} > budget ${settings.totalAuctionBudget}`,
      };
    }
  }
  return null;
}

// ─── Core: Atomic Transaction ─────────────────────────────────────────────────

export interface TransactionResult {
  players: Record<string, Player>;
  teams: Record<string, TeamRoster>;
}

/**
 * Executes a multi-team, multi-asset transaction atomically.
 * If any validation constraint is violated, the entire batch rolls back.
 * Throws on failure — original maps are never mutated.
 */
export function executeTransaction(
  players: Record<string, Player>,
  teams: Record<string, TeamRoster>,
  settings: LeagueSettings,
  moves: TransactionMove[],
): TransactionResult {
  const draftPlayers = deepClone(players);
  const draftTeams = deepClone(teams);

  const allReleasedIds = new Set(moves.flatMap((m) => m.release));

  for (const move of moves) {
    const team = draftTeams[move.teamId];
    if (!team) throw new Error(`Team '${move.teamId}' not found`);

    const ownedIds = new Set(Object.values(team.rosterSlots).flat());
    for (const pid of move.release) {
      if (!ownedIds.has(pid)) {
        throw new Error(`Team '${move.teamId}' cannot release player '${pid}': not on roster`);
      }
      const player = draftPlayers[pid];
      if (!player) throw new Error(`Player '${pid}' not found`);
      if (player.lockStatus === "locked_for_week") {
        throw new Error(`Player '${pid}' is locked for the current week and cannot be traded`);
      }
    }

    for (const pid of move.acquire) {
      const player = draftPlayers[pid];
      if (!player) throw new Error(`Player '${pid}' not found`);
      if (player.lockStatus === "locked_for_week") {
        throw new Error(`Player '${pid}' is locked and cannot be acquired`);
      }
      const currentOwner = Object.entries(draftTeams).find(
        ([tid, t]) =>
          tid !== move.teamId && Object.values(t.rosterSlots).flat().includes(pid),
      );
      if (currentOwner && !allReleasedIds.has(pid)) {
        throw new Error(
          `Player '${pid}' is owned by team '${currentOwner[0]}' and is not being released`,
        );
      }
    }

    for (const pid of move.release) {
      for (const slot of Object.keys(team.rosterSlots)) {
        team.rosterSlots[slot] = team.rosterSlots[slot].filter((id) => id !== pid);
      }
    }

    for (const pid of move.acquire) {
      const targetSlot = move.targetSlots[pid];
      if (!targetSlot) {
        throw new Error(`No target slot specified for player '${pid}' on team '${move.teamId}'`);
      }
      if (!team.rosterSlots[targetSlot]) team.rosterSlots[targetSlot] = [];
      team.rosterSlots[targetSlot].push(pid);

      const player = draftPlayers[pid];
      const historyFrame: PlayerHistoryFrame = { rosterSlot: targetSlot, executedByTeamId: move.teamId };
      player.playerHistoryStack.push(historyFrame);
      player.lastMovedByTeamId = move.teamId;
      player.acquiredTimestamp = Date.now();
    }
  }

  const errors: ValidationError[] = [];
  for (const move of moves) {
    const team = draftTeams[move.teamId];
    const err = validateRosterAfterMove(team, settings);
    if (err) errors.push(err);
  }
  if (errors.length > 0) {
    const detail = errors.map((e) => `[${e.teamId}] ${e.reason}`).join("; ");
    throw new Error(`Transaction rolled back — constraint violations: ${detail}`);
  }

  for (const move of moves) {
    for (const pid of move.acquire) {
      const player = draftPlayers[pid];
      for (const other of Object.values(draftPlayers)) {
        if (other.id !== pid && other.lastMovedByTeamId === move.teamId) {
          other.isMostRecentMoveForTeam = false;
        }
      }
      player.isMostRecentMoveForTeam = true;
    }
  }

  return { players: draftPlayers, teams: draftTeams };
}

// ─── Drop Router ─────────────────────────────────────────────────────────────

/**
 * Routes a dropped player: FREE_AGENT if dropped same calendar day, WAIVER_COLUMN otherwise.
 */
export function routeDroppedPlayer(player: Player): DropDestination {
  if (player.acquiredTimestamp === null) return "FREE_AGENT";
  return isSameCalendarDay(player.acquiredTimestamp) ? "FREE_AGENT" : "WAIVER_COLUMN";
}

// ─── Selection Mutations ─────────────────────────────────────────────────────

/** Records an active UI cursor selection — does NOT update any move state. */
export function setPlayerSelection(
  players: Record<string, Player>,
  playerId: string,
  teamId: string,
): Record<string, Player> {
  const player = players[playerId];
  if (!player) throw new Error(`Player '${playerId}' not found`);
  return { ...players, [playerId]: { ...player, activeSelectionByTeamId: teamId } };
}

/** Clears the active cursor selection. Move-related traces remain unchanged. */
export function clearPlayerSelection(
  players: Record<string, Player>,
  playerId: string,
): Record<string, Player> {
  const player = players[playerId];
  if (!player) throw new Error(`Player '${playerId}' not found`);
  return { ...players, [playerId]: { ...player, activeSelectionByTeamId: null } };
}

/**
 * Executes a single-player move to a target slot on a team.
 * Sets isMostRecentMoveForTeam=true on this player and false on all prior moves by teamId.
 */
export function executeMoveTransaction(
  players: Record<string, Player>,
  teams: Record<string, TeamRoster>,
  playerId: string,
  targetSlot: string,
  teamId: string,
): { players: Record<string, Player>; teams: Record<string, TeamRoster> } {
  const player = players[playerId];
  if (!player) throw new Error(`Player '${playerId}' not found`);
  const team = teams[teamId];
  if (!team) throw new Error(`Team '${teamId}' not found`);

  const updatedPlayers: Record<string, Player> = {};
  for (const [pid, p] of Object.entries(players)) {
    if (pid !== playerId && p.lastMovedByTeamId === teamId) {
      updatedPlayers[pid] = { ...p, isMostRecentMoveForTeam: false };
    } else {
      updatedPlayers[pid] = p;
    }
  }

  const frame: PlayerHistoryFrame = { rosterSlot: targetSlot, executedByTeamId: teamId };
  updatedPlayers[playerId] = {
    ...player,
    activeSelectionByTeamId: null,
    lastMovedByTeamId: teamId,
    isMostRecentMoveForTeam: true,
    acquiredTimestamp: Date.now(),
    playerHistoryStack: [...player.playerHistoryStack, frame],
  };

  const updatedTeam = deepClone(team);
  for (const slot of Object.keys(updatedTeam.rosterSlots)) {
    updatedTeam.rosterSlots[slot] = updatedTeam.rosterSlots[slot].filter((id) => id !== playerId);
  }
  if (!updatedTeam.rosterSlots[targetSlot]) updatedTeam.rosterSlots[targetSlot] = [];
  updatedTeam.rosterSlots[targetSlot].push(playerId);

  return { players: updatedPlayers, teams: { ...teams, [teamId]: updatedTeam } };
}
