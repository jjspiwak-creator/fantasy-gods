import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import type {
  LeagueSettings,
  Player,
  TeamRoster,
  DraftSlot,
  MatchupSchedule,
  Matchup,
} from "@/types/league";
import { generateDraftMatrix } from "@/utils/draftUtils";

// Re-export so any consumers importing from this module continue to work.
export { generateDraftMatrix } from "@/utils/draftUtils";

// ─── State Shape ─────────────────────────────────────────────────────────────

export interface LeagueState {
  sessionId: string;
  /** Null when this is the live session; set to the parent sessionId in branched mode */
  branchedFrom: string | null;
  settings: LeagueSettings;
  /** Keyed by player ID */
  players: Record<string, Player>;
  /** Keyed by team ID */
  teams: Record<string, TeamRoster>;
  draftSlots: DraftSlot[];
  schedule: MatchupSchedule[];
  /** Player IDs in the free-agent pool (dropped same-day) */
  freeAgents: string[];
  /** Player IDs awaiting waiver processing (dropped after midnight) */
  waiverColumn: string[];
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type LeagueAction =
  | { type: "SET_SETTINGS"; settings: LeagueSettings }
  | { type: "SET_PLAYER"; player: Player }
  | { type: "BATCH_SET_PLAYERS"; players: Record<string, Player> }
  | { type: "SET_TEAM"; team: TeamRoster }
  | { type: "BATCH_SET_TEAMS"; teams: Record<string, TeamRoster> }
  | { type: "SET_DRAFT_SLOTS"; slots: DraftSlot[] }
  | { type: "SET_SCHEDULE"; schedule: MatchupSchedule[] }
  | { type: "MOVE_TO_FREE_AGENT"; playerId: string }
  | { type: "MOVE_TO_WAIVER"; playerId: string }
  | { type: "RESTORE_STATE"; state: LeagueState };

// ─── Reducer ─────────────────────────────────────────────────────────────────

function leagueReducer(state: LeagueState, action: LeagueAction): LeagueState {
  switch (action.type) {
    case "SET_SETTINGS":
      return { ...state, settings: action.settings };
    case "SET_PLAYER":
      return { ...state, players: { ...state.players, [action.player.id]: action.player } };
    case "BATCH_SET_PLAYERS":
      return { ...state, players: { ...state.players, ...action.players } };
    case "SET_TEAM":
      return { ...state, teams: { ...state.teams, [action.team.teamId]: action.team } };
    case "BATCH_SET_TEAMS":
      return { ...state, teams: { ...state.teams, ...action.teams } };
    case "SET_DRAFT_SLOTS":
      return { ...state, draftSlots: action.slots };
    case "SET_SCHEDULE":
      return { ...state, schedule: action.schedule };
    case "MOVE_TO_FREE_AGENT":
      return {
        ...state,
        freeAgents: [...state.freeAgents, action.playerId],
        waiverColumn: state.waiverColumn.filter((id) => id !== action.playerId),
      };
    case "MOVE_TO_WAIVER":
      return {
        ...state,
        waiverColumn: [...state.waiverColumn, action.playerId],
        freeAgents: state.freeAgents.filter((id) => id !== action.playerId),
      };
    case "RESTORE_STATE":
      return action.state;
    default:
      return state;
  }
}

// ─── Matchup Schedule Generation ─────────────────────────────────────────────

/**
 * Generates a round-robin head-to-head schedule.
 * If the number of teams is odd, a bye team is inserted and matchups with it are omitted.
 * Returns one MatchupSchedule per round (each team plays once per round).
 */
export function generateMatchupSchedule(
  teams: TeamRoster[],
  regularSeasonWeeks = 13,
): MatchupSchedule[] {
  const ids = teams.map((t) => t.teamId);
  // If odd number of teams, add a phantom bye marker
  if (ids.length % 2 !== 0) ids.push("__BYE__");

  const n = ids.length;
  const schedule: MatchupSchedule[] = [];
  let matchupCounter = 0;

  for (let week = 1; week <= regularSeasonWeeks; week++) {
    const roundOffset = (week - 1) % (n - 1);
    const matchups: Matchup[] = [];

    // Fixed team at position 0, rotate the rest
    const rotated = [
      ids[0],
      ...ids
        .slice(1)
        .map((_, i) => ids[1 + ((i + roundOffset) % (n - 1))]),
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

// ─── Context ─────────────────────────────────────────────────────────────────

interface LeagueStateContextValue {
  state: LeagueState;
  dispatch: React.Dispatch<LeagueAction>;
  /**
   * Creates a deep clone of the current live state, assigns it a new session ID,
   * and returns it as a sandbox branch. The live state is never modified.
   * Consumers can call `dispatch({ type: "RESTORE_STATE", state: branch })` to
   * enter the branch, and store the original to restore it later.
   */
  branchSession: () => LeagueState;
  generateDraftMatrix: (teams: TeamRoster[], totalRounds?: number) => DraftSlot[];
  generateMatchupSchedule: (teams: TeamRoster[], regularSeasonWeeks?: number) => MatchupSchedule[];
}

const LeagueStateContext = createContext<LeagueStateContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: LeagueSettings = {
  leagueId: "",
  leagueStyle: "lineup",
  draftType: "snake",
  tieBreakerMetric: "points_for",
  waiverSystem: "faab_with_rolling_tiebreaker",
  draftClockDuration: 90,
  useLeagueMedian: false,
  divisionIds: [],
  scoringRules: {},
  slotRequirements: {},
  rosterCaps: {},
};

function makeInitialState(overrides?: Partial<LeagueState>): LeagueState {
  return {
    sessionId: crypto.randomUUID(),
    branchedFrom: null,
    settings: DEFAULT_SETTINGS,
    players: {},
    teams: {},
    draftSlots: [],
    schedule: [],
    freeAgents: [],
    waiverColumn: [],
    ...overrides,
  };
}

export function LeagueStateProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: Partial<LeagueState>;
}) {
  const [state, dispatch] = useReducer(
    leagueReducer,
    undefined,
    () => makeInitialState(initialState),
  );

  const branchSession = useCallback((): LeagueState => {
    const cloned: LeagueState = JSON.parse(JSON.stringify(state));
    cloned.sessionId = crypto.randomUUID();
    cloned.branchedFrom = state.sessionId;
    return cloned;
  }, [state]);

  const draftMatrixFactory = useCallback(
    (teams: TeamRoster[], totalRounds = 15) =>
      generateDraftMatrix(state.settings, teams, totalRounds),
    [state.settings],
  );

  const scheduleFactory = useCallback(
    (teams: TeamRoster[], regularSeasonWeeks = 13) =>
      generateMatchupSchedule(teams, regularSeasonWeeks),
    [],
  );

  return (
    <LeagueStateContext.Provider
      value={{
        state,
        dispatch,
        branchSession,
        generateDraftMatrix: draftMatrixFactory,
        generateMatchupSchedule: scheduleFactory,
      }}
    >
      {children}
    </LeagueStateContext.Provider>
  );
}

export function useLeagueState(): LeagueStateContextValue {
  const ctx = useContext(LeagueStateContext);
  if (!ctx) {
    throw new Error("useLeagueState must be used within a LeagueStateProvider");
  }
  return ctx;
}
