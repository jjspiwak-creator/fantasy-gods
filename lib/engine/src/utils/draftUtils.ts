import type { LeagueSettings, TeamRoster, DraftSlot, MatchupSchedule, Matchup } from "../types/league";

// ─── Draft Matrix Generation ─────────────────────────────────────────────────

/**
 * Generates a full draft pick grid for a given format.
 *
 * Snake:  Alternates ascending/descending each round.
 * 3RR:    R1 ascending, R2 descending (snake), R3 descending again (the "reversal"),
 *         R4+ resumes normal snake starting from ascending.
 * Linear: Every round ascending.
 * Auction: Returns linear order (auction managers bid; pick order is nominal).
 */
export function generateDraftMatrix(
  settings: LeagueSettings,
  teams: TeamRoster[],
  totalRounds = 15,
): DraftSlot[] {
  const n = teams.length;
  if (n === 0) return [];

  const slots: DraftSlot[] = [];
  let overallIndex = 0;

  for (let round = 1; round <= totalRounds; round++) {
    let pickOrder: number[];

    switch (settings.draftType) {
      case "linear":
      case "auction":
        pickOrder = Array.from({ length: n }, (_, i) => i);
        break;

      case "snake":
        pickOrder =
          round % 2 === 0
            ? Array.from({ length: n }, (_, i) => n - 1 - i)
            : Array.from({ length: n }, (_, i) => i);
        break;

      case "3rr": {
        // R1: ascending, R2: descending, R3: descending (3RR reversal — stays inverted)
        // R4+: flipped snake — even rounds ascending, odd rounds descending (offset by +1)
        let isDescending: boolean;
        if (round <= 3) {
          isDescending = round !== 1;
        } else {
          isDescending = round % 2 !== 0;
        }
        pickOrder = isDescending
          ? Array.from({ length: n }, (_, i) => n - 1 - i)
          : Array.from({ length: n }, (_, i) => i);
        break;
      }
    }

    for (let pickIdx = 0; pickIdx < n; pickIdx++) {
      const teamIdx = pickOrder[pickIdx];
      const team = teams[teamIdx];
      slots.push({
        slotId: `R${round}P${pickIdx + 1}`,
        round,
        pickInRound: pickIdx + 1,
        overallIndex: overallIndex++,
        originalOwnerId: team.teamId,
        currentOwnerId: team.teamId,
        assignedPlayerId: null,
        isLockedKeeper: false,
      });
    }
  }

  return slots;
}

// ─── Matchup Schedule Generation ─────────────────────────────────────────────

/**
 * Generates a round-robin head-to-head schedule.
 * If the number of teams is odd, a phantom bye slot is added and bye matchups are omitted.
 */
export function generateMatchupSchedule(
  teams: TeamRoster[],
  regularSeasonWeeks = 13,
): MatchupSchedule[] {
  const ids = teams.map((t) => t.teamId);
  if (ids.length % 2 !== 0) ids.push("__BYE__");

  const n = ids.length;
  const schedule: MatchupSchedule[] = [];
  let matchupCounter = 0;

  for (let week = 1; week <= regularSeasonWeeks; week++) {
    const roundOffset = (week - 1) % (n - 1);
    const matchups: Matchup[] = [];

    const rotated = [
      ids[0],
      ...ids.slice(1).map((_, i) => ids[1 + ((i + roundOffset) % (n - 1))]),
    ];

    for (let i = 0; i < n / 2; i++) {
      const teamA = rotated[i];
      const teamB = rotated[n - 1 - i];
      if (teamA === "__BYE__" || teamB === "__BYE__") continue;
      matchups.push({
        matchupId: `W${week}-M${++matchupCounter}`,
        teamAId: teamA,
        teamBId: teamB,
        pointsA: 0,
        pointsB: 0,
      });
    }

    schedule.push({ weekNumber: week, matchups });
  }

  return schedule;
}
