import type {
  Player,
  TeamRoster,
  LeagueSettings,
  TransactionMove,
  DropDestination,
  PlayerHistoryFrame,
} from "../types/league.ts";
import { recomputeMostRecentFlags } from "./valuationEngine.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Returns true when both timestamps fall on the same calendar day in the given
 * IANA timezone. Uses Intl.DateTimeFormat — never machine-local time.
 */
function isSameCalendarDay(
  timestampMs: number,
  now: number = Date.now(),
  timezone = "America/New_York",
): boolean {
  const fmt = (ms: number): string =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  return fmt(timestampMs) === fmt(now);
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

/**
 * Checks whether a player is eligible for a given slot under slotEligibility rules.
 * Returns a ValidationError if ineligible, null if eligible or no rules defined.
 */
function validatePositionLegality(
  player: Player,
  slot: string,
  teamId: string,
  settings: LeagueSettings,
): ValidationError | null {
  if (!settings.slotEligibility) return null;
  const allowedPositions = settings.slotEligibility[slot];
  if (!allowedPositions) return null;
  const hasOverlap = player.eligiblePositions.some((pos) => allowedPositions.includes(pos));
  if (!hasOverlap) {
    return {
      teamId,
      reason: `Player '${player.id}' (${player.eligiblePositions.join(",")}) is ineligible for slot '${slot}'`,
    };
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

  const now = Date.now();
  const allReleasedIds = new Set(moves.flatMap((m) => m.release));

  // Pre-compute origin info for every acquired player before any mutations.
  const originMap: Record<
    string,
    { originTeamId: string | null; originSlot: string | null; priorAcquiredTimestamp: number | null }
  > = {};
  for (const move of moves) {
    for (const pid of move.acquire) {
      let originTeamId: string | null = null;
      let originSlot: string | null = null;
      outer: for (const [tid, team] of Object.entries(draftTeams)) {
        for (const [slot, ids] of Object.entries(team.rosterSlots)) {
          if (ids.includes(pid)) {
            originTeamId = tid;
            originSlot = slot;
            break outer;
          }
        }
      }
      originMap[pid] = {
        originTeamId,
        originSlot,
        priorAcquiredTimestamp: draftPlayers[pid]?.acquiredTimestamp ?? null,
      };
    }
  }

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
      const targetSlot = move.targetSlots[pid];
      if (!targetSlot) {
        throw new Error(`No target slot specified for player '${pid}' on team '${move.teamId}'`);
      }
      const posErr = validatePositionLegality(player, targetSlot, move.teamId, settings);
      if (posErr) {
        throw new Error(`Transaction rolled back — constraint violations: [${posErr.teamId}] ${posErr.reason}`);
      }
    }

    for (const pid of move.release) {
      for (const slot of Object.keys(team.rosterSlots)) {
        team.rosterSlots[slot] = team.rosterSlots[slot].filter((id) => id !== pid);
      }
    }

    for (const pid of move.acquire) {
      const targetSlot = move.targetSlots[pid];
      if (!team.rosterSlots[targetSlot]) team.rosterSlots[targetSlot] = [];
      team.rosterSlots[targetSlot].push(pid);

      const player = draftPlayers[pid];
      const origin = originMap[pid];
      const historyFrame: PlayerHistoryFrame = {
        rosterSlot: targetSlot,
        executedByTeamId: move.teamId,
        origin: {
          originTeamId: origin.originTeamId,
          originSlot: origin.originSlot,
          priorAcquiredTimestamp: origin.priorAcquiredTimestamp,
          movedAt: now,
        },
      };
      player.playerHistoryStack.push(historyFrame);
      player.lastMovedByTeamId = move.teamId;
      player.acquiredTimestamp = now;
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

  // Recompute most-recent flags for every team that acquired a player.
  const teamsWithAcquisitions = new Set(moves.flatMap((m) => (m.acquire.length > 0 ? [m.teamId] : [])));
  let finalPlayers = draftPlayers;
  for (const teamId of teamsWithAcquisitions) {
    finalPlayers = recomputeMostRecentFlags(finalPlayers, teamId);
  }

  return { players: finalPlayers, teams: draftTeams };
}

// ─── Drop Router ─────────────────────────────────────────────────────────────

/**
 * Routes a dropped player: FREE_AGENT if dropped same calendar day as acquired,
 * WAIVER_COLUMN otherwise.
 *
 * @param now    Injected current timestamp (ms). Defaults to Date.now().
 * @param timezone IANA timezone for calendar-day comparison. Defaults to 'America/New_York'.
 */
export function routeDroppedPlayer(
  player: Player,
  now: number = Date.now(),
  timezone = "America/New_York",
): DropDestination {
  if (player.acquiredTimestamp === null) return "FREE_AGENT";
  return isSameCalendarDay(player.acquiredTimestamp, now, timezone)
    ? "FREE_AGENT"
    : "WAIVER_COLUMN";
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
 *
 * - Removes the player from ALL teams' rosterSlots before re-inserting.
 * - Preserves acquiredTimestamp when the player was already on the target team
 *   (slot shuffles must not reset the waiver clock).
 * - Stamps a new acquiredTimestamp only on genuine cross-team acquisitions.
 * - Validates position legality (slotEligibility) and roster caps when settings
 *   is provided. Throws on violation with no mutation applied.
 */
export function executeMoveTransaction(
  players: Record<string, Player>,
  teams: Record<string, TeamRoster>,
  playerId: string,
  targetSlot: string,
  teamId: string,
  settings?: LeagueSettings,
): { players: Record<string, Player>; teams: Record<string, TeamRoster> } {
  const player = players[playerId];
  if (!player) throw new Error(`Player '${playerId}' not found`);
  const team = teams[teamId];
  if (!team) throw new Error(`Team '${teamId}' not found`);

  const now = Date.now();

  // Validate position legality before any mutation.
  if (settings) {
    const posErr = validatePositionLegality(player, targetSlot, teamId, settings);
    if (posErr) {
      throw new Error(`Move rejected — constraint violation: [${posErr.teamId}] ${posErr.reason}`);
    }
  }

  // Find player's current location across ALL teams.
  let originTeamId: string | null = null;
  let originSlot: string | null = null;
  for (const [tid, t] of Object.entries(teams)) {
    for (const [slot, ids] of Object.entries(t.rosterSlots)) {
      if (ids.includes(playerId)) {
        originTeamId = tid;
        originSlot = slot;
        break;
      }
    }
    if (originTeamId) break;
  }

  const priorAcquiredTimestamp = player.acquiredTimestamp;

  // Preserve acquiredTimestamp for slot shuffles (player already on the target team).
  const isSlotShuffle = originTeamId === teamId;
  const newAcquiredTimestamp = isSlotShuffle ? priorAcquiredTimestamp : now;

  const frame: PlayerHistoryFrame = {
    rosterSlot: targetSlot,
    executedByTeamId: teamId,
    origin: {
      originTeamId,
      originSlot,
      priorAcquiredTimestamp,
      movedAt: now,
    },
  };

  // Apply to deep-cloned teams — remove from ALL teams first.
  const updatedTeams: Record<string, TeamRoster> = {};
  for (const [tid, t] of Object.entries(teams)) {
    const hasPlayer = Object.values(t.rosterSlots).flat().includes(playerId);
    if (hasPlayer) {
      const slots: Record<string, string[]> = {};
      for (const [slot, ids] of Object.entries(t.rosterSlots)) {
        slots[slot] = ids.filter((id) => id !== playerId);
      }
      updatedTeams[tid] = { ...t, rosterSlots: slots };
    } else {
      updatedTeams[tid] = t;
    }
  }

  // Insert into target team's target slot.
  const targetTeam = deepClone(updatedTeams[teamId]);
  if (!targetTeam.rosterSlots[targetSlot]) targetTeam.rosterSlots[targetSlot] = [];
  targetTeam.rosterSlots[targetSlot].push(playerId);
  updatedTeams[teamId] = targetTeam;

  // Validate roster caps after mutation.
  if (settings) {
    const capErr = validateRosterAfterMove(targetTeam, settings);
    if (capErr) {
      throw new Error(`Move rejected — constraint violation: [${capErr.teamId}] ${capErr.reason}`);
    }
  }

  // Build updated player.
  const updatedPlayer: Player = {
    ...player,
    activeSelectionByTeamId: null,
    lastMovedByTeamId: teamId,
    acquiredTimestamp: newAcquiredTimestamp,
    playerHistoryStack: [...player.playerHistoryStack, frame],
    isMostRecentMoveForTeam: false,
  };

  let updatedPlayers = { ...players, [playerId]: updatedPlayer };
  updatedPlayers = recomputeMostRecentFlags(updatedPlayers, teamId);

  return { players: updatedPlayers, teams: updatedTeams };
}
