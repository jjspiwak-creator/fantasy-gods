import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { GitCompareArrows, Mail, Lock, Eye, EyeOff, UserCircle2, Users } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useAuth, useRegisterMutation, useLoginMutation } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type Mode = "welcome" | "login" | "register";

export function AuthPage() {
  const [, setLocation] = useLocation();
  const { sessionId } = useSession();
  const token = useAuth((s) => s.token);
  const [mode, setMode] = useState<Mode>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const registerMutation = useRegisterMutation();
  const loginMutation = useLoginMutation();

  // If already connected to ESPN → skip ahead to leagues
  useEffect(() => {
    if (sessionId) setLocation("/leagues");
  }, [sessionId]);

  // If already have a JWT but no ESPN session → go to connect
  useEffect(() => {
    if (token && !sessionId) setLocation("/connect");
  }, [token, sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "register") {
      registerMutation.mutate(
        { email, password },
        { onSuccess: () => setLocation("/connect") }
      );
    } else {
      loginMutation.mutate(
        { email, password },
        { onSuccess: () => setLocation("/connect") }
      );
    }
  };

  const isPending = registerMutation.isPending || loginMutation.isPending;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/50 flex items-center justify-center box-glow">
          <GitCompareArrows className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-black uppercase leading-none tracking-wide">
            TRADE<span className="text-primary">SIM</span>
          </h1>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-0.5">ESPN Fantasy</p>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Welcome card */}
        {mode === "welcome" && (
          <div className="space-y-3 animate-in fade-in">
            <p className="text-center text-muted-foreground text-sm mb-6">
              Simulate blockbuster multi-team trades your league doesn't know are possible.
            </p>

            <button
              onClick={() => setMode("register")}
              className="w-full flex items-center gap-3 px-5 py-4 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 box-glow transition-all"
            >
              <UserCircle2 className="w-5 h-5" />
              Create Account
            </button>

            <button
              onClick={() => setMode("login")}
              className="w-full flex items-center gap-3 px-5 py-4 rounded-xl border border-white/20 text-white font-bold hover:bg-white/5 transition-all"
            >
              <Lock className="w-5 h-5 text-muted-foreground" />
              Sign In
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
              <div className="relative flex justify-center"><span className="bg-background px-3 text-xs text-muted-foreground uppercase tracking-widest">or</span></div>
            </div>

            <button
              onClick={() => setLocation("/connect")}
              className="w-full flex items-center gap-3 px-5 py-4 rounded-xl border border-white/10 text-muted-foreground font-medium hover:text-white hover:border-white/20 transition-all text-sm"
            >
              <Users className="w-4 h-4" />
              Continue as Guest
              <span className="ml-auto text-xs">No account required</span>
            </button>

            <p className="text-center text-xs text-muted-foreground mt-2 leading-relaxed">
              Accounts let you access saved trades across devices and store preferences.
            </p>
          </div>
        )}

        {/* Register / Login form */}
        {(mode === "register" || mode === "login") && (
          <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in">
            <button
              type="button"
              onClick={() => setMode("welcome")}
              className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1 mb-2"
            >
              ← Back
            </button>

            <h2 className="text-xl font-bold text-white">
              {mode === "register" ? "Create your account" : "Welcome back"}
            </h2>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-secondary/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password
                {mode === "register" && <span className="font-normal ml-1">(min. 8 characters)</span>}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                  required
                  minLength={mode === "register" ? 8 : 1}
                  className="w-full bg-secondary/40 border border-white/10 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-primary/90 box-glow transition-all"
            >
              {isPending ? "Please wait..." : mode === "register" ? "Create Account" : "Sign In"}
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
              <div className="relative flex justify-center"><span className="bg-background px-3 text-xs text-muted-foreground uppercase tracking-widest">or</span></div>
            </div>

            <button
              type="button"
              onClick={() => setLocation("/connect")}
              className="w-full py-3 rounded-xl border border-white/10 text-muted-foreground text-sm font-medium hover:text-white hover:border-white/20 transition-all"
            >
              Continue as Guest instead
            </button>

            <p className="text-center text-xs text-muted-foreground">
              {mode === "register" ? "Already have an account? " : "Don't have an account? "}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setMode(mode === "register" ? "login" : "register")}
              >
                {mode === "register" ? "Sign in" : "Create one"}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
