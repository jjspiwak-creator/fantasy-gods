/**
 * ESPN → Engine adapter (slice 1).
 *
 * Converts the raw ESPN Fantasy API payload into the engine's canonical types
 * (LeagueSettings, Player, TeamRoster). Imports nothing from api-server.
 * All ESPN input types are defined locally, mirroring the shapes the ESPN
 * endpoints actually return.
 */

import type {
  LeagueSettings,
  Player,
  TeamRoster,
} from "../types/league.ts";

// ─── ESPN Input Types (local, no api-server import) ───────────────────────────

/** One entry in the scoringItems array from ESPN's scoringSettings */
export interface EspnScoringItem {
  /** ESPN numeric stat ID (e.g. 3 = passingYards, 4 = passingTD) */
  statId: number;
  /** Points awarded per unit of this stat */
  points: number;
  /** If true the stat is applied per-reception (PPR indicator) */
  isPartOfPoints?: boolean;
}

export interface EspnDraftSettings {
  /** "SNAKE" | "AUCTION" | "LINEAR" */
  type: string;
  /** Seconds per pick */
  timePerSelection: number;
}

export interface EspnRosterSettings {
  /**
   * Maps ESPN lineup slot ID (as string key) to the count of players allowed
   * in that slot. E.g. { "0": 1, "2": 2, "4": 2, "6": 1, "23": 1, "20": 7 }
   */
  lineupSlotCounts: Record<string, number>;
  /**
   * Optional explicit position limits (position string → max on roster).
   * When absent, caps are inferred from lineupSlotCounts.
   */
  positionLimits?: Record<string, number>;
}

export interface EspnScoringSettings {
  /** "H2H_POINTS" | "ROTO" | "H2H_MOST_CATEGORIES" | "TOTAL_POINTS" */
  scoringType: string;
  scoringItems: EspnScoringItem[];
}

export interface EspnFinanceSettings {
  /** FAAB budget (0 = no FAAB) */
  acquisitionBudget?: number;
}

export interface EspnWaiverSettings {
  /** "GAMEDAY_MORNING" | "TRADITIONAL" | "CONTINUOUS" */
  type?: string;
}

export interface EspnLeagueSettings {
  name: string;
  /** Number of teams */
  size: number;
  draftSettings: EspnDraftSettings;
  rosterSettings: EspnRosterSettings;
  scoringSettings: EspnScoringSettings;
  financeSettings?: EspnFinanceSettings;
  waiverSettings?: EspnWaiverSettings;
  /** True when the league uses a median-score bonus rule */
  useLeagueMedian?: boolean;
}

export interface EspnPlayerStats {
  /** 0 = season actual, 1 = projected season, 5 = projected week */
  statSplitTypeId: number;
  scoringPeriodId?: number;
  appliedTotal?: number;
  /** Raw stat map keyed by ESPN stat ID string, e.g. { "3": 250, "4": 2 } */
  stats?: Record<string, number>;
}

export interface EspnPlayerInfo {
  id: number | string;
  fullName: string;
  /** ESPN numeric position ID: 1=QB, 2=RB, 3=WR, 4=TE, 5=K, 16=D/ST */
  defaultPositionId: number;
  /**
   * All lineup slot IDs this player may legally occupy.
   * Used to derive multi-eligibility: position-specific slots (0→QB, 2→RB,
   * 4→WR, 6→TE, 16→DST, 17→K) are unioned to form eligiblePositions.
   * BENCH/IR/combo-flex slots are ignored for position derivation.
   */
  eligibleSlots?: number[];
  /** ESPN pro team ID for bye-week lookup */
  proTeamId?: number;
  /** Bye week number; preferred over proTeamBye when present */
  byeWeek?: number;
  stats?: EspnPlayerStats[];
}

export interface EspnPlayerPoolEntry {
  /** "DRAFT" | "WAIVER" | "FREEAGENT" | "TRADE" */
  acquisitionType?: string;
  /**
   * "ACTIVE" | "QUESTIONABLE" | "DOUBTFUL" | "OUT" | "INJURY_RESERVE" | null
   * Mapped to lockStatus when combined with weekLocked.
   */
  injuryStatus?: string | null;
  player: EspnPlayerInfo;
}

export interface EspnRosterEntry {
  playerId: number | string;
  /** ESPN lineup slot the player currently occupies */
  lineupSlotId: number;
  /** Unix ms timestamp when the player was acquired */
  acquisitionDate?: number | null;
  playerPoolEntry: EspnPlayerPoolEntry;
  /**
   * When true, the player is locked for the current scoring period
   * (game has started or is in progress).
   */
  weekLocked?: boolean;
}

export interface EspnTeamRecord {
  wins?: number;
  losses?: number;
  ties?: number;
}

export interface EspnTeamInput {
  id: number | string;
  name: string;
  abbrev?: string;
  /** ESPN member IDs of owners; first is the primary manager */
  owners?: string[];
  /** Waiver priority rank (lower = higher priority) */
  waiverRank?: number;
  roster: {
    entries: EspnRosterEntry[];
  };
  record?: {
    overall?: EspnTeamRecord;
  };
  /** Division ID if applicable */
  divisionId?: number | string | null;
}

export interface EspnLeagueInput {
  id: number | string;
  seasonId?: number;
  settings: EspnLeagueSettings;
  /** Teams with fully populated rosters */
  teams: EspnTeamInput[];
  /** Current matchup/scoring period */
  currentMatchupPeriod?: number;
}

// ─── Internal Mapping Tables ──────────────────────────────────────────────────

/**
 * ESPN lineup slot ID → engine roster slot key.
 * Slots not listed here are silently skipped (e.g. unknown future slots).
 *
 * Standard slots:  0=QB, 2=RB, 4=WR, 6=TE, 16=D/ST, 17=K, 20=BENCH, 21=IR, 23=FLEX
 * Combo/flex slots: 1=TQB, 3=RB_WR, 5=WR_TE, 7=SUPERFLEX
 */
const ESPN_LINEUP_SLOT_KEYS: Record<number, string> = {
  0: "STARTER_QB",
  1: "STARTER_TQB",
  2: "STARTER_RB",
  3: "RB_WR",
  4: "STARTER_WR",
  5: "WR_TE",
  6: "STARTER_TE",
  7: "SUPERFLEX",
  16: "STARTER_DST",
  17: "STARTER_K",
  20: "BENCH",
  21: "IR",
  23: "FLEX",
};

/**
 * ESPN defaultPositionId → engine position string.
 * Used to populate Player.eligiblePositions from the primary position.
 */
const ESPN_POSITION_ID_TO_STR: Record<number, string> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DST",
};

/**
 * Position-specific lineup slot IDs → engine position string.
 * Used by deriveEligiblePositions to union secondary positions from eligibleSlots.
 * Only includes unambiguous single-position starter slots.
 * BENCH (20), IR (21), FLEX (23), and combo slots (1,3,5,7) are deliberately excluded.
 */
const ESPN_STARTER_SLOT_TO_POSITION: Record<number, string> = {
  0: "QB",
  2: "RB",
  4: "WR",
  6: "TE",
  16: "DST",
  17: "K",
};

/**
 * Engine slot keys that are "starter" slots — slotRequirements equals the cap
 * (you must fill them). BENCH and IR have slotRequirement 0 (optional fill).
 */
const STARTER_ENGINE_SLOTS = new Set([
  "STARTER_QB",
  "STARTER_TQB",
  "STARTER_RB",
  "STARTER_WR",
  "STARTER_TE",
  "STARTER_DST",
  "STARTER_K",
  "FLEX",
  "RB_WR",
  "WR_TE",
  "SUPERFLEX",
]);

/**
 * Position-legality rules per engine slot key.
 * BENCH and IR deliberately omitted — no position restriction applied.
 */
const SLOT_ELIGIBILITY_MAP: Record<string, string[]> = {
  STARTER_QB:  ["QB"],
  STARTER_TQB: ["QB"],
  STARTER_RB:  ["RB"],
  STARTER_WR:  ["WR"],
  STARTER_TE:  ["TE"],
  STARTER_DST: ["DST"],
  STARTER_K:   ["K"],
  FLEX:        ["RB", "WR", "TE"],
  RB_WR:       ["RB", "WR"],
  WR_TE:       ["WR", "TE"],
  SUPERFLEX:   ["QB", "RB", "WR", "TE"],
};

// IDs 3,4,19,20,23,24,25,26,42,43,44,53,72 follow the community-documented ESPN
// constants (cwendt94/espn-api). IDs 5, 21, 41 and all others are intentionally
// unmapped and pass through as stat_<id> until confirmed against a live league
// payload. Do not add mappings here without a real-payload check.
/**
 * ESPN numeric stat ID → human-readable scoring key used in engine scoringRules.
 * Unknown stat IDs fall back to `stat_${id}`.
 */
const ESPN_STAT_KEYS: Record<number, string> = {
  // ── Passing ────────────────────────────────────────────────────────────────
  3:  "passingYards",
  4:  "passingTD",
  19: "passing2PT",
  20: "passingInterceptions",   // community-confirmed (cwendt94/espn-api)
  // ── Rushing ───────────────────────────────────────────────────────────────
  23: "rushingAttempts",        // community-confirmed
  24: "rushingYards",           // community-confirmed; primary scoring ID
  25: "rushingTD",              // community-confirmed
  26: "rushing2PT",             // community-confirmed
  // ── Receiving ─────────────────────────────────────────────────────────────
  42: "receivingYards",
  43: "receivingTD",
  44: "receiving2PT",
  53: "receptions",             // community-confirmed; PPR leagues use this ID
  // ── Kicking ───────────────────────────────────────────────────────────────
  83: "fgMade0_19",
  84: "fgMade20_29",
  85: "fgMade30_39",
  86: "fgMade40_49",
  87: "fgMade50Plus",
  88: "extraPoints",
  89: "fgMissed",
  // ── Miscellaneous ─────────────────────────────────────────────────────────
  72: "lostFumbles",            // community-confirmed
};

/** Maps ESPN waiver type string → engine waiverSystem value */
function mapWaiverSystem(
  espnType?: string,
): LeagueSettings["waiverSystem"] {
  switch (espnType) {
    case "TRADITIONAL":
      return "rolling_priority";
    case "INVERSE_STANDINGS":
      return "inverse_standings";
    case "FAAB":
    case "GAMEDAY_MORNING":
    case "CONTINUOUS":
    default:
      return "faab_with_rolling_tiebreaker";
  }
}

/** Maps ESPN draft type string → engine draftType value */
function mapDraftType(espnType?: string): LeagueSettings["draftType"] {
  switch ((espnType || "").toUpperCase()) {
    case "AUCTION":
      return "auction";
    case "LINEAR":
      return "linear";
    case "SNAKE":
    default:
      return "snake";
  }
}

// ─── Settings Adapter ─────────────────────────────────────────────────────────

function adaptSettings(input: EspnLeagueInput): LeagueSettings {
  const { settings } = input;
  const { rosterSettings, scoringSettings, draftSettings } = settings;

  // ── Slot counts → rosterCaps & slotRequirements ──────────────────────────
  const rosterCaps: Record<string, number> = {};
  const slotRequirements: Record<string, number> = {};

  for (const [slotIdStr, count] of Object.entries(rosterSettings.lineupSlotCounts)) {
    const slotId = Number(slotIdStr);
    const engineKey = ESPN_LINEUP_SLOT_KEYS[slotId];
    if (!engineKey || count === 0) continue;

    // Multiple ESPN slot IDs may map to the same engine key (e.g. multiple RB slots).
    rosterCaps[engineKey] = (rosterCaps[engineKey] ?? 0) + count;
    slotRequirements[engineKey] = STARTER_ENGINE_SLOTS.has(engineKey)
      ? (slotRequirements[engineKey] ?? 0) + count
      : 0;
  }

  // ── Scoring rules ─────────────────────────────────────────────────────────
  const scoringRules: Record<string, number> = {};
  for (const item of scoringSettings.scoringItems ?? []) {
    if (typeof item.points !== "number") continue;
    const key = ESPN_STAT_KEYS[item.statId] ?? `stat_${item.statId}`;
    // Accumulate when multiple items share the same stat key.
    scoringRules[key] = (scoringRules[key] ?? 0) + item.points;
  }

  // ── slotEligibility — only populate slots actually present in this league ─
  const slotEligibility: Record<string, string[]> = {};
  for (const engineKey of Object.keys(rosterCaps)) {
    if (SLOT_ELIGIBILITY_MAP[engineKey]) {
      slotEligibility[engineKey] = SLOT_ELIGIBILITY_MAP[engineKey];
    }
  }

  // ── FAAB budget → totalAuctionBudget ──────────────────────────────────────
  const faabBudget = settings.financeSettings?.acquisitionBudget;
  const hasFaab = typeof faabBudget === "number" && faabBudget > 0;

  return {
    leagueId: String(input.id),
    leagueStyle: "lineup",
    draftType: mapDraftType(draftSettings?.type),
    tieBreakerMetric: "points_for",
    waiverSystem: mapWaiverSystem(settings.waiverSettings?.type),
    draftClockDuration: draftSettings?.timePerSelection ?? 90,
    useLeagueMedian: settings.useLeagueMedian ?? false,
    divisionIds: [],
    scoringRules,
    slotRequirements,
    rosterCaps,
    slotEligibility,
    leagueTimezone: "America/New_York",
    ...(hasFaab ? { totalAuctionBudget: faabBudget } : {}),
  };
}

// ─── Player Adapter ───────────────────────────────────────────────────────────

/**
 * Derive the set of engine position strings for a player.
 *
 * Algorithm:
 *   1. Add primary position from defaultPositionId.
 *   2. Walk eligibleSlots; for each position-specific slot (0→QB, 2→RB,
 *      4→WR, 6→TE, 16→DST, 17→K) add the implied position.
 *      BENCH (20), IR (21), FLEX (23), and combo slots (1,3,5,7) are ignored —
 *      they are slot-level rules, not player-position facts.
 *   3. Return the deduplicated union.
 *
 * Documented default: ["UNKNOWN"] when defaultPositionId is unrecognised
 * and eligibleSlots yields nothing. "UNKNOWN" players are bench-only by design;
 * no starter slot will accept them without explicit slotEligibility expansion.
 */
function deriveEligiblePositions(playerInfo: EspnPlayerInfo): string[] {
  const positions = new Set<string>();

  // 1. Primary position
  const primary = ESPN_POSITION_ID_TO_STR[playerInfo.defaultPositionId];
  if (primary) positions.add(primary);

  // 2. Secondary positions from position-specific eligible slots
  for (const slotId of playerInfo.eligibleSlots ?? []) {
    const pos = ESPN_STARTER_SLOT_TO_POSITION[slotId];
    if (pos) positions.add(pos);
  }

  if (positions.size > 0) return [...positions];

  // 3. Unknown — bench-only by design
  return ["UNKNOWN"];
}

function adaptPlayer(
  entry: EspnRosterEntry,
  teamId: string,
  slotKey: string,
): Player {
  const { playerPoolEntry, weekLocked, acquisitionDate } = entry;
  const { player, injuryStatus } = playerPoolEntry;

  // lockStatus: locked when the week is locked (game started) or IR-designated
  const lockStatus: Player["lockStatus"] =
    weekLocked === true || injuryStatus === "INJURY_RESERVE"
      ? "locked_for_week"
      : "free";

  return {
    id: String(player.id),
    name: player.fullName ?? "Unknown",
    realTeam: String(player.proTeamId ?? "FA"),
    byeWeek: player.byeWeek ?? 0,
    eligiblePositions: deriveEligiblePositions(player),
    lockStatus,
    /** acquiredTimestamp: use ESPN acquisitionDate when present; null otherwise */
    acquiredTimestamp: typeof acquisitionDate === "number" ? acquisitionDate : null,
    activeSelectionByTeamId: null,
    lastMovedByTeamId: null,
    isMostRecentMoveForTeam: false,
    /** Always starts empty — the engine tracks moves going forward */
    playerHistoryStack: [],
    /** Efficiency metrics: ESPN doesn't supply these; zero-initialised */
    efficiencyMetrics: {
      targetShare: 0,
      firstReadShare: 0,
      yprr: 0,
      yardsBeforeContact: 0,
      stuffedRate: 0,
    },
    /** Scheme modifiers: ESPN doesn't supply these; neutral defaults */
    schemeModifiers: {
      teamProe: 0,
      motionRate: 0,
      personnelType: "unknown",
    },
    /** Risk profile: neutral (no injury multiplier applied until overridden) */
    riskProfile: {
      injuryRiskMultiplier: 1,
      suspensionWeeks: 0,
      holdoutRisk: false,
    },
    contingencyValue: {
      handcuffId: null,
      upsideMultiplierIfPrimaryRemoved: 1,
    },
    /** weeklyProjections: not available from ESPN roster endpoint; empty */
    weeklyProjections: {},
    /** customMetadata: empty — callers may populate post-adaptation */
    customMetadata: {},
  };
}

// ─── Teams Adapter ────────────────────────────────────────────────────────────

function adaptTeams(
  espnTeams: EspnTeamInput[],
): {
  players: Record<string, Player>;
  teams: Record<string, TeamRoster>;
} {
  const players: Record<string, Player> = {};
  const teams: Record<string, TeamRoster> = {};

  for (const espnTeam of espnTeams) {
    const teamId = String(espnTeam.id);
    const rosterSlots: Record<string, string[]> = {};
    const financialBalances: Record<string, number> = {};

    for (const entry of espnTeam.roster?.entries ?? []) {
      const slotKey = ESPN_LINEUP_SLOT_KEYS[entry.lineupSlotId];
      // Skip unknown slot IDs (future ESPN slots we don't handle yet).
      if (!slotKey) continue;

      const playerId = String(entry.playerId ?? entry.playerPoolEntry?.player?.id);
      if (!playerId) continue;

      // Deduplicate: a player should appear once; skip if already seen.
      if (players[playerId]) continue;

      const player = adaptPlayer(entry, teamId, slotKey);
      players[playerId] = player;

      if (!rosterSlots[slotKey]) rosterSlots[slotKey] = [];
      rosterSlots[slotKey].push(playerId);
    }

    teams[teamId] = {
      teamId,
      teamName: espnTeam.name ?? `Team ${teamId}`,
      managerName: espnTeam.owners?.[0] ?? "Unknown",
      divisionId:
        espnTeam.divisionId != null ? String(espnTeam.divisionId) : null,
      financialBalances,
      rosterSlots,
      draftQueue: [],
      isAutoDraftActive: false,
      waiverRank: espnTeam.waiverRank ?? 0,
      keeperRules: {},
      futureAssets: [],
    };
  }

  return { players, teams };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts a raw ESPN Fantasy league payload into the engine's canonical types.
 *
 * @param input - Combined league settings + teams payload (see EspnLeagueInput).
 * @returns { settings, players, teams } ready to pass into executeTransaction
 *   or the LeagueStateContext.
 */
export function adaptEspnLeague(input: EspnLeagueInput): {
  settings: LeagueSettings;
  players: Record<string, Player>;
  teams: Record<string, TeamRoster>;
} {
  const settings = adaptSettings(input);
  const { players, teams } = adaptTeams(input.teams);

  // Seed each team's FAAB balance from the league budget when present.
  if (typeof settings.totalAuctionBudget === "number") {
    for (const team of Object.values(teams)) {
      if (!("FAAB" in team.financialBalances)) {
        team.financialBalances["FAAB"] = settings.totalAuctionBudget;
      }
    }
  }

  return { settings, players, teams };
}
