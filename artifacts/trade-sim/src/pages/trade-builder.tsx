import { useState, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useLeagueTeams, useSimulateTradeMutation, useSaveTradeMutation } from "@/hooks/use-espn-api";
import { useSession } from "@/hooks/use-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerCard } from "@/components/player-card";
import { GitCompareArrows, ArrowRight, Save, Trash2, CheckCircle2, ChevronRight, Scale } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatTradeValue, getVerdictColor } from "@/lib/utils";
import type { TradeSimulationResult, TeamTradeResult } from "@workspace/api-client-react";

export function TradeBuilderPage() {
  const { leagueId } = useParams();
  const { sessionId } = useSession();
  const [, setLocation] = useLocation();
  const { data: teams, isLoading } = useLeagueTeams(leagueId || "");
  const simulateMutation = useSimulateTradeMutation();
  const saveMutation = useSaveTradeMutation();

  // State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  // Record<teamId, array of playerId>
  const [givingPlayers, setGivingPlayers] = useState<Record<string, string[]>>({});
  const [simulationResult, setSimulationResult] = useState<TradeSimulationResult | null>(null);

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeamIds(prev => 
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const handlePlayerToggle = (teamId: string, playerId: string) => {
    setGivingPlayers(prev => {
      const teamPlayers = prev[teamId] || [];
      const newPlayers = teamPlayers.includes(playerId)
        ? teamPlayers.filter(id => id !== playerId)
        : [...teamPlayers, playerId];
      return { ...prev, [teamId]: newPlayers };
    });
  };

  const handleSimulate = async () => {
    if (!sessionId || !leagueId || !teams) return;
    
    const participants = selectedTeamIds.map(teamId => ({
      teamId,
      givingPlayerIds: givingPlayers[teamId] || []
    }));

    simulateMutation.mutate(
      { sessionId, leagueId, participants, teams },
      { onSuccess: (res) => {
          setSimulationResult(res);
          setStep(3);
      }}
    );
  };

  const handleSave = () => {
    if (!sessionId || !leagueId || !simulationResult) return;
    const names = simulationResult.teamResults.map(t => t.teamName).join(' & ');
    saveMutation.mutate(
      { sessionId, leagueId, name: `Trade: ${names}`, result: simulationResult },
      { onSuccess: () => setLocation('/saved-trades') }
    );
  };

  if (isLoading) return <div className="p-12 text-center text-primary font-display animate-pulse">LOADING TEAMS...</div>;
  if (!teams) return null;

  const selectedTeamsData = teams.filter(t => selectedTeamIds.includes(t.id));
  const hasPlayersSelected = Object.values(givingPlayers).some(arr => arr.length > 0);

  return (
    <div className="space-y-8 animate-in fade-in">
      <header className="mb-8">
        <div className="flex items-center gap-4 text-sm text-muted-foreground font-bold uppercase tracking-wider mb-4">
          <div className={cn("px-3 py-1 rounded-full border", step === 1 ? "bg-primary text-primary-foreground border-primary box-glow" : "border-white/10")}>1. Select Teams</div>
          <ChevronRight className="w-4 h-4" />
          <div className={cn("px-3 py-1 rounded-full border", step === 2 ? "bg-primary text-primary-foreground border-primary box-glow" : "border-white/10")}>2. Add Players</div>
          <ChevronRight className="w-4 h-4" />
          <div className={cn("px-3 py-1 rounded-full border", step === 3 ? "bg-primary text-primary-foreground border-primary box-glow" : "border-white/10")}>3. Results</div>
        </div>
        <h1 className="text-4xl font-display font-bold uppercase">TRADE <span className="text-primary">BUILDER</span></h1>
      </header>

      {/* STEP 1: SELECT TEAMS */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-secondary/30 border border-white/5 rounded-xl p-6 flex justify-between items-center glass-panel">
            <div>
              <h3 className="text-xl font-bold">Select Participating Teams</h3>
              <p className="text-muted-foreground mt-1">Choose 2 or more teams to include in this blockbuster trade.</p>
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

      {/* STEP 2: SELECT PLAYERS */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-secondary/30 border border-white/5 rounded-xl p-6 flex justify-between items-center glass-panel sticky top-4 z-50">
            <div>
              <h3 className="text-xl font-bold">Select Players to Trade</h3>
              <p className="text-muted-foreground mt-1">Select the players each team is giving away.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setStep(1)}
                className="px-6 py-3 rounded-xl font-bold uppercase border border-white/10 hover:bg-white/5 transition-all"
              >
                Back
              </button>
              <button 
                disabled={!hasPlayersSelected || simulateMutation.isPending}
                onClick={handleSimulate}
                className="px-6 py-3 rounded-xl font-bold uppercase bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 box-glow transition-all flex items-center gap-2"
              >
                {simulateMutation.isPending ? "Simulating..." : "Run Simulation"}
                <GitCompareArrows className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {selectedTeamsData.map((team, idx) => {
              const teamGivingIds = givingPlayers[team.id] || [];
              const receiverIdx = (idx + 1) % selectedTeamsData.length;
              const receivingTeam = selectedTeamsData[receiverIdx];

              return (
                <Card key={team.id} className="border-t-4 border-t-primary/50">
                  <CardHeader className="border-b border-white/5 pb-4 bg-black/20">
                    <CardTitle className="text-xl">{team.name}</CardTitle>
                    <div className="text-sm font-medium text-primary flex items-center gap-2 mt-2 bg-primary/10 w-max px-3 py-1 rounded-full border border-primary/20">
                      Sending players to <ArrowRight className="w-4 h-4" /> {receivingTeam.name}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-y-auto p-4 space-y-2">
                      {team.roster.map(player => (
                        <PlayerCard
                          key={player.id}
                          player={player}
                          selected={teamGivingIds.includes(player.id)}
                          onClick={() => handlePlayerToggle(team.id, player.id)}
                          compact
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 3: RESULTS */}
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
  return (
    <Card className={cn("overflow-hidden border-2", getVerdictColor(result.verdict).split(' ')[1])}>
      <div className={cn("px-6 py-4 flex justify-between items-center border-b", getVerdictColor(result.verdict).split(' ')[2])}>
        <div>
          <h3 className="font-bold text-xl text-white">{result.teamName}</h3>
          <p className="text-sm opacity-80 uppercase tracking-wider font-bold">{result.verdict}</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase font-bold opacity-80 mb-1">Value Change</div>
          <div className={cn("font-display text-3xl font-bold tabular-nums", getVerdictColor(result.verdict).split(' ')[0])}>
            {formatTradeValue(result.tradeValueChange)}
          </div>
        </div>
      </div>
      
      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10 bg-black/20">
        <div className="p-6 space-y-4">
          <h4 className="text-sm font-bold text-destructive flex items-center gap-2 uppercase tracking-wider">
            <Trash2 className="w-4 h-4" /> Giving
          </h4>
          <div className="space-y-2">
            {result.playersGiven.length > 0 ? result.playersGiven.map(p => (
              <PlayerCard key={p.id} player={p} compact className="bg-destructive/5 border-destructive/20" />
            )) : <div className="text-sm text-muted-foreground">None</div>}
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <h4 className="text-sm font-bold text-success flex items-center gap-2 uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" /> Receiving
          </h4>
          <div className="space-y-2">
            {result.playersReceived.length > 0 ? result.playersReceived.map(p => (
              <PlayerCard key={p.id} player={p} compact className="bg-success/5 border-success/20" />
            )) : <div className="text-sm text-muted-foreground">None</div>}
          </div>
        </div>
      </div>
      
      <div className="px-6 py-4 bg-card border-t border-white/5 flex justify-between items-center text-sm font-medium">
        <span className="text-muted-foreground">Roster Value Before: <span className="text-white">{result.tradeValueBefore.toFixed(1)}</span></span>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">After: <span className="text-white">{result.tradeValueAfter.toFixed(1)}</span></span>
      </div>
    </Card>
  );
}
