import { useState } from "react";
import { useLocation } from "wouter";
import { useConnect } from "@/hooks/use-espn-api";
import { useSession } from "@/hooks/use-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Lock, KeyRound, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ConnectPage() {
  const [, setLocation] = useLocation();
  const { sessionId } = useSession();
  const connectMutation = useConnect();
  
  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");

  // Redirect if already connected
  if (sessionId) {
    setLocation("/leagues");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    connectMutation.mutate({ espnS2, swid }, {
      onSuccess: () => setLocation("/leagues")
    });
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center"
      >
        <div>
          <h1 className="text-5xl font-display font-extrabold mb-4 leading-tight">
            SIMULATE <span className="text-primary text-glow">BLOCKBUSTER</span> MULTI-TEAM TRADES.
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            ESPN limits you to simple 1-on-1 swaps. Connect your account to build, analyze, and grade massive 3+ team blockbuster scenarios using advanced trade value algorithms.
          </p>
          
          <div className="space-y-4">
            <div className="flex gap-4 items-start p-4 rounded-xl bg-secondary/50 border border-white/5">
              <div className="bg-primary/20 p-2 rounded-lg text-primary mt-1 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white mb-1">Private & Secure</h4>
                <p className="text-sm text-muted-foreground">Your cookies are only used locally to fetch your league data from ESPN. We don't store them.</p>
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-secondary/30 border border-white/5">
              <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                How to find your cookies
              </h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside ml-2">
                <li>Log into ESPN.com on your computer</li>
                <li>Right click anywhere and select "Inspect"</li>
                <li>Go to the <strong>Application</strong> tab (or Storage)</li>
                <li>On the left, expand <strong>Cookies</strong> and click espn.com</li>
                <li>Find the rows named <strong>espn_s2</strong> and <strong>SWID</strong></li>
                <li>Copy those values into the form here</li>
              </ol>
            </div>
          </div>
        </div>

        <Card className="glass-panel overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0"></div>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-6 h-6 text-primary" />
              Connect Account
            </CardTitle>
            <CardDescription>
              Enter your ESPN credentials to sync your private leagues.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-white uppercase tracking-wider">ESPN_S2 Cookie</label>
                <textarea 
                  required
                  value={espnS2}
                  onChange={(e) => setEspnS2(e.target.value)}
                  placeholder="AEBf1..."
                  className="w-full h-24 rounded-xl bg-black/40 border-2 border-white/10 px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-mono resize-none"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-white uppercase tracking-wider">SWID Cookie</label>
                <input 
                  required
                  value={swid}
                  onChange={(e) => setSwid(e.target.value)}
                  placeholder="{A1B2C3D4-E5F6...}"
                  className="w-full rounded-xl bg-black/40 border-2 border-white/10 px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={connectMutation.isPending}
                className={cn(
                  "w-full py-3.5 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300",
                  connectMutation.isPending 
                    ? "bg-primary/50 text-white cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 box-glow hover:-translate-y-0.5"
                )}
              >
                {connectMutation.isPending ? "Connecting..." : "Sync Leagues"}
                {!connectMutation.isPending && <ArrowRight className="w-5 h-5" />}
              </button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
