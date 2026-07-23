import { useState } from "react";
import { useLocation } from "wouter";
import { User, Bell, BellOff, LogOut, ChevronRight, Trash2 } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useAuth, useShowLeagueWarnings, useUpdateWarningsMutation } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { deleteAccount } from "@workspace/api-client-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

export function SettingsPage() {
  const [, setLocation] = useLocation();
  const { sessionId, clearSession } = useSession();
  const { user, token, clearAuth } = useAuth();
  const showWarnings = useShowLeagueWarnings();
  const updateWarnings = useUpdateWarningsMutation();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSignOut = () => {
    clearSession();
    clearAuth();
    setLocation("/");
  };

  const toggleWarnings = () => {
    updateWarnings.mutate(!showWarnings);
  };

  const deleteMutation = useMutation({
    mutationFn: (password: string) =>
      deleteAccount(
        { password },
        sessionId
          ? { headers: { "X-Session-Id": sessionId } }
          : undefined,
      ),
    onSuccess: () => {
      clearAuth();
      clearSession();
      setDeleteOpen(false);
      setLocation("/");
    },
    onError: (err: any) => {
      const status = err?.response?.status ?? err?.status;
      if (status === 403) {
        setDeleteError("Incorrect password.");
      } else {
        setDeleteError("Something went wrong. Please try again.");
      }
    },
  });

  const handleDeleteConfirm = () => {
    setDeleteError(null);
    deleteMutation.mutate(deletePassword);
  };

  const handleDeleteOpenChange = (open: boolean) => {
    if (!open) {
      setDeletePassword("");
      setDeleteError(null);
      deleteMutation.reset();
    }
    setDeleteOpen(open);
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
                className="w-full flex items-center gap-3 px-5 py-4 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors text-left border-b border-white/5"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                className="w-full flex items-center gap-3 px-5 py-4 text-sm font-medium text-destructive/70 hover:bg-destructive/5 hover:text-destructive transition-colors text-left"
              >
                <Trash2 className="w-4 h-4" />
                Delete account
              </button>

              <AlertDialog open={deleteOpen} onOpenChange={handleDeleteOpenChange}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <span className="block">
                        This is permanent. Your login, saved trades, and the ESPN connection on this browser will be deleted. Teams you manage in shared leagues will remain as &ldquo;Deleted Manager&rdquo; so those leagues keep working. Leagues you created where no one else has claimed a team will be deleted entirely.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="px-1 pb-1 space-y-2">
                    <Input
                      type="password"
                      placeholder="Enter your password to confirm"
                      value={deletePassword}
                      onChange={(e) => {
                        setDeletePassword(e.target.value);
                        setDeleteError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && deletePassword && !deleteMutation.isPending) {
                          handleDeleteConfirm();
                        }
                      }}
                      autoComplete="current-password"
                    />
                    {deleteError && (
                      <p className="text-sm text-destructive">{deleteError}</p>
                    )}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteMutation.isPending}>
                      Cancel
                    </AlertDialogCancel>
                    <button
                      onClick={handleDeleteConfirm}
                      disabled={!deletePassword || deleteMutation.isPending}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-4 py-2 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                      {deleteMutation.isPending ? "Deleting…" : "Delete"}
                    </button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
