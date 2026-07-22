import { useSavedTradesList, useDeleteTradeMutation, useRefreshTradeMutation } from "@/hooks/use-espn-api";
import { useSession } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { cn, getGradeColor, getGradeBg } from "@/lib/utils";
import { Trash2, Scale, CalendarDays, RefreshCw, Clock } from "lucide-react";
import { motion } from "framer-motion";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function isStale(dateStr: string): boolean {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff > 60 * 60 * 1000; // stale after 1 hour
}

export function SavedTradesPage() {
  const { sessionId } = useSession();
  const [, setLocation] = useLocation();
  const { data: trades, isLoading } = useSavedTradesList();
  const deleteMutation = useDeleteTradeMutation();
  const refreshMutation = useRefreshTradeMutation();
  const token = useAuth(s => s.token);

  if (!sessionId && !token) {
    setLocation("/");
    return null;
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      <header>
        <h1 className="text-4xl font-display font-bold">SAVED <span className="text-primary">TRADES</span></h1>
        <p className="text-muted-foreground mt-2">Scores refresh automatically using live ESPN player values.</p>
      </header>

      {isLoading ? (
        <div className="grid gap-6 animate-pulse">
          {[1,2].map(i => <div key={i} className="h-48 bg-card rounded-xl border border-white/5"></div>)}
        </div>
      ) : trades?.length === 0 ? (
        <Card className="text-center p-12 glass-panel">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-bold">No saved trades</h3>
          <p className="text-muted-foreground mt-2 mb-6">Build and save a trade simulation to see it here.</p>
          <Link href="/leagues">
            <button className="px-6 py-3 rounded-xl font-bold uppercase bg-primary text-primary-foreground hover:bg-primary/90 box-glow transition-all">
              Go to Leagues
            </button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-6">
          {trades?.map((trade, idx) => {
            const stale = isStale(trade.lastRefreshedAt);
            const isRefreshing = refreshMutation.isPending && refreshMutation.variables === trade.id;

            return (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
              >
                <Card className="overflow-hidden glass-panel border border-white/10">
                  {/* Header */}
                  <div className="bg-black/30 px-5 py-4 flex flex-wrap justify-between items-center gap-y-2 border-b border-white/5">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white truncate">{trade.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {new Date(trade.createdAt).toLocaleDateString()}
                        </span>
                        <span className={cn(
                          "text-xs flex items-center gap-1 font-medium",
                          stale ? "text-yellow-400" : "text-muted-foreground"
                        )}>
                          <Clock className="w-3 h-3" />
                          Scores: {timeAgo(trade.lastRefreshedAt)}
                          {stale && " · outdated"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <button
                        onClick={() => refreshMutation.mutate(trade.id)}
                        disabled={isRefreshing}
                        title="Refresh trade scores with current ESPN data"
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all border",
                          stale
                            ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10 hover:bg-yellow-400/20"
                            : "text-muted-foreground border-white/10 hover:bg-white/5"
                        )}
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                        {isRefreshing ? "Refreshing..." : "Refresh"}
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(trade.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete saved trade"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Team results */}
                  <CardContent className="p-0">
                    <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/5">
                      {trade.result.teamResults.map(tr => {
                        const grade = (tr as any).grade as string | undefined;
                        const score = (tr as any).score as number | undefined;
                        const rationale = (tr as any).gradeRationale as string | undefined;

                        return (
                          <div key={tr.teamId} className="p-5 space-y-3">
                            {/* Team name + grade */}
                            <div className="flex justify-between items-start gap-3">
                              <div className="min-w-0">
                                <span className="font-bold text-white block truncate">{tr.teamName}</span>
                                <span className="text-xs text-muted-foreground">{(tr as any).ownerName}</span>
                              </div>
                              {grade && (
                                <div className={cn(
                                  "flex flex-col items-center justify-center rounded-lg border-2 px-3 py-1 shrink-0",
                                  getGradeBg(grade)
                                )}>
                                  <span className={cn("font-display text-2xl font-black leading-none", getGradeColor(grade))}>
                                    {grade}
                                  </span>
                                  {score !== undefined && (
                                    <span className={cn("text-xs font-bold", getGradeColor(grade))}>
                                      {score}/100
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Rationale */}
                            {rationale && (
                              <p className="text-xs text-muted-foreground italic">{rationale}</p>
                            )}


                            {/* Players */}
                            <div className="space-y-2">
                              <div>
                                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1 block">Receiving</span>
                                <div className="flex flex-wrap gap-1">
                                  {tr.playersReceived.length ? tr.playersReceived.map(p => (
                                    <span key={p.id} className="text-xs px-2 py-0.5 bg-success/10 text-success border border-success/20 rounded-md">
                                      {p.name}
                                    </span>
                                  )) : <span className="text-xs text-muted-foreground">None</span>}
                                </div>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1 block">Giving</span>
                                <div className="flex flex-wrap gap-1">
                                  {tr.playersGiven.length ? tr.playersGiven.map(p => (
                                    <span key={p.id} className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
                                      {p.name}
                                    </span>
                                  )) : <span className="text-xs text-muted-foreground">None</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
