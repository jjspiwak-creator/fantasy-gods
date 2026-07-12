import type { Player, TeamRoster, LeagueSettings, TransactionMove } from "@workspace/engine";

/**
 * Thrown when no valid target slot can be found for an acquired player.
 * Flows through the same HTTP 400 path as engine constraint violations.
 */
export class SlotResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlotResolveError";
  }
}

/**
 * Picks a target slot for one acquired player on one receiving team.
 * Deterministic: same input always produces same output — no randomness, no clock.
 *
 * Fallback order:
 *   1. A slot vacated by an outgoing player on this team in this trade,
 *      if the incoming player is eligible for it and the slot has room
 *      after releasing the outgoing player.
 *   2. A bench-type slot (engine key "BENCH" or ESPN numeric key "20")
 *      that has room and the player is eligible for.
 *   3. The first eligible slot with room (by iteration order over the union
 *      of rosterSlots keys and rosterCaps keys).
 *   4. Throws SlotResolveError naming the player and team.
 */
export function resolveSlot(
  player: Player,
  toTeamId: string,
  teamRoster: TeamRoster,
  settings: LeagueSettings,
  vacatedSlots: string[],
): string {
  const { rosterSlots } = teamRoster;
  const { rosterCaps, slotEligibility } = settings;

  const allSlots = new Set([...Object.keys(rosterSlots), ...Object.keys(rosterCaps)]);

  function isEligible(slot: string): boolean {
    if (!slotEligibility) return true;
    const allowed = slotEligibility[slot];
    if (!allowed) return true;
    return player.eligiblePositions.some((pos) => allowed.includes(pos));
  }

  function hasRoom(slot: string): boolean {
    const cap = rosterCaps[slot] ?? 0;
    if (cap === 0) return true;
    const count = rosterSlots[slot]?.length ?? 0;
    return count < cap;
  }

  function hasRoomAfterVacate(slot: string): boolean {
    const cap = rosterCaps[slot] ?? 0;
    if (cap === 0) return true;
    const count = rosterSlots[slot]?.length ?? 0;
    return count <= cap;
  }

  for (const slot of vacatedSlots) {
    if (isEligible(slot) && hasRoomAfterVacate(slot)) {
      return slot;
    }
  }

  for (const slot of allSlots) {
    const isBench = slot === "BENCH" || slot === "20" || slot.toUpperCase().includes("BENCH");
    if (isBench && isEligible(slot) && hasRoom(slot)) {
      return slot;
    }
  }

  for (const slot of allSlots) {
    if (isEligible(slot) && hasRoom(slot)) {
      return slot;
    }
  }

  const hasAnyEligible = [...allSlots].some((s) => isEligible(s));
  if (!hasAnyEligible) {
    throw new SlotResolveError(
      `No valid slot for player '${player.id}' on team '${toTeamId}': player is ineligible for all available slots`,
    );
  }
  throw new SlotResolveError(
    `No valid slot for player '${player.id}' on team '${toTeamId}': all eligible slots are at capacity`,
  );
}

/**
 * Builds a TransactionMove[] for every participating team from a flat transfer list.
 * Resolves target slots deterministically for every acquired player.
 * Throws SlotResolveError if any player cannot be placed.
 */
export function buildTransactionMoves(
  transfers: Array<{ playerId: string; fromTeamId: string; toTeamId: string }>,
  enginePlayers: Record<string, Player>,
  engineTeams: Record<string, TeamRoster>,
  engineSettings: LeagueSettings,
): TransactionMove[] {
  const releaseByTeam = new Map<string, string[]>();
  const acquireByTeam = new Map<string, string[]>();

  for (const t of transfers) {
    if (!releaseByTeam.has(t.fromTeamId)) releaseByTeam.set(t.fromTeamId, []);
    releaseByTeam.get(t.fromTeamId)!.push(t.playerId);

    if (!acquireByTeam.has(t.toTeamId)) acquireByTeam.set(t.toTeamId, []);
    acquireByTeam.get(t.toTeamId)!.push(t.playerId);
  }

  const vacatedSlotsByTeam = new Map<string, string[]>();
  for (const [teamId, released] of releaseByTeam) {
    const team = engineTeams[teamId];
    if (!team) continue;
    const slots: string[] = [];
    for (const pid of released) {
      for (const [slot, ids] of Object.entries(team.rosterSlots)) {
        if (ids.includes(pid)) {
          slots.push(slot);
          break;
        }
      }
    }
    vacatedSlotsByTeam.set(teamId, slots);
  }

  const allTeamIds = new Set([...releaseByTeam.keys(), ...acquireByTeam.keys()]);
  const moves: TransactionMove[] = [];

  for (const teamId of allTeamIds) {
    const release = releaseByTeam.get(teamId) ?? [];
    const acquire = acquireByTeam.get(teamId) ?? [];
    const vacatedSlots = vacatedSlotsByTeam.get(teamId) ?? [];
    const teamRoster = engineTeams[teamId];

    const targetSlots: Record<string, string> = {};

    for (const playerId of acquire) {
      const player = enginePlayers[playerId];
      if (!player) {
        throw new SlotResolveError(`Unknown player '${playerId}' in engine state`);
      }
      if (!teamRoster) {
        throw new SlotResolveError(`Unknown team '${teamId}' in engine state`);
      }
      targetSlots[playerId] = resolveSlot(
        player,
        teamId,
        teamRoster,
        engineSettings,
        vacatedSlots,
      );
    }

    moves.push({ teamId, acquire, release, targetSlots });
  }

  return moves;
}
