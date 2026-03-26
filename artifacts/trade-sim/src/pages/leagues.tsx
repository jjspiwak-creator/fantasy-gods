import { useUserLeagues } from "@/hooks/use-espn-api";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Users, Calendar, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useSession } from "@/hooks/use-session";

export function LeaguesPage() {
  const { data: leagues, isLoading, error } = useUserLeagues();
  const { sessionId } = useSession();
  const [, setLocation] = useLocation();

  if (!sessionId) {
    setLocation("/");
    return null;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-display font-bold">YOUR <span className="text-primary">LEAGUES</span></h1>
        <p className="text-muted-foreground mt-2">Select a league to view rosters and build trades.</p>
      </header>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-40 flex flex-col justify-between">
                <div className="w-2/3 h-6 bg-white/10 rounded"></div>
                <div className="space-y-2">
                  <div className="w-1/2 h-4 bg-white/5 rounded"></div>
                  <div className="w-1/3 h-4 bg-white/5 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="bg-destructive/10 border-destructive/20 text-destructive text-center p-8">
          <p>Failed to load leagues. Your session may have expired.</p>
          <Link href="/" className="underline font-bold mt-2 inline-block">Reconnect</Link>
        </Card>
      ) : leagues?.length === 0 ? (
        <Card className="text-center p-12 glass-panel">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-bold">No active leagues found</h3>
          <p className="text-muted-foreground mt-2">Make sure your ESPN account is currently active in fantasy football leagues.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leagues?.map((league, idx) => (
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
    </div>
  );
}
