import { useState } from "react";
import {
  useAddManualPlayer,
  useRemoveManualPlayer,
  getGetManualLeagueTeamsQueryKey,
} from "@workspace/api-client-react";
import type { Player } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;
type Position = (typeof POSITIONS)[number];

interface RosterEditorProps {
  leagueId: string;
  teamId: string;
  roster: Player[];
}

export function RosterEditor({ leagueId, teamId, roster }: RosterEditorProps) {
  const queryClient = useQueryClient();
  const addMutation = useAddManualPlayer();
  const removeMutation = useRemoveManualPlayer();

  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>("QB");
  const [isStarter, setIsStarter] = useState(false);
  const [nflTeam, setNflTeam] = useState("");
  const [byeWeek, setByeWeek] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetManualLeagueTeamsQueryKey(leagueId) });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    addMutation.mutate(
      {
        leagueId,
        teamId,
        data: {
          name,
          position,
          isStarter,
          realTeam: nflTeam.trim() || undefined,
          byeWeek: byeWeek ? Number(byeWeek) : undefined,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setName("");
          setPosition("QB");
          setIsStarter(false);
          setNflTeam("");
          setByeWeek("");
        },
        onError: (err: any) => {
          setAddError(err?.response?.data?.error ?? "Failed to add player.");
        },
      },
    );
  };

  const handleRemove = (playerId: string) => {
    removeMutation.mutate({ leagueId, teamId, playerId }, { onSuccess: invalidate });
  };

  return (
    <div className="mt-4 space-y-3">
      {roster.length > 0 && (
        <div className="space-y-1">
          {roster.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/20 border border-white/5"
            >
              <span className="text-[10px] w-8 text-center font-bold px-1 py-0.5 rounded bg-white/5 border border-white/10 uppercase">
                {player.position}
              </span>
              <span className="text-sm text-white flex-1 truncate">{player.name}</span>
              {player.isStarter && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/20">
                  STR
                </span>
              )}
              <button
                onClick={() => handleRemove(player.id)}
                disabled={removeMutation.isPending}
                className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-2 pt-2 border-t border-white/5">
        <div className="flex gap-2">
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as Position)}
            className="bg-background border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player name"
            className="flex-1 bg-background border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            value={nflTeam}
            onChange={(e) => setNflTeam(e.target.value)}
            placeholder="NFL team (opt)"
            className="flex-1 min-w-[100px] bg-background border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <input
            type="number"
            value={byeWeek}
            onChange={(e) => setByeWeek(e.target.value)}
            placeholder="Bye wk"
            min={1}
            max={18}
            className="w-20 bg-background border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={isStarter}
              onChange={(e) => setIsStarter(e.target.checked)}
              className="accent-primary"
            />
            Starter
          </label>
        </div>
        {addError && <p className="text-destructive text-xs">{addError}</p>}
        <button
          type="submit"
          disabled={addMutation.isPending}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          {addMutation.isPending ? "Adding..." : "Add Player"}
        </button>
      </form>
    </div>
  );
}
