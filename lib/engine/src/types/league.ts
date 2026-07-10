// ─── League Settings ─────────────────────────────────────────────────────────

export interface LeagueSettings {
  leagueId: string;
  leagueStyle: "lineup" | "best_ball" | "guillotine";
  draftType: "linear" | "snake" | "3rr" | "auction";
  tieBreakerMetric: "points_for" | "head_to_head" | "points_against";
  waiverSystem:
    | "faab_with_rolling_tiebreaker"
    | "rolling_priority"
    | "inverse_standings";
  draftClockDuration: number;
  useLeagueMedian: boolean;
  divisionIds: string[];
  /** Nested evaluation keys supporting tiered / distance-based bonuses */
  scoringRules: Record<string, unknown>;
  /** Maps slot keys (e.g. 'STARTER_QB', 'BENCH', 'IR') to minimum-fill count */
  slotRequirements: Record<string, number>;
  /** Maximum players allowed per slot key */
  rosterCaps: Record<string, number>;
  totalAuctionBudget?: number;
  /**
   * Maps slot keys to the position strings that may occupy them.
   * If omitted, no position-legality enforcement is applied.
   * A player is eligible for a slot if any of their eligiblePositions intersects
   * the slot's allowed list.
   */
  slotEligibility?: Record<string, string[]>;
  /** IANA timezone string used for calendar-day comparisons (default: 'America/New_York') */
  leagueTimezone?: string;
}

// ─── Player ───────────────────────────────────────────────────────────────────

export interface PlayerEfficiencyMetrics {
  targetShare: number;
  firstReadShare: number;
  yprr: number;
  yardsBeforeContact: number;
  stuffedRate: number;
}

export interface PlayerSchemeModifiers {
  teamProe: number;
  motionRate: number;
  personnelType: string;
}

export interface PlayerRiskProfile {
  injuryRiskMultiplier: number;
  suspensionWeeks: number;
  holdoutRisk: boolean;
}

export interface PlayerContingencyValue {
  handcuffId: string | null;
  upsideMultiplierIfPrimaryRemoved: number;
}

export interface PlayerHistoryFrame {
  /** The slot the player was placed into by this move */
  rosterSlot: string;
  financialCost?: number;
  executedByTeamId: string;
  /** Captures the player's state immediately before this move was applied */
  origin: {
    /** Team the player was on before this move (null = was a free agent) */
    originTeamId: string | null;
    /** Slot the player occupied before this move (null = was a free agent) */
    originSlot: string | null;
    /** acquiredTimestamp value before this move */
    priorAcquiredTimestamp: number | null;
    /** Unix ms timestamp of when this move was executed */
    movedAt: number;
  };
}

export interface Player {
  id: string;
  name: string;
  realTeam: string;
  byeWeek: number;
  /** Multi-eligibility support, e.g. ['RB', 'WR'] */
  eligiblePositions: string[];
  lockStatus: "free" | "locked_for_week";
  /** Unix ms timestamp of when the player entered their current roster slot */
  acquiredTimestamp: number | null;
  /** Tracks active UI focus for a given team's cursor — null when not focused */
  activeSelectionByTeamId: string | null;
  /** The last team that executed an actual transaction with this asset */
  lastMovedByTeamId: string | null;
  /** True only for the most recent move by lastMovedByTeamId — drives highlight color */
  isMostRecentMoveForTeam: boolean;
  /** Asset-isolated undo stack; each frame captures prior slot + cost + executor */
  playerHistoryStack: PlayerHistoryFrame[];
  efficiencyMetrics: PlayerEfficiencyMetrics;
  schemeModifiers: PlayerSchemeModifiers;
  riskProfile: PlayerRiskProfile;
  contingencyValue: PlayerContingencyValue;
  /** weeklyProjections[weekNum][statKey] = raw value */
  weeklyProjections: Record<number, Record<string, number>>;
  customMetadata: Record<string, unknown>;
}

// ─── Team Roster ──────────────────────────────────────────────────────────────

export interface FutureAsset {
  assetId: string;
  type: "draft_pick";
  year: number;
  round: number;
  originalOwnerId: string;
}

export interface TeamRoster {
  teamId: string;
  teamName: string;
  managerName: string;
  divisionId: string | null;
  /** financialBalances['FAAB'] = remaining FAAB, etc. */
  financialBalances: Record<string, number>;
  /** rosterSlots[slotKey] = array of Player IDs occupying that slot */
  rosterSlots: Record<string, string[]>;
  draftQueue: string[];
  isAutoDraftActive: boolean;
  waiverRank: number;
  keeperRules: Record<string, { draftSlotCost: number; inflationYears: number }>;
  futureAssets: FutureAsset[];
}

// ─── Draft ────────────────────────────────────────────────────────────────────

export interface DraftSlot {
  slotId: string;
  round: number;
  pickInRound: number;
  overallIndex: number;
  originalOwnerId: string;
  currentOwnerId: string;
  assignedPlayerId: string | null;
  auctionCost?: number;
  isLockedKeeper: boolean;
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export interface Matchup {
  matchupId: string;
  teamAId: string;
  teamBId: string;
  pointsA: number;
  pointsB: number;
}

export interface MatchupSchedule {
  weekNumber: number;
  matchups: Matchup[];
}

// ─── Transaction ─────────────────────────────────────────────────────────────

/** Describes one team's side of an atomic multi-team trade/waiver move */
export interface TransactionMove {
  teamId: string;
  /** Player IDs this team is receiving */
  acquire: string[];
  /** Player IDs this team is releasing */
  release: string[];
  /** Maps each acquired player ID to the target roster slot key */
  targetSlots: Record<string, string>;
}

export type DropDestination = "FREE_AGENT" | "WAIVER_COLUMN";
