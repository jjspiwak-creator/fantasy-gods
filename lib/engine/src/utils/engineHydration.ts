/**
 * Engine hydration — transforms the real GET /api/espn/leagues/{id}/teams response
 * into the canonical (settings, players, teams) triple consumed by LeagueStateContext.
 *
 * This function is PURE: no side effects, no React imports.
 *
 * Shape differences between the API response and EspnLeagueInput (documented here
 * so espnAdapter.ts stays untouched):
 *
 * 1. NO LEAGUE SETTINGS — The /teams endpoint carries no scoring, roster-cap, draft,
 *    or waiver configuration. A minimal safe default EspnLeagueSettings is synthesised
 *    here. Scoring rules will be empty; slot counts use a standard 1QB/2RB/2WR/1TE/
 *    1FLEX/1K/1DST/7BENCH template until a settings endpoint is wired up.
 *
 * 2. POSITION STRING vs. NUMERIC ID — The server returns `position: "QB"` (string).
 *    EspnPlayerInfo.defaultPositionId expects a number (1=QB, 2=RB, 3=WR, 4=TE, 5=K,
 *    16=D/ST). Mapped via API_POSITION_ID below.
 *
 * 3. FLAT ROSTER vs. ENTRY ARRAY — The server returns `roster: Player[]` (flat).
 *    EspnTeamInput.roster.entries expects `EspnRosterEntry[]`. Each flat player is
 *    wrapped into a synthetic entry here.
 *
 * 4. NO lineupSlotId — The server's Player has no slot assignment. lineupSlotId is
 *    inferred: isStarter=true → primary position slot; isStarter=false → BENCH (20).
 *
 * 5. NO eligibleSlots — Synthesised from position so the adapter can correctly derive
 *    eligiblePositions and populate slotEligibility.
 *
 * 6. NO acquisitionDate — Server carries no roster timestamp. Null is passed through;
 *    acquiredTimestamp on the engine Player will be null.
 *
 * 7. ownerName STRING vs. owners STRING[] — Server returns `ownerName: string`.
 *    The adapter reads `owners?.[0]` for managerName, so we wrap in a one-element array.
 *
 * 8. "D/ST" label — The server uses the string "D/ST". ESPN's defaultPositionId 16 is
 *    the correct numeric counterpart; handled explicitly in API_POSITION_ID.
 */

import type { Team as ApiTeam, LeagueSettings as ApiLeagueSettings } from "@workspace/api-client-react";
import { adaptEspnLeague } from "../adapters/espnAdapter";
import type {
  EspnLeagueInput,
  EspnTeamInput,
  EspnRosterEntry,
  EspnLeagueSettings,
} from "../adapters/espnAdapter";
import type { LeagueSettings, Player, TeamRoster } from "../types/league";

// ─── Position reverse-maps ────────────────────────────────────────────────────

/**
 * Server position string → ESPN defaultPositionId.
 * Any unknown position falls back to 0 (unknown); the adapter will produce an
 * empty eligiblePositions array for such players — safe but inert.
 */
const API_POSITION_ID: Record<string, number> = {
  QB:    1,
  RB:    2,
  WR:    3,
  TE:    4,
  K:     5,
  "D/ST": 16,
};

/**
 * Server position string → primary ESPN lineup slot ID.
 * Used to set lineupSlotId when isStarter=true.
 * BENCH fallback (20) is used when isStarter=false or position is unknown.
 */
const API_PRIMARY_SLOT: Record<string, number> = {
  QB:    0,
  RB:    2,
  WR:    4,
  TE:    6,
  K:     17,
  "D/ST": 16,
};

/**
 * Server position string → full set of ESPN slot IDs the player is eligible for.
 * Includes position-specific starters, flex/combo variants, and BENCH.
 * The adapter's deriveEligiblePositions ignores BENCH/FLEX/combo slots when building
 * eligiblePositions, so over-inclusion here is safe.
 */
const API_ELIGIBLE_SLOTS: Record<string, number[]> = {
  //            primary  combo    flex  SF   BENCH
  QB:    [0,  1,               7, 20],
  RB:    [2,  3,       23,    7, 20],
  WR:    [4,  3, 5,    23,    7, 20],
  TE:    [6,     5,    23,    7, 20],
  K:     [17,                   20],
  "D/ST": [16,                  20],
};

// ─── Synthetic league settings ────────────────────────────────────────────────

/**
 * Minimal EspnLeagueSettings used when the /teams endpoint provides no settings
 * block. Scoring rules will be empty; roster caps reflect a standard 10-team
 * template. Replace once a dedicated settings endpoint is available.
 */
function buildDefaultSettings(teamCount: number): EspnLeagueSettings {
  return {
    name: "ESPN League",
    size: teamCount,
    draftSettings: {
      type: "SNAKE",
      timePerSelection: 90,
    },
    rosterSettings: {
      // Standard: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, 1 K, 1 DST, 7 BENCH, 1 IR
      lineupSlotCounts: {
        "0":  1,   // QB
        "2":  2,   // RB
        "4":  2,   // WR
        "6":  1,   // TE
        "23": 1,   // FLEX
        "17": 1,   // K
        "16": 1,   // DST
        "20": 7,   // BENCH
        "21": 1,   // IR
      },
    },
    scoringSettings: {
      // No scoring items — scoringRules will be empty until a settings endpoint
      // returns the real scoringItems array.
      scoringType: "H2H_POINTS",
      scoringItems: [],
    },
    waiverSettings: { type: "TRADITIONAL" },
  };
}

// ─── Real league settings adapter ──────────────────────────────────────────────

/**
 * Maps the real GET /api/espn/leagues/{id}/settings response (ApiLeagueSettings)
 * into the EspnLeagueSettings shape consumed by adaptEspnLeague.
 *
 * financeSettings is only populated when isUsingAcquisitionBudget === true.
 * ESPN returns a nonzero acquisitionBudget even for non-FAAB leagues, so
 * passing it through unconditionally would wrongly set totalAuctionBudget
 * and seed FAAB balances on every team in a traditional (non-FAAB) league.
 *
 * tradeSettings is fetched by the API but intentionally unused here.
 * useLeagueMedian is not present in the API payload — omitted so the
 * adapter's default (false) applies.
 */
export function toEspnLeagueSettings(api: ApiLeagueSettings): EspnLeagueSettings {
  const { acquisitionSettings } = api;

  return {
    name: api.name,
    size: api.size,
    draftSettings: {
      type: api.draftSettings.type,
      timePerSelection: api.draftSettings.timePerSelection,
    },
    rosterSettings: {
      lineupSlotCounts: api.rosterSettings.lineupSlotCounts,
    },
    scoringSettings: {
      scoringType: api.scoringSettings.scoringType,
      scoringItems: api.scoringSettings.scoringItems,
    },
    waiverSettings: {
      type: acquisitionSettings.acquisitionType,
    },
    ...(acquisitionSettings.isUsingAcquisitionBudget
      ? { financeSettings: { acquisitionBudget: acquisitionSettings.acquisitionBudget } }
      : {}),
  };
}

// ─── Entry-point ──────────────────────────────────────────────────────────────

export interface EngineHydrationResult {
  settings: LeagueSettings;
  players: Record<string, Player>;
  teams: Record<string, TeamRoster>;
}

/**
 * Pure function. Feed it the raw Team[] from GET /api/espn/leagues/{id}/teams
 * and receive the (settings, players, teams) triple ready to dispatch into
 * LeagueStateContext.
 *
 * @param leagueId     The league ID string (from the URL param).
 * @param apiTeams     The Team[] array returned by getLeagueTeams().
 * @param apiSettings  Optional real rulebook from getLeagueSettings(). When
 *                     provided, it replaces the synthesized defaults. When
 *                     absent, buildDefaultSettings(apiTeams.length) is used
 *                     exactly as before (manual/fallback leagues).
 */
export function buildEngineState(
  leagueId: string,
  apiTeams: ApiTeam[],
  apiSettings?: ApiLeagueSettings,
): EngineHydrationResult {
  const espnTeams: EspnTeamInput[] = apiTeams.map((t) => {
    const entries: EspnRosterEntry[] = t.roster.map((p) => {
      const posId   = API_POSITION_ID[p.position]  ?? 0;
      const slotId =
        typeof p.lineupSlotId === "number"
          ? p.lineupSlotId
          : p.isStarter
            ? (API_PRIMARY_SLOT[p.position] ?? 20)
            : 20;
      const eligible = API_ELIGIBLE_SLOTS[p.position] ?? [20];

      return {
        playerId:    String(p.id),
        lineupSlotId: slotId,
        acquisitionDate: null,   // difference #6: not available from /teams endpoint
        weekLocked:  false,
        playerPoolEntry: {
          acquisitionType: "TRADE",
          injuryStatus: p.injuryStatus ?? null,
          player: {
            id:                String(p.id),
            fullName:          p.name,
            defaultPositionId: posId,    // difference #2: reversed from position string
            eligibleSlots:     eligible, // difference #5: synthesised
            byeWeek:           0,
            stats:             [],
          },
        },
      };
    });

    return {
      id:          t.id,
      name:        t.name,
      abbrev:      t.name.slice(0, 3).toUpperCase(),
      owners:      [t.ownerName],   // difference #7: wrap string in array
      waiverRank:  0,
      roster:      { entries },     // difference #3: flat → entries wrapper
      record: {
        overall: {
          wins:   t.wins,
          losses: t.losses,
          ties:   t.ties,
        },
      },
    };
  });

  const payload: EspnLeagueInput = {
    id:      leagueId,
    settings: apiSettings
      ? toEspnLeagueSettings(apiSettings)
      : buildDefaultSettings(apiTeams.length), // difference #1: no settings on /teams
    teams:    espnTeams,
  };

  return adaptEspnLeague(payload);
}
