import { Player } from "@workspace/api-client-react";
import { cn, getPositionColor } from "@/lib/utils";
import { Activity, ShieldAlert, ArrowRightCircle } from "lucide-react";

interface PlayerCardProps {
  player: Player;
  onClick?: () => void;
  selected?: boolean;
  actionIcon?: "add" | "remove" | "transfer";
  className?: string;
  compact?: boolean;
}

export function PlayerCard({ player, onClick, selected, actionIcon, className, compact = false }: PlayerCardProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border p-3 transition-all duration-300",
        onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/50" : "",
        selected 
          ? "bg-primary/10 border-primary box-glow" 
          : "bg-secondary/40 border-white/5",
        compact ? "p-2" : "p-4",
        className
      )}
    >
      {/* Background Gradient for selected state */}
      {selected && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
      )}

      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "flex flex-col items-center justify-center rounded-lg border font-bold uppercase shrink-0",
            getPositionColor(player.position),
            compact ? "w-10 h-10 text-xs" : "w-12 h-12 text-sm"
          )}>
            {player.position}
          </div>
          <div className="truncate">
            <h4 className={cn(
              "font-bold text-white truncate",
              compact ? "text-sm" : "text-base"
            )}>
              {player.name}
            </h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="uppercase tracking-wider font-semibold">{player.nflTeam}</span>
              {player.injuryStatus && (
                <span className="flex items-center gap-1 text-destructive font-semibold bg-destructive/10 px-1.5 py-0.5 rounded">
                  <ShieldAlert className="w-3 h-3" />
                  {player.injuryStatus}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Value</div>
            <div className={cn(
              "font-display font-bold tabular-nums",
              compact ? "text-lg" : "text-xl",
              selected ? "text-primary" : "text-white"
            )}>
              {player.tradeValue.toFixed(1)}
            </div>
          </div>

          {actionIcon && (
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center border",
              actionIcon === 'add' ? "bg-success/20 border-success text-success" : 
              actionIcon === 'remove' ? "bg-destructive/20 border-destructive text-destructive" :
              "bg-primary/20 border-primary text-primary"
            )}>
              {actionIcon === 'add' ? '+' : actionIcon === 'remove' ? '-' : <ArrowRightCircle className="w-4 h-4" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
