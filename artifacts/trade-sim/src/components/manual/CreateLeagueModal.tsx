import { useState } from "react";
import {
  useCreateManualLeague,
  getListMyManualLeaguesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface CreateLeagueModalProps {
  onClose: () => void;
  onCreated: (leagueId: string) => void;
}

const SCORING_PRESETS = [
  { key: "standard" as const, label: "Standard", points: 0 },
  { key: "half_ppr" as const, label: "Half-PPR", points: 0.5 },
  { key: "ppr" as const, label: "PPR", points: 1 },
];

type ScoringPreset = "standard" | "half_ppr" | "ppr";

const DEFAULT_SLOTS = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1, BENCH: 6 };

export function CreateLeagueModal({ onClose, onCreated }: CreateLeagueModalProps) {
  const queryClient = useQueryClient();
  const mutation = useCreateManualLeague();

  const [name, setName] = useState("");
  const [teamCount, setTeamCount] = useState(10);
  const [myTeamName, setMyTeamName] = useState("");
  const [preset, setPreset] = useState<ScoringPreset>("ppr");
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [done, setDone] = useState<{ inviteCode: string; leagueId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scoringPreset = SCORING_PRESETS.find((p) => p.key === preset)!;
    mutation.mutate(
      {
        data: {
          name,
          teamCount,
          myTeamName: myTeamName.trim() || undefined,
          rosterSlots: slots,
          scoringBasics: { preset, receptionPoints: scoringPreset.points },
        },
      },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListMyManualLeaguesQueryKey() });
          setDone({ inviteCode: data.league.inviteCode, leagueId: data.league.id });
        },
      },
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(done!.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <Card className="w-full max-w-md glass-panel animate-in fade-in">
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-2xl font-display font-bold text-primary">League Created!</h2>
            <p className="text-muted-foreground">Share this invite code with your league mates.</p>
            <div className="flex items-center justify-center gap-3 bg-black/30 rounded-xl p-4 border border-white/10">
              <span className="text-3xl font-display font-black tracking-widest text-white">
                {done.inviteCode}
              </span>
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                title="Copy invite code"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => onCreated(done.leagueId)}
                className="px-6 py-2 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                View League
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 rounded-xl font-bold border border-white/10 hover:bg-white/5 transition-colors"
              >
                Close
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <Card className="w-full max-w-lg glass-panel animate-in fade-in my-4">
        <CardContent className="p-8">
          <h2 className="text-2xl font-display font-bold mb-6">Create League</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                League Name *
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="My Fantasy League"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Team Count *
              </label>
              <input
                required
                type="number"
                min={2}
                max={20}
                value={teamCount}
                onChange={(e) => setTeamCount(Number(e.target.value))}
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Your Team Name
              </label>
              <input
                value={myTeamName}
                onChange={(e) => setMyTeamName(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Scoring *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SCORING_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPreset(p.key)}
                    className={`py-2 rounded-xl font-bold text-sm border transition-colors ${
                      preset === p.key
                        ? "bg-primary text-primary-foreground border-primary box-glow"
                        : "border-white/10 hover:bg-white/5"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Roster Slots *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(slots) as Array<keyof typeof slots>).map((pos) => (
                  <div key={pos} className="space-y-1">
                    <label className="text-xs text-muted-foreground font-bold">{pos}</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={slots[pos]}
                      onChange={(e) =>
                        setSlots((s) => ({ ...s, [pos]: Number(e.target.value) }))
                      }
                      className="w-full bg-background border border-white/10 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                ))}
              </div>
            </div>

            {mutation.isError && (
              <p className="text-destructive text-sm">
                {(mutation.error as any)?.response?.data?.error ?? "Failed to create league."}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 py-3 rounded-xl font-bold uppercase bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {mutation.isPending ? "Creating..." : "Create League"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-xl font-bold border border-white/10 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
