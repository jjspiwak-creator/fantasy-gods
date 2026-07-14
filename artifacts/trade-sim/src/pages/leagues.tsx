import { useState } from "react";
import { useUserLeagues } from "@/hooks/use-espn-api";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Users, Calendar, ArrowRight, Plus, LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { useSession } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";
import { useListMyManualLeagues } from "@workspace/api-client-react";
import { CreateLeagueModal } from "@/components/manual/CreateLeagueModal";
import { JoinLeagueModal } from "@/components/manual/JoinLeagueModal";

export function LeaguesPage() {
  const { data: espnLeagues, isLoading: espnLoading, error: espnError } = useUserLeagues();
  const { sessionId } = useSession();
  const token = useAuth((s) => s.token);
  const [, setLocation] = useLocation();

  const manualLeaguesQuery = useListMyManualLeagues();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  if (!token) {
    setLocation("/");
    return null;
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* ── MANUAL LEAGUES SECTION ── */}
      <section className="space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold">
              MANUAL <span className="text-primary">LEAGUES</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              League-agnostic war rooms you build and manage yourself.
            </p>
          </div>
          <div className="flex gap-2 self-start sm:self-auto">
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-xl font-bold text-sm border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create
            </button>
            <button
              onClick={() => setShowJoin(true)}
              className="px-4 py-2 rounded-xl font-bold text-sm border border-white/10 hover:bg-white/5 transition-colors flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4" /> Join
            </button>
          </div>
        </header>

        {manualLeaguesQuery.isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 h-32 flex flex-col justify-between">
                  <div className="w-2/3 h-5 bg-white/10 rounded" />
                  <div className="w-1/3 h-4 bg-white/5 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : manualLeaguesQuery.data && manualLeaguesQuery.data.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {manualLeaguesQuery.data.map((item, idx) => (
              <motion.div
                key={item.league.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
              >
                <Link href={`/manual-leagues/${item.league.id}`}>
                  <Card className="group cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/50 transition-all duration-300 h-full bg-secondary/20">
                    <CardContent className="p-6 flex flex-col h-full relative overflow-hidden">
                      <div className="absolute -right-6 -top-6 text-white/5 group-hover:text-primary/5 transition-colors duration-300">
                        <Trophy className="w-28 h-28" />
                      </div>
                      <h3 className="text-xl font-display font-bold text-white mb-4 relative z-10 group-hover:text-primary transition-colors">
                        {item.league.name}
                      </h3>
                      <div className="mt-auto flex items-center gap-2 text-sm text-muted-foreground relative z-10">
                        <Users className="w-4 h-4 text-primary" />
                        <span className="font-bold text-white">
                          {item.league.teamCount} Teams
                        </span>
                      </div>
                      <div className="absolute bottom-6 right-6 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center box-glow">
                          <ArrowRight className="w-4 h-4 text-primary-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="text-center p-10 glass-panel">
            <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No manual leagues yet.</p>
            <div className="flex gap-3 justify-center mt-4">
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Create a League
              </button>
              <button
                onClick={() => setShowJoin(true)}
                className="px-5 py-2 rounded-xl font-bold text-sm border border-white/10 hover:bg-white/5 transition-colors"
              >
                Join with Code
              </button>
            </div>
          </Card>
        )}
      </section>

      {/* ── ESPN LEAGUES SECTION (only when sessionId exists) ── */}
      {sessionId && (
        <section className="space-y-6">
          <header>
            <h2 className="text-3xl font-display font-bold">
              ESPN <span className="text-primary">LEAGUES</span>
            </h2>
            <p className="text-muted-foreground mt-1">
              Select a league to view rosters and build trades.
            </p>
          </header>

          {espnLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6 h-40 flex flex-col justify-between">
                    <div className="w-2/3 h-6 bg-white/10 rounded" />
                    <div className="space-y-2">
                      <div className="w-1/2 h-4 bg-white/5 rounded" />
                      <div className="w-1/3 h-4 bg-white/5 rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : espnError ? (
            <Card className="bg-destructive/10 border-destructive/20 text-destructive text-center p-8">
              <p>Failed to load leagues. Your session may have expired.</p>
              <Link href="/" className="underline font-bold mt-2 inline-block">
                Reconnect
              </Link>
            </Card>
          ) : espnLeagues?.length === 0 ? (
            <Card className="text-center p-12 glass-panel">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold">No active leagues found</h3>
              <p className="text-muted-foreground mt-2">
                Make sure your ESPN account is currently active in fantasy football leagues.
              </p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {espnLeagues?.map((league, idx) => (
                <motion.div
                  key={league.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Link href={`/leagues/${league.id}`}>
                    <Card className="group cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/50 transition-all duration-300 h-full bg-secondary/20">
                      <CardContent className="p-6 flex flex-col h-full relative overflow-hidden">
                        <div className="absolute -right-6 -top-6 text-white/5 group-hover:text-primary/5 transition-colors duration-300">
                          <Trophy className="w-32 h-32" />
                        </div>
                        <h3 className="text-2xl font-display font-bold text-white mb-6 relative z-10 group-hover:text-primary transition-colors">
                          {league.name}
                        </h3>
                        <div className="mt-auto grid grid-cols-2 gap-4 relative z-10">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-black/20 p-2 rounded-lg">
                            <Users className="w-4 h-4 text-primary" />
                            <span className="font-bold text-white">{league.teamCount} Teams</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-black/20 p-2 rounded-lg">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span className="font-bold text-white">Season {league.season}</span>
                          </div>
                        </div>
                        <div className="absolute bottom-6 right-6 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center box-glow">
                            <ArrowRight className="w-5 h-5 text-primary-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      )}

      {showCreate && (
        <CreateLeagueModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            setLocation(`/manual-leagues/${id}`);
          }}
        />
      )}
      {showJoin && (
        <JoinLeagueModal
          onClose={() => setShowJoin(false)}
          onJoined={(id) => {
            setShowJoin(false);
            setLocation(`/manual-leagues/${id}`);
          }}
        />
      )}
    </div>
  );
}
