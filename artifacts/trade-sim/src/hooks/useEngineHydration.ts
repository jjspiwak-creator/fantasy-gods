import { useEffect } from "react";
import { buildEngineState } from "@workspace/engine";
import { useLeagueState } from "@/context/LeagueStateContext";
import { useLeagueSettings } from "@/hooks/use-espn-api";
import type { Team } from "@workspace/api-client-react";

/**
 * Thin hook: when `teams` data is available, hydrates the engine state context
 * (settings, players, teams) by running buildEngineState and dispatching the
 * three bulk actions.
 *
 * Also fetches the real league rulebook via useLeagueSettings(leagueId), in
 * parallel with the teams query the caller already ran. When that settings
 * fetch succeeds, the real rulebook is used; if it errors, synthesized
 * defaults are used (identical to pre-WO7c behavior). While it is still
 * pending, hydration waits so the two queries don't race.
 *
 * Contract:
 * - No-op while `teams` is undefined/null (data still loading).
 * - Never refetches anything — callers own the query lifecycle.
 * - Stable: re-runs only when the teams/settings reference or status changes
 *   (react-query gives a new reference on each successful fetch, so this is
 *   correct).
 */
export function useEngineHydration(
  leagueId: string | undefined,
  teams: Team[] | undefined,
): void {
  const { dispatch } = useLeagueState();
  const settingsQ = useLeagueSettings(leagueId || "");

  useEffect(() => {
    if (!leagueId || !teams || teams.length === 0) return;
    if (!settingsQ.isSuccess && !settingsQ.isError) return;

    const { settings, players, teams: engineTeams } = settingsQ.isSuccess
      ? buildEngineState(leagueId, teams, settingsQ.data)
      : buildEngineState(leagueId, teams);

    dispatch({ type: "SET_SETTINGS", settings });
    dispatch({ type: "BATCH_SET_PLAYERS", players });
    dispatch({ type: "BATCH_SET_TEAMS", teams: engineTeams });
  }, [leagueId, teams, settingsQ.isSuccess, settingsQ.isError, settingsQ.data, dispatch]);
}
