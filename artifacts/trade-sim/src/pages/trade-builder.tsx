import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useLeagueTeams, useSimulateTradeMutation, useSaveTradeMutation } from "@/hooks/use-espn-api";
import { useSession } from "@/hooks/use-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerCard } from "@/components/player-card";
import { GitCompareArrows, ArrowRight, Save, Trash2, CheckCircle2, ChevronRight, Scale } from "lucide-react";
import { cn, formatTradeValue, getGradeColor, getGradeBg } from "@/lib/utils";
import type { TradeSimulationResult, TeamTradeResult, PlayerTransfer } from "@workspace/api-client-react";

export function TradeBuilderPage() {
  const { leagueId } = useParams();
  const { sessionId } = useSession();
  const [, setLocation] = useLocation();
  const { data: teams, isLoading } = useLeagueTeams(leagueId || "");
  const simulateMutation = useSimulateTradeMutation();
  const saveMutation = useSaveTradeMutation();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [transfers, setTransfers] = useState<PlayerTransfer[]>([]);
  const [simulationResult, setSimulationResult] = useState<TradeSimulationResult | null>(null);
  const [lastTransfers, setLastTransfers] = useState<PlayerTransfer[]>([]);

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeamIds(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  /** Toggle a player into/out of the transfer matrix.
   *  Default destination: first other selected team (convenient for 2-team trades,
   *  and can be changed via the inline selector). */
  const togglePlayerTransfer = (playerId: string, fromTeamId: string) => {
    setTransfers(prev => {
      if (prev.some(t => t.playerId === playerId)) {
        return prev.filter(t => t.playerId !== playerId);
      }
      const fromIdx = selectedTeamIds.indexOf(fromTeamId);
      const toTeamId = selectedTeamIds[(fromIdx + 1) % selectedTeamIds.length];
      return [...prev, { playerId, fromTeamId, toTeamId }];
    });
  };

  /** Change where a selected player is being sent. */
  const changeDestination = (playerId: string, toTeamId: string) => {
    setTransfers(prev => prev.map(t => t.playerId === playerId ? { ...t, toTeamId } : t));
  };

  const handleSimulate = () => {
    if (!sessionId || !leagueId || !teams) return;
    setLastTransfers(transfers);
    simulateMutation.mutate(
      { sessionId, leagueId, transfers, teams },
      { onSuccess: (res) => { setSimulationResult(res); setStep(3); } }
    );
  };

  const handleSave = () => {
    if (!sessionId || !leagueId || !simulationResult) return;
    const names = simulationResult.teamResults.map(t => t.teamName).join(" & ");
    saveMutation.mutate(
      { sessionId, leagueId, name: `Trade: ${names}`, result: simulationResult, transfers: lastTransfers },
      { onSuccess: () => setLocation("/saved-trades") }
    );
  };

  if (isLoading) return <div className="p-12 text-center text-primary font-display animate-pulse">LOADING TEAMS...</div>;
  if (!teams) return null;

  const selectedTeamsData = teams.filter(t => selectedTeamIds.includes(t.id));
  const hasTransfers = transfers.length > 0;

  return (
    <div className="space-y-8 animate-in fade-in">
      <header className="mb-8">
        <div className="flex items-center gap-4 text-sm text-muted-foreground font-bold uppercase tracking-wider mb-4">
          <div className={cn("px-3 py-1 rounded-full border", step === 1 ? "bg-primary text-primary-foreground border-primary box-glow" : "border-white/10")}>1. Select Teams</div>
          <ChevronRight className="w-4 h-4" />
          <div className={cn("px-3 py-1 rounded-full border", step === 2 ? "bg-primary text-primary-foreground border-primary box-glow" : "border-white/10")}>2. Assign Players</div>
          <ChevronRight className="w-4 h-4" />
          <div className={cn("px-3 py-1 rounded-full border", step === 3 ? "bg-primary text-primary-foreground border-primary box-glow" : "border-white/10")}>3. Results</div>
        </div>
        <h1 className="text-4xl font-display font-bold uppercase">TRADE <span className="text-primary">BUILDER</span></h1>
      </header>

      {/* ── STEP 1: SELECT TEAMS ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-secondary/30 border border-white/5 rounded-xl p-6 flex justify-between items-center glass-panel">
            <div>
              <h3 className="text-xl font-bold">Select Participating Teams</h3>
              <p className="text-muted-foreground mt-1">Choose 2 or more teams for this blockbuster trade.</p>
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
            {teams.map(team => {
              const isSelected = selectedTeamIds.includes(team.id);
              return (
                <div
                  key={team.id}
                  onClick={() => handleTeamToggle(team.id)}
                  className={cn(
                    "cursor-pointer rounded-xl border p-4 transition-all duration-200",
                    isSelected
                      ? "bg-primary/10 border-primary box-glow"
                      : "bg-card hover:border-white/20 border-white/5"
                  )}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h4 className={cn("font-bold text-lg", isSelected ? "text-primary" : "text-white")}>{team.name}</h4>
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
            {selectedTeamsData.map(team => {
              const otherTeams = selectedTeamsData.filter(t => t.id !== team.id);

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
                      {team.roster.map(player => {
                        const transfer = transfers.find(t => t.playerId === player.id);
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
                                <span className="text-xs text-muted-foreground shrink-0">Send to</span>
                                <select
                                  value={transfer.toTeamId}
                                  onChange={e => changeDestination(player.id, e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  className="flex-1 min-w-0 text-xs bg-background border border-primary/30 rounded-lg px-2 py-1 text-primary focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                                >
                                  {otherTeams.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
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

          {/* Live summary of transfers */}
          {hasTransfers && (
            <div className="bg-card border border-white/10 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Transfer Summary</h4>
              {selectedTeamsData.map(team => {
                const outgoing = transfers.filter(t => t.fromTeamId === team.id);
                if (outgoing.length === 0) return null;
                return (
                  <div key={team.id} className="space-y-1">
                    {outgoing.map(tr => {
                      const player = team.roster.find(p => p.id === tr.playerId);
                      const destTeam = selectedTeamsData.find(t => t.id === tr.toTeamId);
                      if (!player) return null;
                      return (
                        <div key={tr.playerId} className="flex items-center gap-2 text-sm">
                          <span className="text-white font-semibold truncate">{player.name}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-primary font-medium truncate">{destTeam?.name ?? "?"}</span>
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
              <h2 className="text-3xl font-display font-bold">SIMULATION <span className="text-primary">COMPLETE</span></h2>
              <p className="text-muted-foreground flex items-center gap-2 mt-1">
                <Scale className="w-4 h-4" /> Overall Balance:
                <span className={cn("font-bold tabular-nums", simulationResult.overallBalance >= 0 ? "text-success" : "text-destructive")}>
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
              <button
                disabled={saveMutation.isPending}
                onClick={handleSave}
                className="px-6 py-3 rounded-xl font-bold uppercase bg-primary text-primary-foreground hover:bg-primary/90 box-glow transition-all flex items-center gap-2"
              >
                <Save className="w-5 h-5" /> {saveMutation.isPending ? "Saving..." : "Save Trade"}
              </button>
            </div>
          </div>

          <div className="grid xl:grid-cols-2 gap-8">
            {simulationResult.teamResults.map(result => (
              <TradeResultCard key={result.teamId} result={result} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TradeResultCard({ result }: { result: TeamTradeResult }) {
  const gradeColor = getGradeColor(result.grade);
  const gradeBg = getGradeBg(result.grade);

  return (
    <Card className="overflow-hidden border border-white/10 bg-card/80">
      <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 bg-black/20">
        <div className="min-w-0">
          <h3 className="font-bold text-lg text-white truncate">{result.teamName}</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{result.ownerName}</p>
        </div>
        <div className={cn("flex flex-col items-center justify-center rounded-xl border-2 px-4 py-2 ml-4 shrink-0", gradeBg)}>
          <span className={cn("font-display text-4xl font-black leading-none", gradeColor)}>{result.grade}</span>
          <span className={cn("text-xs font-bold mt-0.5", gradeColor)}>{result.score}/100</span>
        </div>
      </div>

      <div className={cn("px-5 py-2 text-xs font-medium border-b border-white/5", gradeColor, "bg-black/10")}>
        {result.gradeRationale}
      </div>

      <div className="px-5 py-3 flex items-center gap-3 border-b border-white/5 bg-black/10">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Value Change</span>
        <span className={cn(
          "font-display text-xl font-bold tabular-nums",
          result.tradeValueChange > 0 ? "text-success" : result.tradeValueChange < 0 ? "text-destructive" : "text-muted-foreground"
        )}>
          {formatTradeValue(result.tradeValueChange)}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {result.tradeValueBefore.toFixed(1)} → {result.tradeValueAfter.toFixed(1)}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
        <div className="p-5 space-y-3">
          <h4 className="text-xs font-bold text-destructive flex items-center gap-1.5 uppercase tracking-wider">
            <Trash2 className="w-3.5 h-3.5" /> Giving
          </h4>
          <div className="space-y-1.5">
            {result.playersGiven.length > 0
              ? result.playersGiven.map(p => <PlayerCard key={p.id} player={p} compact className="bg-destructive/5 border-destructive/20" />)
              : <div className="text-sm text-muted-foreground italic">None</div>}
          </div>
        </div>
        <div className="p-5 space-y-3">
          <h4 className="text-xs font-bold text-success flex items-center gap-1.5 uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" /> Receiving
          </h4>
          <div className="space-y-1.5">
            {result.playersReceived.length > 0
              ? result.playersReceived.map(p => <PlayerCard key={p.id} player={p} compact className="bg-success/5 border-success/20" />)
              : <div className="text-sm text-muted-foreground italic">None</div>}
          </div>
        </div>
      </div>
    </Card>
  );
}
