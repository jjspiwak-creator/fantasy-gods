import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, Trophy, Save, LogOut, GitCompareArrows } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { sessionId, username, clearSession } = useSession();

  const handleLogout = () => {
    clearSession();
    setLocation("/");
  };

  const navItems = [
    { href: "/leagues", icon: Trophy, label: "My Leagues" },
    { href: "/saved-trades", icon: Save, label: "Saved Trades" },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background w-full">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 bg-card/50 backdrop-blur-md flex flex-col z-10">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/50 flex items-center justify-center box-glow">
            <GitCompareArrows className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold leading-none tracking-wide text-white">TRADE<span className="text-primary">SIM</span></h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Multi-Team Engine</p>
          </div>
        </div>

        {sessionId ? (
          <div className="flex-1 px-4 py-4 flex flex-col gap-2">
            <div className="px-3 py-2 mb-4 rounded-lg bg-white/5 border border-white/5">
              <p className="text-xs text-muted-foreground font-medium uppercase">Connected As</p>
              <p className="text-sm font-bold text-white truncate">{username || 'Manager'}</p>
            </div>

            <nav className="flex-1 space-y-1">
              {navItems.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive 
                        ? "bg-primary/10 text-primary border border-primary/20 box-glow" 
                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <button 
              onClick={handleLogout}
              className="mt-auto flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">
            Connect your ESPN account to view your leagues and build trades.
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col h-screen">
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-0">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
