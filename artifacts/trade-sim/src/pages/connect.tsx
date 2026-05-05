import { useState } from "react";
import { useLocation } from "wouter";
import { useConnect } from "@/hooks/use-espn-api";
import { useSession } from "@/hooks/use-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, KeyRound, ArrowRight, ClipboardPaste, BookmarkIcon, CheckCircle2, ChevronDown, ChevronUp, Smartphone, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const BOOKMARKLET_CODE = `javascript:(function(){function getCookie(n){var m=document.cookie.match(new RegExp('(?:^|;\\s*)'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):'';}var s2=getCookie('espn_s2');var sw=getCookie('SWID');if(!s2||!sw){alert('ESPN cookies not found. Make sure you are logged into ESPN.com first.');return;}var data=JSON.stringify({espnS2:s2,swid:sw});if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(data).then(function(){alert('\\u2705 Credentials copied! Go back to TradeSim and click \\'Paste Credentials\\'.');}).catch(function(){prompt('Copy this and paste in TradeSim:',data);});}else{prompt('Copy this and paste in TradeSim:',data);}})();`;

export function ConnectPage() {
  const [, setLocation] = useLocation();
  const { sessionId } = useSession();
  const connectMutation = useConnect();

  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<"desktop" | "mobile">("mobile");
  const [pasteError, setPasteError] = useState("");

  if (sessionId) {
    setLocation("/leagues");
    return null;
  }

  const handlePasteCredentials = async () => {
    setPasteError("");
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      if (data.espnS2 && data.swid) {
        setEspnS2(data.espnS2);
        setSwid(data.swid);
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 3000);
      } else {
        setPasteError("Clipboard doesn't contain ESPN credentials. Follow the steps below first.");
      }
    } catch {
      setPasteError("Could not read clipboard. Make sure you've completed the steps below.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    connectMutation.mutate({ espnS2, swid }, {
      onSuccess: () => setLocation("/leagues"),
    });
  };

  const canSubmit = espnS2.trim().length > 10 && swid.trim().length > 5;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-6 px-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg text-center mb-6"
      >
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold leading-tight mb-2">
          SIMULATE <span className="text-primary">BLOCKBUSTER</span> MULTI-TEAM TRADES
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect your ESPN account to build 3+ team trades. Takes about 2 minutes.
        </p>
      </motion.div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-lg"
      >
        <Card className="glass-panel overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="w-5 h-5 text-primary" />
              Connect ESPN Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Paste button — prominent at top */}
            <button
              type="button"
              onClick={handlePasteCredentials}
              className={cn(
                "w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 transition-all duration-300",
                pasteSuccess
                  ? "bg-green-500/20 border-green-500 text-green-400"
                  : "bg-primary/10 border-primary text-primary hover:bg-primary/20"
              )}
            >
              {pasteSuccess ? (
                <><CheckCircle2 className="w-5 h-5" /> Credentials Pasted!</>
              ) : (
                <><ClipboardPaste className="w-5 h-5" /> Paste Credentials</>
              )}
            </button>

            {pasteError && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                {pasteError}
              </p>
            )}

            {/* Submit */}
            <form onSubmit={handleSubmit}>
              <button
                type="submit"
                disabled={connectMutation.isPending || !canSubmit}
                className={cn(
                  "w-full py-3.5 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300",
                  connectMutation.isPending || !canSubmit
                    ? "bg-primary/30 text-white/40 cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5"
                )}
              >
                {connectMutation.isPending ? "Connecting..." : "Sync My Leagues"}
                {!connectMutation.isPending && <ArrowRight className="w-5 h-5" />}
              </button>
            </form>

            {connectMutation.isError && (
              <p className="text-xs text-destructive text-center">
                {(connectMutation.error as any)?.data?.error || "Failed to connect. Please check your credentials."}
              </p>
            )}

            {/* Manual entry toggle */}
            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <button
                type="button"
                onClick={() => setManualOpen(!manualOpen)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors shrink-0"
              >
                {manualOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                enter manually instead
              </button>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <AnimatePresence>
              {manualOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white uppercase tracking-wider">ESPN_S2 Cookie</label>
                      <textarea
                        value={espnS2}
                        onChange={(e) => setEspnS2(e.target.value)}
                        placeholder="AEBf1..."
                        className="w-full h-20 rounded-xl bg-black/40 border-2 border-white/10 px-4 py-3 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all font-mono resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white uppercase tracking-wider">SWID Cookie</label>
                      <input
                        value={swid}
                        onChange={(e) => setSwid(e.target.value)}
                        placeholder="{A1B2C3D4-E5F6...}"
                        className="w-full rounded-xl bg-black/40 border-2 border-white/10 px-4 py-3 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all font-mono"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* How to get credentials */}
        <div className="mt-4 rounded-2xl bg-secondary/40 border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <p className="text-sm font-bold text-white">How to get your ESPN credentials</p>
            <p className="text-xs text-muted-foreground mt-0.5">ESPN doesn't support third-party sign-in, so you need to copy two cookie values from your account.</p>
          </div>

          {/* Tab toggle */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setHelpTab("mobile")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors",
                helpTab === "mobile" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"
              )}
            >
              <Smartphone className="w-4 h-4" /> On Phone
            </button>
            <button
              onClick={() => setHelpTab("desktop")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors",
                helpTab === "desktop" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"
              )}
            >
              <Monitor className="w-4 h-4" /> On Computer
            </button>
          </div>

          <AnimatePresence mode="wait">
            {helpTab === "mobile" ? (
              <motion.div
                key="mobile"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 space-y-3"
              >
                {[
                  { n: "1", t: "Open ESPN.com on your phone's browser", d: "Use Chrome or Safari — make sure you're logged into your account." },
                  { n: "2", t: 'Copy and paste this into the address bar', d: 'javascript:(function(){function getCookie(n){var m=document.cookie.match(new RegExp("(?:^|;\\s*)"+n+"=([^;]*)"));return m?decodeURIComponent(m[1]):\'\';} var s2=getCookie("espn_s2"),sw=getCookie("SWID");if(!s2||!sw){alert("Not found — make sure you\'re logged in.");return;} var d=JSON.stringify({espnS2:s2,swid:sw}); prompt("Copy all of this:",d);})();', isCode: true },
                  { n: "3", t: "Press Go / Enter", d: "A popup will appear with your credentials. Select all the text and copy it." },
                  { n: "4", t: 'Come back here and tap "Paste Credentials"', d: "Both fields fill in automatically." },
                ].map((step) => (
                  <div key={step.n} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{step.n}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white">{step.t}</p>
                      {(step as any).isCode ? (
                        <div className="mt-1 relative">
                          <textarea
                            readOnly
                            rows={3}
                            value={step.d}
                            className="w-full text-[10px] font-mono bg-black/50 border border-white/10 rounded-lg p-2 text-muted-foreground resize-none"
                            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                          />
                          <p className="text-[10px] text-muted-foreground mt-0.5">Tap the box above to select all, then copy it</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">{step.d}</p>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="desktop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 space-y-4"
              >
                <div className="flex flex-col items-center gap-3">
                  <p className="text-xs text-muted-foreground text-center">Drag this button to your bookmarks bar, then click it on ESPN.com</p>
                  <a
                    href={BOOKMARKLET_CODE}
                    onClick={(e) => { e.preventDefault(); alert("Drag this button to your bookmarks bar, then visit ESPN.com and click it there."); }}
                    draggable
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm cursor-grab active:cursor-grabbing select-none"
                  >
                    <BookmarkIcon className="w-4 h-4" />
                    Get ESPN Cookies
                  </a>
                </div>
                {[
                  { n: "1", t: "Drag the button above to your bookmarks bar", d: "Press Ctrl+Shift+B (or Cmd+Shift+B) to show it if hidden." },
                  { n: "2", t: "Log into ESPN.com", d: "Make sure you're fully signed in." },
                  { n: "3", t: 'Click "Get ESPN Cookies" in your bookmarks', d: "It copies your credentials to the clipboard." },
                  { n: "4", t: 'Come back here and click "Paste Credentials"', d: "Done — both fields fill in instantly." },
                ].map((step) => (
                  <div key={step.n} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{step.n}</span>
                    <div>
                      <p className="text-xs font-semibold text-white">{step.t}</p>
                      <p className="text-xs text-muted-foreground">{step.d}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Security note */}
        <div className="mt-3 flex gap-2 items-start p-3 rounded-xl bg-secondary/20 border border-white/5">
          <Lock className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-white">Private & secure.</strong> Your credentials are only used to fetch data from ESPN's API and are never stored permanently.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
