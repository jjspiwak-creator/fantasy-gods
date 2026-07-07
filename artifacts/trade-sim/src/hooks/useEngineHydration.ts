import { useEffect } from "react";
import { buildEngineState } from "@/utils/engineHydration";
import { useLeagueState } from "@/context/LeagueStateContext";
import type { Team } from "@workspace/api-client-react";

/**
 * Thin hook: when `teams` data is available, hydrates the engine state context
 * (settings, players, teams) by running buildEngineState and dispatching the
 * three bulk actions.
 *
 * Contract:
 * - No-op while `teams` is undefined/null (data still loading).
 * - Never refetches anything — callers own the query lifecycle.
 * - Stable: re-runs only when the teams reference changes (react-query gives a
 *   new reference on each successful fetch, so this is correct).
 */
export function useEngineHydration(
  leagueId: string | undefined,
  teams: Team[] | undefined,
): void {
  const { dispatch } = useLeagueState();

  useEffect(() => {
    if (!leagueId || !teams || teams.length === 0) return;

    const { settings, players, teams: engineTeams } = buildEngineState(leagueId, teams);

    dispatch({ type: "SET_SETTINGS", settings });
    dispatch({ type: "BATCH_SET_PLAYERS", players });
    dispatch({ type: "BATCH_SET_TEAMS", teams: engineTeams });
  }, [leagueId, teams, dispatch]);
}
