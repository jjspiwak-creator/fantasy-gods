import { useState } from "react";
import {
  useJoinManualLeague,
  getListMyManualLeaguesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";

interface JoinLeagueModalProps {
  onClose: () => void;
  onJoined: (leagueId: string) => void;
}

export function JoinLeagueModal({ onClose, onJoined }: JoinLeagueModalProps) {
  const queryClient = useQueryClient();
  const mutation = useJoinManualLeague();
  const [inviteCode, setInviteCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    mutation.mutate(
      {
        data: {
          inviteCode: inviteCode.trim().toUpperCase(),
          teamName: teamName.trim() || undefined,
        },
      },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListMyManualLeaguesQueryKey() });
          onJoined(data.league.id);
        },
        onError: (err: any) => {
          const status = err?.response?.status;
          if (status === 404)
            setErrorMsg("Invite code not found. Check the code and try again.");
          else if (status === 409)
            setErrorMsg("This league is full. No open team slots remain.");
          else setErrorMsg(err?.response?.data?.error ?? "Failed to join league.");
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="w-full max-w-md glass-panel animate-in fade-in">
        <CardContent className="p-8">
          <h2 className="text-2xl font-display font-bold mb-6">Join League</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Invite Code *
              </label>
              <input
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-white font-mono tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="ABCD1234"
                maxLength={8}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Team Name
              </label>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="Optional"
              />
            </div>
            {errorMsg && <p className="text-destructive text-sm">{errorMsg}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 py-3 rounded-xl font-bold uppercase bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {mutation.isPending ? "Joining..." : "Join League"}
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
