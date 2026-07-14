import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetManualLeagueTeams,
  useListMyManualLeagues,
} from "@workspace/api-client-react";
import { useManualEngineHydration } from "@/hooks/useEngineHydration";
import { RosterEditor } from "@/components/manual/RosterEditor";
import { Card, CardContent } from "@/components/ui/card";
import { Users, GitCompareArrows, ArrowLeft, Shield, Star, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";

export function ManualLeaguePage() {
  const { leagueId } = useParams();
  const [, setLocation] = useLocation();

  const teamsQuery = useGetManualLeagueTeams(leagueId || "");
  const myLeaguesQuery = useListMyManualLeagues();

  useManualEngineHydration(leagueId, teamsQuery.data);

  const leagueItem = myLeaguesQuery.data?.find((item) => item.league.id === leagueId);
  const myTeamId = leagueItem?.myTeamId;
  const creatorTeamId = leagueItem?.creatorTeamId ?? null;

  const [expandedRoster, setExpandedRoster] = useState<string | null>(null);

  if (teamsQuery.isLoading || myLeaguesQuery.isLoading) {
    return (
      <div className="text-center p-12 text-muted-foreground animate-pulse font-display text-xl">
        LOADING ROSTERS...
      </div>
    );
  }

  if (teamsQuery.isError) {
    return (
      <div className="text-center p-12 text-destructive">
        Failed to load league. You may not be a member.
      </div>
    );
  }

  const teams = teamsQuery.data ?? [];

  return (
    <div className="space-y-8 animate-in fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Link
            href="/leagues"
            className="text-sm text-muted-foreground hover:text-primary mb-2 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Leagues
          </Link>
          <h1 className="text-4xl font-display font-bold uppercase">
            MANUAL <span className="text-primary">LEAGUE</span>
          </h1>
          {leagueItem && (
            <p className="text-muted-foreground mt-1">{leagueItem.league.name}</p>
          )}
        </div>
        <button
          onClick={() => setLocation(`/manual-leagues/${leagueId}/trade-builder`)}
          className="px-6 py-3 rounded-xl font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 box-glow hover:-translate-y-0.5 transition-all flex items-center gap-2 self-start md:self-auto"
        >
          <GitCompareArrows className="w-5 h-5" />
          Build Trade
        </button>
      </header>

      {teams.length === 0 ? (
        <Card className="text-center p-12 glass-panel">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No teams yet.</p>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {teams.map((team, idx) => {
            const isMe = team.id === myTeamId;
            const isCommissioner = team.id === creatorTeamId;
            const isExpanded = expandedRoster === team.id;

            return (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card
                  className={`h-full border-t-4 flex flex-col ${isMe ? "border-t-primary" : "border-t-primary/30"}`}
                >
                  <CardContent className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white">{team.name}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Users className="w-4 h-4" /> {team.ownerName}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {isMe && (
                          <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                            <Star className="w-3 h-3" /> You
                          </span>
                        )}
                        {isCommissioner && (
                          <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <Shield className="w-3 h-3" /> Commissioner
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 mb-4">
                      {team.roster.slice(0, isExpanded ? undefined : 5).map((player) => (
                        <div key={player.id} className="flex items-center gap-3 py-1">
                          <span className="text-[10px] w-8 text-center font-bold px-1 py-0.5 rounded bg-white/5 border border-white/10 uppercase">
                            {player.position}
                          </span>
                          <span className="text-sm text-white font-medium truncate flex-1">
                            {player.name}
                          </span>
                        </div>
                      ))}
                      {team.roster.length > 5 && (
                        <button
                          onClick={() => setExpandedRoster(isExpanded ? null : team.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors pt-1"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3" /> Show less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" /> +{team.roster.length - 5} more
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-white/5">
                      <button
                        onClick={() =>
                          setExpandedRoster(
                            expandedRoster === `editor-${team.id}` ? null : `editor-${team.id}`,
                          )
                        }
                        className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider flex items-center gap-1"
                      >
                        {expandedRoster === `editor-${team.id}` ? (
                          <>
                            <ChevronUp className="w-3 h-3" /> Hide Roster Editor
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" /> Edit Roster
                          </>
                        )}
                      </button>
                      {expandedRoster === `editor-${team.id}` && (
                        <RosterEditor
                          leagueId={leagueId!}
                          teamId={team.id}
                          roster={team.roster}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
