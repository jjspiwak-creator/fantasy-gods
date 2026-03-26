import { useParams, Link } from "wouter";
import { useLeagueTeams } from "@/hooks/use-espn-api";
import { Card, CardContent } from "@/components/ui/card";
import { GitCompareArrows, Users, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export function LeagueDetailsPage() {
  const { leagueId } = useParams();
  const { data: teams, isLoading } = useLeagueTeams(leagueId || "");

  if (isLoading) {
    return <div className="text-center p-12 text-muted-foreground animate-pulse font-display text-xl">LOADING ROSTERS...</div>;
  }

  if (!teams || teams.length === 0) {
    return <div>No teams found for this league.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Link href="/leagues" className="text-sm text-muted-foreground hover:text-primary mb-2 flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Leagues
          </Link>
          <h1 className="text-4xl font-display font-bold uppercase">LEAGUE <span className="text-primary">ROSTERS</span></h1>
        </div>
        <Link href={`/leagues/${leagueId}/trade-builder`}>
          <button className="px-6 py-3 rounded-xl font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 box-glow hover:-translate-y-0.5 transition-all flex items-center gap-2">
            <GitCompareArrows className="w-5 h-5" />
            Build Trade
          </button>
        </Link>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        {teams.map((team, idx) => (
          <motion.div
            key={team.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card className="h-full border-t-4 border-t-primary/50 flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white">{team.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Users className="w-4 h-4" /> {team.ownerName}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Record</div>
                    <div className="font-display text-xl font-bold text-primary">
                      {team.wins}-{team.losses}-{team.ties}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-auto">
                  <div className="flex justify-between text-xs uppercase text-muted-foreground font-bold border-b border-white/10 pb-2 mb-2">
                    <span>Pos</span>
                    <span>Player</span>
                    <span>Value</span>
                  </div>
                  {team.roster.slice(0, 5).map(player => (
                    <div key={player.id} className="flex items-center gap-3 py-1">
                      <span className={`text-[10px] w-8 text-center font-bold px-1 py-0.5 rounded bg-white/5 border border-white/10`}>
                        {player.position}
                      </span>
                      <span className="text-sm text-white font-medium truncate flex-1">{player.name}</span>
                      <span className="text-sm font-display font-bold text-primary tabular-nums">{player.tradeValue.toFixed(1)}</span>
                    </div>
                  ))}
                  {team.roster.length > 5 && (
                    <div className="text-center text-xs text-muted-foreground pt-2 mt-2 border-t border-white/5">
                      + {team.roster.length - 5} more players
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
