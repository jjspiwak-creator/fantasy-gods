import { useLocation } from "wouter";
import { User, Bell, BellOff, LogOut, ChevronRight } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useAuth, useShowLeagueWarnings, useUpdateWarningsMutation } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const [, setLocation] = useLocation();
  const { clearSession } = useSession();
  const { user, token, clearAuth } = useAuth();
  const showWarnings = useShowLeagueWarnings();
  const updateWarnings = useUpdateWarningsMutation();

  const handleSignOut = () => {
    clearSession();
    clearAuth();
    setLocation("/");
  };

  const toggleWarnings = () => {
    updateWarnings.mutate(!showWarnings);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-4xl font-display font-bold uppercase">SETTINGS</h1>
        <p className="text-muted-foreground mt-1">App preferences and account management</p>
      </header>

      {/* Account section */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Account</h2>
        <div className="bg-card border border-white/10 rounded-2xl overflow-hidden">
          {user ? (
            <>
              <div className="flex items-center gap-4 p-5 border-b border-white/5">
                <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{user.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-5 py-4 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors text-left"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </>
          ) : (
            <div className="p-5">
              <p className="text-sm text-muted-foreground mb-4">You're browsing as a guest. Create an account to save your trades across devices.</p>
              <button
                onClick={() => setLocation("/")}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 box-glow transition-all"
              >
                Create Account
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Trade Preferences */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Trade Preferences</h2>
        <div className="bg-card border border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-4 p-5">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              showWarnings ? "bg-amber-500/15 text-amber-400" : "bg-secondary text-muted-foreground"
            )}>
              {showWarnings ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm">Show League Rule Warnings</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Display a banner when a simulated trade violates league roster limits.
              </p>
            </div>
            {/* Toggle */}
            <button
              onClick={toggleWarnings}
              disabled={updateWarnings.isPending}
              aria-checked={showWarnings}
              role="switch"
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50",
                showWarnings ? "bg-primary" : "bg-secondary"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform",
                  showWarnings ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">About</h2>
        <div className="bg-card border border-white/10 rounded-2xl p-5 space-y-4">
          {[
            { label: "Multi-Team Trades", desc: "Simulate 3+ team blockbuster trades ESPN can't." },
            { label: "Live Grading", desc: "A+ to F grades based on real-time player values." },
            { label: "Roster Overflow Detection", desc: "Automatic validation catches illegal roster sizes." },
            { label: "Score Refresh", desc: "Refresh saved trades with current season stats." },
          ].map(item => (
            <div key={item.label} className="flex gap-3">
              <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
