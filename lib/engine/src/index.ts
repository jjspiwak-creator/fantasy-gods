export type {
  LeagueSettings,
  PlayerEfficiencyMetrics,
  PlayerSchemeModifiers,
  PlayerRiskProfile,
  PlayerContingencyValue,
  PlayerHistoryFrame,
  Player,
  FutureAsset,
  TeamRoster,
  DraftSlot,
  Matchup,
  MatchupSchedule,
  TransactionMove,
  DropDestination,
} from "./types/league";

export {
  executeTransaction,
  routeDroppedPlayer,
  setPlayerSelection,
  clearPlayerSelection,
  executeMoveTransaction,
} from "./utils/transactionHandler";
export type { TransactionResult } from "./utils/transactionHandler";

export {
  computeRosValue,
  recomputeMostRecentFlags,
  undoLastPlayerMove,
} from "./utils/valuationEngine";
export type { UndoResult } from "./utils/valuationEngine";

export {
  generateDraftMatrix,
  generateMatchupSchedule,
} from "./utils/draftUtils";

export {
  toEspnLeagueSettings,
  buildEngineState,
} from "./utils/engineHydration";
export type { EngineHydrationResult } from "./utils/engineHydration";

export { adaptEspnLeague } from "./adapters/espnAdapter";
export type {
  EspnScoringItem,
  EspnDraftSettings,
  EspnRosterSettings,
  EspnScoringSettings,
  EspnFinanceSettings,
  EspnWaiverSettings,
  EspnLeagueSettings,
  EspnPlayerStats,
  EspnPlayerInfo,
  EspnPlayerPoolEntry,
  EspnRosterEntry,
  EspnTeamRecord,
  EspnTeamInput,
  EspnLeagueInput,
} from "./adapters/espnAdapter";
