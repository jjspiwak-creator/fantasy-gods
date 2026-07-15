import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Trophy, Save, LogOut, GitCompareArrows, Wifi, WifiOff, Settings, User } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { sessionId, username, clearSession } = useSession();
  const { user, token, clearAuth } = useAuth();

  const handleLogout = () => {
    clearSession();
    clearAuth();
    setLocation("/");
  };

  const accountNavItems = [
    { href: "/leagues", icon: Trophy, label: "Leagues" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  const espnNavItems = [
    { href: "/saved-trades", icon: Save, label: "Saved" },
  ];

  const isConnected = !!sessionId;
  const isLoggedIn = !!token || !!sessionId;

  const renderNavLink = (item: { href: string; icon: React.ElementType; label: string }) => {
    const isActive = location.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
          isActive
            ? "bg-primary/10 text-primary border border-primary/20"
            : "text-muted-foreground hover:text-white hover:bg-white/5"
        )}
      >
        <item.icon className="w-3.5 h-3.5" />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background w-full">

      {/* Top header — always visible */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-card/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Logo */}
          <Link href={isLoggedIn ? "/leagues" : "/"}>
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/50 flex items-center justify-center">
                <GitCompareArrows className="w-4 h-4 text-primary" />
              </div>
              <div className="leading-none">
                <span className="text-base font-display font-bold text-white">TRADE<span className="text-primary">SIM</span></span>
              </div>
            </div>
          </Link>

          {/* Right side */}
          {isConnected ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5">
                <Wifi className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-white truncate max-w-[120px]">{username || "Manager"}</span>
                {user && (
                  <>
                    <div className="w-px h-3 bg-white/20" />
                    <User className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">{user.email}</span>
                  </>
                )}
              </div>
              {/* Desktop nav — account + ESPN items */}
              <nav className="hidden sm:flex items-center gap-1">
                {accountNavItems.map(renderNavLink)}
                {espnNavItems.map(renderNavLink)}
              </nav>
              <button
                onClick={handleLogout}
                title="Disconnect"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-transparent hover:border-destructive/20"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Disconnect</span>
              </button>
            </div>
          ) : isLoggedIn ? (
            <div className="flex items-center gap-3">
              {user && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5">
                  <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
                  <User className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">{user.email}</span>
                </div>
              )}
              {/* Desktop nav — account items only (no ESPN-required links) */}
              <nav className="hidden sm:flex items-center gap-1">
                {accountNavItems.map(renderNavLink)}
              </nav>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5">
              <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Not connected</span>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 sm:pb-8">
        <div className="max-w-6xl mx-auto w-full px-4 py-6">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav — visible when logged in (account items always; ESPN items only when connected) */}
      {isLoggedIn && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-card/90 backdrop-blur-md">
          <div className="flex">
            {accountNavItems.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
                  {item.label}
                </Link>
              );
            })}
            {isConnected && espnNavItems.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
                  {item.label}
                </Link>
              );
            })}
            {isConnected && (
              <button
                onClick={handleLogout}
                className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Out
              </button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
