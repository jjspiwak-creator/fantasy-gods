import { EspnPlayer, EspnTeam } from "./espn";

export interface TradeParticipant {
  teamId: string;
  givingPlayerIds: string[];
}

export interface TeamTradeResult {
  teamId: string;
  teamName: string;
  ownerName: string;
  playersGiven: EspnPlayer[];
  playersReceived: EspnPlayer[];
  rosterBefore: EspnPlayer[];
  rosterAfter: EspnPlayer[];
  tradeValueBefore: number;
  tradeValueAfter: number;
  tradeValueChange: number;
  verdict: string;
}

export interface TradeSimulationResult {
  leagueId: string;
  teamResults: TeamTradeResult[];
  overallBalance: number;
  summary: string;
}

export function simulateTrade(
  leagueId: string,
  participants: TradeParticipant[],
  teams: EspnTeam[]
): TradeSimulationResult {
  const teamMap: Record<string, EspnTeam> = {};
  for (const team of teams) {
    teamMap[team.id] = team;
  }

  const playersGivenByTeam: Record<string, EspnPlayer[]> = {};
  const playersReceivedByTeam: Record<string, EspnPlayer[]> = {};

  for (const p of participants) {
    playersGivenByTeam[p.teamId] = [];
    playersReceivedByTeam[p.teamId] = [];
  }

  for (const participant of participants) {
    const team = teamMap[participant.teamId];
    if (!team) continue;

    for (const playerId of participant.givingPlayerIds) {
      const player = team.roster.find((p) => p.id === playerId);
      if (player) {
        playersGivenByTeam[participant.teamId].push(player);
      }
    }
  }

  for (let i = 0; i < participants.length; i++) {
    const givingTeamId = participants[i].teamId;
    const receivingTeamId = participants[(i + 1) % participants.length].teamId;

    const given = playersGivenByTeam[givingTeamId] || [];
    for (const player of given) {
      playersReceivedByTeam[receivingTeamId].push(player);
    }
  }

  const teamResults: TeamTradeResult[] = [];

  for (const participant of participants) {
    const team = teamMap[participant.teamId];
    if (!team) continue;

    const rosterBefore = [...team.roster];
    const given = playersGivenByTeam[participant.teamId] || [];
    const received = playersReceivedByTeam[participant.teamId] || [];
    const givenIds = new Set(given.map((p) => p.id));

    const rosterAfter = [
      ...rosterBefore.filter((p) => !givenIds.has(p.id)),
      ...received,
    ];

    const tradeValueBefore = rosterBefore.reduce((s, p) => s + p.tradeValue, 0);
    const tradeValueAfter = rosterAfter.reduce((s, p) => s + p.tradeValue, 0);
    const tradeValueChange = tradeValueAfter - tradeValueBefore;

    let verdict = "neutral";
    if (tradeValueChange > 5) verdict = "win";
    else if (tradeValueChange < -5) verdict = "loss";

    teamResults.push({
      teamId: participant.teamId,
      teamName: team.name,
      ownerName: team.ownerName,
      playersGiven: given,
      playersReceived: received,
      rosterBefore,
      rosterAfter,
      tradeValueBefore,
      tradeValueAfter,
      tradeValueChange,
      verdict,
    });
  }

  const overallBalance = teamResults.reduce((s, r) => s + r.tradeValueChange, 0);

  const winners = teamResults.filter((r) => r.verdict === "win").map((r) => r.teamName);
  const losers = teamResults.filter((r) => r.verdict === "loss").map((r) => r.teamName);

  let summary = "";
  if (winners.length > 0 && losers.length > 0) {
    summary = `${winners.join(", ")} ${winners.length === 1 ? "wins" : "win"} this trade. ${losers.join(", ")} ${losers.length === 1 ? "loses" : "lose"}.`;
  } else if (winners.length === 0 && losers.length === 0) {
    summary = "This trade is roughly even for all teams involved.";
  } else {
    summary = "Mixed results — check individual team breakdowns.";
  }

  return {
    leagueId,
    teamResults,
    overallBalance,
    summary,
  };
}
