import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useLeagueTeams,
  useSimulateTradeMutation,
  useSaveTradeMutation,
} from "@/hooks/use-espn-api";
import {
  useEngineHydration,
  useManualEngineHydration,
} from "@/hooks/useEngineHydration";
import { useSession } from "@/hooks/use-session";
import {
  useShowLeagueWarnings,
  useUpdateWarningsMutation,
  useVibePreference,
} from "@/hooks/use-auth";
import { useVibeText } from "@/hooks/use-vibe-text";
import { useGetManualLeagueTeams } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerCard } from "@/components/player-card";
import {
  GitCompareArrows,
  ArrowRight,
  Save,
  Trash2,
  CheckCircle2,
  ChevronRight,
  Scale,
  AlertTriangle,
  X,
  BellOff,
} from "lucide-react";
import { cn, formatTradeValue, getGradeColor, getGradeBg } from "@/lib/utils";
import type {
  TradeSimulationResult,
  TeamTradeResult,
  PlayerTransfer,
  Player,
  Team,
} from "@workspace/api-client-react";

/* ─────────────────────────────────────────────
   Shared inner component — all state + JSX
───────────────────────────────────────────── */
interface TradeBuilderCoreProps {
  teams: Team[] | undefined;
  isLoading: boolean;
  leagueId: string | undefined;
  sessionId?: string;
  showSave: boolean;
}

function TradeBuilderCore({
  teams,
  isLoading,
  leagueId,
  sessionId,
  showSave,
}: TradeBuilderCoreProps) {
  const [, setLocation] = useLocation();
  const simulateMutation = useSimulateTradeMutation();
  const saveMutation = useSaveTradeMutation();
  const showLeagueWarnings = useShowLeagueWarnings();
  const updateWarnings = useUpdateWarningsMutation();
  const vibePreference = useVibePreference();
  const dismissBannerText = useVibeText(
    "Suppress Rule Warnings",
    "Tired of seeing this? Click to hide.",
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [transfers, setTransfers] = useState<PlayerTransfer[]>([]);
  const [simulationResult, setSimulationResult] = useState<TradeSimulationResult | null>(null);
  const [lastTransfers, setLastTransfers] = useState<PlayerTransfer[]>([]);
  const [dropsPerTeam, setDropsPerTeam] = useState<Record<string, string[]>>({});

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  };

  const togglePlayerTransfer = (playerId: string, fromTeamId: string) => {
    setTransfers((prev) => {
      if (prev.some((t) => t.playerId === playerId)) {
        return prev.filter((t) => t.playerId !== playerId);
      }
      const fromIdx = selectedTeamIds.indexOf(fromTeamId);
      const toTeamId = selectedTeamIds[(fromIdx + 1) % selectedTeamIds.length];
      return [...prev, { playerId, fromTeamId, toTeamId }];
    });
  };

  const changeDestination = (playerId: string, toTeamId: string) => {
    setTransfers((prev) =>
      prev.map((t) => (t.playerId === playerId ? { ...t, toTeamId } : t)),
    );
  };

  const toggleDrop = (teamId: string, playerId: string, excess: number) => {
    setDropsPerTeam((prev) => {
      const current = prev[teamId] ?? [];
      if (current.includes(playerId)) {
        return { ...prev, [teamId]: current.filter((id) => id !== playerId) };
      }
      if (current.length >= excess) return prev;
      return { ...prev, [teamId]: [...current, playerId] };
    });
  };

  const overflowResolved =
    !simulationResult?.hasRosterOverflow ||
    simulationResult.teamResults.every((r) => {
      if (!r.rosterOverflow) return true;
      return (dropsPerTeam[r.teamId]?.length ?? 0) >= r.rosterOverflow.excess;
    });

  const handleSimulate = () => {
    if (!leagueId || !teams) return;
    setLastTransfers(transfers);
    setDropsPerTeam({});
    simulateMutation.mutate(
      { sessionId: sessionId ?? "", leagueId, transfers, teams },
      { onSuccess: (res) => { setSimulationResult(res); setStep(3); } },
    );
  };

  const handleSave = () => {
    if (!leagueId || !simulationResult || !overflowResolved) return;
    const names = simulationResult.teamResults.map((t) => t.teamName).join(" & ");
    saveMutation.mutate(
      {
        ...(sessionId ? { sessionId } : {}),
        leagueId,
        name: `Trade: ${names}`,
        result: simulationResult,
        transfers: lastTransfers,
      },
      { onSuccess: () => setLocation("/saved-trades") },
    );
  };

  if (isLoading)
    return (
      <div className="p-12 text-center text-primary font-display animate-pulse">
        LOADING TEAMS...
      </div>
    );
  if (!teams) return null;

  const selectedTeamsData = teams.filter((t) => selectedTeamIds.includes(t.id));
  const hasTransfers = transfers.length > 0;

  return (
    <div className="space-y-8 animate-in fade-in">
      <header className="mb-8">
        <div className="flex items-center gap-4 text-sm text-muted-foreground font-bold uppercase tracking-wider mb-4">
          <div
            className={cn(
              "px-3 py-1 rounded-full border",
              step === 1
                ? "bg-primary text-primary-foreground border-primary box-glow"
                : "border-white/10",
            )}
          >
            1. Select Teams
          </div>
          <ChevronRight className="w-4 h-4" />
          <div
            className={cn(
              "px-3 py-1 rounded-full border",
              step === 2
                ? "bg-primary text-primary-foreground border-primary box-glow"
                : "border-white/10",
            )}
          >
            2. Assign Players
          </div>
          <ChevronRight className="w-4 h-4" />
          <div
            className={cn(
              "px-3 py-1 rounded-full border",
              step === 3
                ? "bg-primary text-primary-foreground border-primary box-glow"
                : "border-white/10",
            )}
          >
            3. Results
          </div>
        </div>
        <h1 className="text-4xl font-display font-bold uppercase">
          TRADE <span className="text-primary">BUILDER</span>
        </h1>
      </header>

      {/* ── STEP 1: SELECT TEAMS ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-secondary/30 border border-white/5 rounded-xl p-6 flex justify-between items-center glass-panel">
            <div>
              <h3 className="text-xl font-bold">Select Participating Teams</h3>
              <p className="text-muted-foreground mt-1">
                Choose 2 or more teams for this blockbuster trade.
              </p>
            </div>
            <button
              disabled={selectedTeamIds.length < 2}
              onClick={() => setStep(2)}
              className="px-6 py-3 rounded-xl font-bold uppercase bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 box-glow transition-all flex items-center gap-2"
            >
              Next Step <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {teams.map((team) => {
              const isSelected = selectedTeamIds.includes(team.id);
              return (
                <div
                  key={team.id}
                  onClick={() => handleTeamToggle(team.id)}
                  className={cn(
                    "cursor-pointer rounded-xl border p-4 transition-all duration-200",
                    isSelected
                      ? "bg-primary/10 border-primary box-glow"
                      : "bg-card hover:border-white/20 border-white/5",
                  )}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h4
                      className={cn(
                        "font-bold text-lg",
                        isSelected ? "text-primary" : "text-white",
                      )}
                    >
                      {team.name}
                    </h4>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{team.ownerName}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 2: ASSIGN PLAYERS WITH DESTINATIONS ── */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-secondary/30 border border-white/5 rounded-xl p-6 flex justify-between items-center glass-panel sticky top-4 z-50">
            <div>
              <h3 className="text-xl font-bold">Assign Players to Their Destinations</h3>
              <p className="text-muted-foreground mt-1">
                Click a player to include them, then choose which team receives them.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 rounded-xl font-bold uppercase border border-white/10 hover:bg-white/5 transition-all"
              >
                Back
              </button>
              <button
                disabled={!hasTransfers || simulateMutation.isPending}
                onClick={handleSimulate}
                className="px-6 py-3 rounded-xl font-bold uppercase bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 box-glow transition-all flex items-center gap-2"
              >
                {simulateMutation.isPending ? "Simulating..." : "Run Simulation"}
                <GitCompareArrows className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {selectedTeamsData.map((team) => {
              const otherTeams = selectedTeamsData.filter((t) => t.id !== team.id);
              return (
                <Card key={team.id} className="border-t-4 border-t-primary/50">
                  <CardHeader className="border-b border-white/5 pb-4 bg-black/20">
                    <CardTitle className="text-xl">{team.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select players this team is giving up and choose where each goes.
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-y-auto p-4 space-y-1.5">
                      {team.roster.map((player) => {
                        const transfer = transfers.find((t) => t.playerId === player.id);
                        const isSelected = !!transfer;
                        return (
                          <div key={player.id}>
                            <PlayerCard
                              player={player}
                              selected={isSelected}
                              onClick={() => togglePlayerTransfer(player.id, team.id)}
                              compact
                            />
                            {isSelected && otherTeams.length > 0 && (
                              <div className="flex items-center gap-2 px-3 pt-1 pb-1.5">
                                <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                                <span className="text-xs text-muted-foreground shrink-0">
                                  Send to
                                </span>
                                <select
                                  value={transfer.toTeamId}
                                  onChange={(e) =>
                                    changeDestination(player.id, e.target.value)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-1 min-w-0 text-xs bg-background border border-primary/30 rounded-lg px-2 py-1 text-primary focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                                >
                                  {otherTeams.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {hasTransfers && (
            <div className="bg-card border border-white/10 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Transfer Summary
              </h4>
              {selectedTeamsData.map((team) => {
                const outgoing = transfers.filter((t) => t.fromTeamId === team.id);
                if (outgoing.length === 0) return null;
                return (
                  <div key={team.id} className="space-y-1">
                    {outgoing.map((tr) => {
                      const player = team.roster.find((p) => p.id === tr.playerId);
                      const destTeam = selectedTeamsData.find((t) => t.id === tr.toTeamId);
                      if (!player) return null;
                      return (
                        <div key={tr.playerId} className="flex items-center gap-2 text-sm">
                          <span className="text-white font-semibold truncate">{player.name}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-primary font-medium truncate">
                            {destTeam?.name ?? "?"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: RESULTS ── */}
      {step === 3 && simulationResult && (
        <div className="space-y-8">
          <div className="flex justify-between items-center glass-panel p-6 rounded-2xl">
            <div>
              <h2 className="text-3xl font-display font-bold">
                SIMULATION <span className="text-primary">COMPLETE</span>
              </h2>
              <p className="text-muted-foreground flex items-center gap-2 mt-1">
                <Scale className="w-4 h-4" /> Overall Balance:
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    simulationResult.overallBalance >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {formatTradeValue(simulationResult.overallBalance)}
                </span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-xl font-bold uppercase border border-white/10 hover:bg-white/5 transition-all"
              >
                Edit Trade
              </button>
              {showSave && (
                <button
                  disabled={saveMutation.isPending || !overflowResolved}
                  onClick={handleSave}
                  className="px-6 py-3 rounded-xl font-bold uppercase bg-primary text-primary-foreground hover:bg-primary/90 box-glow transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-5 h-5" />{" "}
                  {saveMutation.isPending ? "Saving..." : "Save Trade"}
                </button>
              )}
            </div>
          </div>

          {simulationResult.hasRosterOverflow && (
            <RosterOverflowSection
              teamResults={simulationResult.teamResults}
              dropsPerTeam={dropsPerTeam}
              onToggleDrop={toggleDrop}
              resolved={overflowResolved}
            />
          )}

          {showLeagueWarnings && simulationResult.leagueWarnings.length > 0 && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 overflow-hidden">
              <div className="flex items-start gap-3 px-5 py-4">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-amber-300 text-sm">League Rule Notice</p>
                  <ul className="mt-1 space-y-1">
                    {simulationResult.leagueWarnings.map((w, i) => (
                      <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => updateWarnings.mutate(false)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors shrink-0 px-2 py-1 rounded-lg hover:bg-white/5"
                  title="Hide league warning banners"
                >
                  <BellOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{dismissBannerText}</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid xl:grid-cols-2 gap-8">
            {simulationResult.teamResults.map((result) => (
              <TradeResultCard
                key={result.teamId}
                result={result}
                droppedIds={dropsPerTeam[result.teamId] ?? []}
              />
            ))}
          </div>

          {vibePreference === "the_boys" && (
            <div className="rounded-2xl border border-[#08d4f0]/20 bg-[#08d4f0]/5 px-6 py-5 flex items-start gap-4">
              <div className="shrink-0 w-9 h-9 rounded-full bg-[#08d4f0]/15 flex items-center justify-center mt-0.5">
                <span className="text-lg">🏈</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">
                  Thank you for being part of the movement.
                </span>{" "}
                If this app saved your season, tell your friends—we need more numbers!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   ESPN variant (existing flow)
───────────────────────────────────────────── */
export function TradeBuilderPage() {
  const { leagueId } = useParams();
  const { sessionId } = useSession();
  const { data: teams, isLoading } = useLeagueTeams(leagueId || "");
  useEngineHydration(leagueId, teams);
  return (
    <TradeBuilderCore
      teams={teams}
      isLoading={isLoading}
      leagueId={leagueId}
      sessionId={sessionId ?? ""}
      showSave={!!sessionId}
    />
  );
}

/* ─────────────────────────────────────────────
   Manual league variant — uses R4 teams; save blocked (Branch B)
   SessionId is not available for manual leagues; save is hidden.
───────────────────────────────────────────── */
export function ManualTradeBuilderPage() {
  const { leagueId } = useParams();
  const { data: teams, isLoading } = useGetManualLeagueTeams(leagueId || "");
  useManualEngineHydration(leagueId, teams);
  return (
    <TradeBuilderCore
      teams={teams}
      isLoading={isLoading}
      leagueId={leagueId}
      showSave={true}
    />
  );
}

/* ─────────────────────────────────────────────
   Roster Overflow Section — force drop picks
───────────────────────────────────────────── */
function RosterOverflowSection({
  teamResults,
  dropsPerTeam,
  onToggleDrop,
  resolved,
}: {
  teamResults: TeamTradeResult[];
  dropsPerTeam: Record<string, string[]>;
  onToggleDrop: (teamId: string, playerId: string, excess: number) => void;
  resolved: boolean;
}) {
  const overflowing = teamResults.filter((r) => r.rosterOverflow);
  if (overflowing.length === 0) return null;

  const totalExcess = overflowing.reduce((s, r) => s + (r.rosterOverflow?.excess ?? 0), 0);
  const totalDropped = overflowing.reduce(
    (s, r) => s + (dropsPerTeam[r.teamId]?.length ?? 0),
    0,
  );

  return (
    <div
      className={cn(
        "rounded-2xl border-2 overflow-hidden transition-colors",
        resolved ? "border-success/40 bg-success/5" : "border-amber-500/40 bg-amber-500/5",
      )}
    >
      <div
        className={cn(
          "px-6 py-4 flex items-center gap-3",
          resolved ? "bg-success/10" : "bg-amber-500/10",
        )}
      >
        {resolved ? (
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
        )}
        <div className="flex-1">
          <h3
            className={cn("font-bold text-lg", resolved ? "text-success" : "text-amber-300")}
          >
            {resolved ? "Roster Drops Resolved" : "Roster Overflow — Action Required"}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {resolved
              ? "All drops selected. You can now save this trade."
              : `${overflowing.length} team${overflowing.length > 1 ? "s" : ""} will exceed their roster limit. Select players to drop before saving.`}
          </p>
        </div>
        <span
          className={cn(
            "font-display font-bold text-2xl tabular-nums",
            resolved ? "text-success" : "text-amber-300",
          )}
        >
          {totalDropped}/{totalExcess}
        </span>
      </div>

      {!resolved && (
        <div className="p-6 space-y-6">
          {overflowing.map((result) => {
            const excess = result.rosterOverflow!.excess;
            const picked = dropsPerTeam[result.teamId] ?? [];
            const remaining = excess - picked.length;

            return (
              <div key={result.teamId} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white">{result.teamName}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Receiving {result.playersReceived.length} · Giving{" "}
                      {result.playersGiven.length} · Net +{excess}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-bold px-3 py-1 rounded-full border",
                      remaining > 0
                        ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
                        : "text-success border-success/40 bg-success/10",
                    )}
                  >
                    {remaining > 0 ? `Drop ${remaining} more` : "✓ Done"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  Choose {excess} player{excess > 1 ? "s" : ""} from {result.teamName}'s
                  post-trade roster to release:
                </p>

                <div className="space-y-1.5">
                  {result.rosterAfter.map((player) => {
                    const isDropped = picked.includes(player.id);
                    const isNewlyReceived = result.playersReceived.some(
                      (p) => p.id === player.id,
                    );
                    const isDisabled =
                      isNewlyReceived || (!isDropped && picked.length >= excess);

                    return (
                      <div
                        key={player.id}
                        onClick={() =>
                          !isDisabled && onToggleDrop(result.teamId, player.id, excess)
                        }
                        className={cn(
                          "group relative overflow-hidden rounded-xl border p-3 transition-all duration-200 flex items-center gap-3",
                          isDropped
                            ? "bg-destructive/10 border-destructive/50 cursor-pointer"
                            : isDisabled
                              ? "bg-secondary/20 border-white/5 cursor-not-allowed opacity-50"
                              : "bg-secondary/40 border-white/5 cursor-pointer hover:border-amber-500/40 hover:bg-amber-500/5",
                        )}
                      >
                        <div className="w-10 h-10 rounded-lg bg-secondary border border-white/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-muted-foreground uppercase">
                            {player.position}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm truncate">
                              {player.name}
                            </span>
                            {isNewlyReceived && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/20 shrink-0">
                                New
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {player.nflTeam} · {player.tradeValue.toFixed(1)} val
                          </span>
                        </div>

                        <div
                          className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                            isDropped
                              ? "bg-destructive border-destructive"
                              : "border-white/20 bg-transparent",
                          )}
                        >
                          {isDropped && <X className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Individual team result card
───────────────────────────────────────────── */
function TradeResultCard({
  result,
  droppedIds,
}: {
  result: TeamTradeResult;
  droppedIds: string[];
}) {
  const gradeColor = getGradeColor(result.grade);
  const gradeBg = getGradeBg(result.grade);

  return (
    <Card className="overflow-hidden border border-white/10 bg-card/80">
      <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 bg-black/20">
        <div className="min-w-0">
          <h3 className="font-bold text-lg text-white truncate">{result.teamName}</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
            {result.ownerName}
          </p>
        </div>
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 px-4 py-2 ml-4 shrink-0",
            gradeBg,
          )}
        >
          <span className={cn("font-display text-4xl font-black leading-none", gradeColor)}>
            {result.grade}
          </span>
          <span className={cn("text-xs font-bold mt-0.5", gradeColor)}>
            {result.score}/100
          </span>
        </div>
      </div>

      <div className={cn("px-5 py-2 text-xs font-medium border-b border-white/5", gradeColor, "bg-black/10")}>
        {result.gradeRationale}
      </div>

      <div className="px-5 py-3 flex items-center gap-3 border-b border-white/5 bg-black/10">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
          Value Change
        </span>
        <span
          className={cn(
            "font-display text-xl font-bold tabular-nums",
            result.tradeValueChange > 0
              ? "text-success"
              : result.tradeValueChange < 0
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        >
          {formatTradeValue(result.tradeValueChange)}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {result.tradeValueBefore.toFixed(1)} → {result.tradeValueAfter.toFixed(1)}
        </span>
        {result.rosterOverflow && (
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full ml-2">
            +{result.rosterOverflow.excess} overflow
          </span>
        )}
      </div>

      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
        <div className="p-5 space-y-3">
          <h4 className="text-xs font-bold text-destructive flex items-center gap-1.5 uppercase tracking-wider">
            <Trash2 className="w-3.5 h-3.5" /> Giving
          </h4>
          <div className="space-y-1.5">
            {result.playersGiven.length > 0 ? (
              result.playersGiven.map((p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  compact
                  className="bg-destructive/5 border-destructive/20"
                />
              ))
            ) : (
              <div className="text-sm text-muted-foreground italic">None</div>
            )}
          </div>
        </div>
        <div className="p-5 space-y-3">
          <h4 className="text-xs font-bold text-success flex items-center gap-1.5 uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" /> Receiving
          </h4>
          <div className="space-y-1.5">
            {result.playersReceived.length > 0 ? (
              result.playersReceived.map((p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  compact
                  className="bg-success/5 border-success/20"
                />
              ))
            ) : (
              <div className="text-sm text-muted-foreground italic">None</div>
            )}
            {droppedIds.length > 0 && (
              <div className="pt-2 border-t border-white/5">
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Dropping
                </h5>
                <div className="space-y-1.5">
                  {result.rosterAfter
                    .filter((p) => droppedIds.includes(p.id))
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20"
                      >
                        <X className="w-3 h-3 text-destructive shrink-0" />
                        <span className="text-xs font-semibold text-white truncate">
                          {p.name}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {p.tradeValue.toFixed(1)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
