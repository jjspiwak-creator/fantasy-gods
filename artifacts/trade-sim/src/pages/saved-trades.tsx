import { useSavedTradesList, useDeleteTradeMutation } from "@/hooks/use-espn-api";
import { useSession } from "@/hooks/use-session";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTradeValue, getVerdictColor, cn } from "@/lib/utils";
import { Trash2, Scale, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";

export function SavedTradesPage() {
  const { sessionId } = useSession();
  const [, setLocation] = useLocation();
  const { data: trades, isLoading } = useSavedTradesList();
  const deleteMutation = useDeleteTradeMutation();

  if (!sessionId) {
    setLocation("/");
    return null;
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      <header>
        <h1 className="text-4xl font-display font-bold">SAVED <span className="text-primary">TRADES</span></h1>
        <p className="text-muted-foreground mt-2">Review your past multi-team simulation scenarios.</p>
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
          {trades?.map((trade, idx) => (
            <motion.div
              key={trade.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="overflow-hidden glass-panel group hover:border-primary/30 transition-colors">
                <div className="bg-black/30 px-6 py-4 flex justify-between items-center border-b border-white/5">
                  <div>
                    <h3 className="text-lg font-bold text-white">{trade.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <CalendarDays className="w-3 h-3" />
                      {new Date(trade.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button 
                    onClick={() => deleteMutation.mutate(trade.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete saved trade"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <CardContent className="p-0">
                  <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/5">
                    {trade.result.teamResults.map(tr => (
                      <div key={tr.teamId} className="p-6 space-y-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-white">{tr.teamName}</span>
                          <span className={cn("text-sm font-bold uppercase px-2 py-0.5 rounded", getVerdictColor(tr.verdict))}>
                            {formatTradeValue(tr.tradeValueChange)}
                          </span>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1 block">Receiving</span>
                            <div className="flex flex-wrap gap-1">
                              {tr.playersReceived.length ? tr.playersReceived.map(p => (
                                <span key={p.id} className="text-xs px-2 py-1 bg-success/10 text-success border border-success/20 rounded-md truncate max-w-full">
                                  {p.name}
                                </span>
                              )) : <span className="text-xs text-muted-foreground">None</span>}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1 block">Giving</span>
                            <div className="flex flex-wrap gap-1">
                              {tr.playersGiven.length ? tr.playersGiven.map(p => (
                                <span key={p.id} className="text-xs px-2 py-1 bg-destructive/10 text-destructive border border-destructive/20 rounded-md truncate max-w-full">
                                  {p.name}
                                </span>
                              )) : <span className="text-xs text-muted-foreground">None</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
