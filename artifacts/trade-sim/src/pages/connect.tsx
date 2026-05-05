import { useState } from "react";
import { useLocation } from "wouter";
import { useConnect } from "@/hooks/use-espn-api";
import { useSession } from "@/hooks/use-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, KeyRound, ArrowRight, ClipboardPaste, BookmarkIcon, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const BOOKMARKLET_CODE = `javascript:(function(){function getCookie(n){var m=document.cookie.match(new RegExp('(?:^|;\\s*)'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):'';}var s2=getCookie('espn_s2');var sw=getCookie('SWID');if(!s2||!sw){alert('ESPN cookies not found. Make sure you are logged into ESPN.com first.');return;}var data=JSON.stringify({espnS2:s2,swid:sw});if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(data).then(function(){alert('\\u2705 Credentials copied! Go back to TradeSim and click \\'Paste Credentials\\'.');}).catch(function(){prompt('Copy this and paste in TradeSim:',data);});}else{prompt('Copy this and paste in TradeSim:',data);}})();`;

const STEPS = [
  {
    num: "1",
    title: "Drag the button to your bookmarks bar",
    detail: "If your bookmarks bar is hidden, press Ctrl+Shift+B (or Cmd+Shift+B on Mac) to show it.",
  },
  {
    num: "2",
    title: 'Go to ESPN.com and log in',
    detail: "Make sure you're fully signed into your ESPN account before clicking the bookmarklet.",
  },
  {
    num: "3",
    title: 'Click the "Get ESPN Cookies" bookmark',
    detail: "It will read your credentials and copy them to your clipboard automatically.",
  },
  {
    num: "4",
    title: 'Come back here and click "Paste Credentials"',
    detail: "Both fields will be filled in instantly — no manual copy-paste needed.",
  },
];

export function ConnectPage() {
  const [, setLocation] = useLocation();
  const { sessionId } = useSession();
  const connectMutation = useConnect();

  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
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
        setPasteError("Clipboard doesn't contain ESPN credentials. Use the bookmarklet on ESPN.com first.");
      }
    } catch {
      setPasteError("Could not read clipboard. Make sure you've used the bookmarklet on ESPN.com and allowed clipboard access.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    connectMutation.mutate({ espnS2, swid }, {
      onSuccess: () => setLocation("/leagues"),
    });
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-5xl grid md:grid-cols-2 gap-10 items-start"
      >
        {/* Left column */}
        <div>
          <h1 className="text-5xl font-display font-extrabold mb-4 leading-tight">
            SIMULATE <span className="text-primary text-glow">BLOCKBUSTER</span> MULTI-TEAM TRADES.
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            ESPN only supports 1-on-1 swaps. Connect your account to build, analyze, and score 3+ team blockbuster trades in seconds.
          </p>

          {/* Bookmarklet card */}
          <div className="rounded-2xl bg-secondary/50 border border-white/10 overflow-hidden">
            <div className="p-5 border-b border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <BookmarkIcon className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-white text-base">One-click setup — drag this to your bookmarks bar</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Click it on ESPN.com to copy your credentials automatically. No dev tools required.
              </p>
            </div>

            {/* Drag target */}
            <div className="p-5 flex flex-col items-center gap-4">
              <a
                href={BOOKMARKLET_CODE}
                onClick={(e) => { e.preventDefault(); alert("Drag this button to your bookmarks bar, then visit ESPN.com and click it."); }}
                draggable
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm cursor-grab active:cursor-grabbing select-none shadow-lg hover:bg-primary/90 transition-colors"
              >
                <BookmarkIcon className="w-4 h-4" />
                Get ESPN Cookies
              </a>
              <p className="text-xs text-muted-foreground text-center">
                Drag the button above to your bookmarks bar, then click it while on ESPN.com
              </p>
            </div>

            {/* Steps */}
            <div className="px-5 pb-5 space-y-3">
              {STEPS.map((step) => (
                <div key={step.num} className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {step.num}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security note */}
          <div className="mt-4 flex gap-3 items-start p-4 rounded-xl bg-secondary/30 border border-white/5">
            <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-white">Private & Secure.</strong> Your credentials are only used to fetch league data from ESPN's API. They are never stored permanently — only kept for your current session.
            </p>
          </div>
        </div>

        {/* Right column — form */}
        <Card className="glass-panel overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-6 h-6 text-primary" />
              Connect Account
            </CardTitle>
            <CardDescription>
              Use the bookmarklet above, then paste your credentials here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {/* Paste button */}
              <button
                type="button"
                onClick={handlePasteCredentials}
                className={cn(
                  "w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 transition-all duration-300",
                  pasteSuccess
                    ? "bg-green-500/20 border-green-500 text-green-400"
                    : "bg-white/5 border-white/20 text-white hover:border-primary hover:bg-primary/10 hover:text-primary"
                )}
              >
                {pasteSuccess ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Credentials Pasted!
                  </>
                ) : (
                  <>
                    <ClipboardPaste className="w-5 h-5" />
                    Paste Credentials from Bookmarklet
                  </>
                )}
              </button>

              {pasteError && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  {pasteError}
                </p>
              )}

              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <button
                  type="button"
                  onClick={() => setManualOpen(!manualOpen)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors shrink-0"
                >
                  {manualOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  or enter manually
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
                    <div className="space-y-4 pt-1">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white uppercase tracking-wider">ESPN_S2 Cookie</label>
                        <textarea
                          value={espnS2}
                          onChange={(e) => setEspnS2(e.target.value)}
                          placeholder="AEBf1..."
                          className="w-full h-20 rounded-xl bg-black/40 border-2 border-white/10 px-4 py-3 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-mono resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white uppercase tracking-wider">SWID Cookie</label>
                        <input
                          value={swid}
                          onChange={(e) => setSwid(e.target.value)}
                          placeholder="{A1B2C3D4-E5F6...}"
                          className="w-full rounded-xl bg-black/40 border-2 border-white/10 px-4 py-3 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-mono"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit}>
                <button
                  type="submit"
                  disabled={connectMutation.isPending || (!espnS2 || !swid)}
                  className={cn(
                    "w-full py-3.5 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300",
                    connectMutation.isPending || !espnS2 || !swid
                      ? "bg-primary/30 text-white/50 cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 box-glow hover:-translate-y-0.5"
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
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
