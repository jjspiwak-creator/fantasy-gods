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
  grade: string;
  score: number;
  gradeRationale: string;
}

export interface TradeSimulationResult {
  leagueId: string;
  teamResults: TeamTradeResult[];
  overallBalance: number;
  summary: string;
}

function calculateGrade(
  valueGiven: number,
  valueReceived: number,
  tradeValueChange: number,
  rosterValueBefore: number
): { grade: string; score: number; gradeRationale: string } {
  // Calculate ratio of received vs given value
  let ratio: number;
  let rationale: string;

  if (valueGiven === 0 && valueReceived === 0) {
    // Nothing traded — neutral
    return { grade: "C", score: 70, gradeRationale: "No players exchanged on this side." };
  }

  if (valueGiven === 0) {
    // Getting players for free
    return { grade: "A+", score: 100, gradeRationale: "Receiving value without giving anything up." };
  }

  if (valueReceived === 0) {
    // Giving players away for nothing
    return { grade: "F", score: 20, gradeRationale: "Giving up value without receiving anything in return." };
  }

  ratio = valueReceived / valueGiven;

  // Also factor in the impact relative to roster size (a 10pt swing on a 200pt roster matters more than on a 500pt roster)
  const rosterImpactPct = rosterValueBefore > 0 ? Math.abs(tradeValueChange) / rosterValueBefore : 0;

  // Base score from ratio (0-100 scale)
  // ratio=1.0 → 75 (solid B), ratio=1.2 → 90 (A-), ratio=0.8 → 60 (D+)
  let score = Math.round(50 + ratio * 25);
  score = Math.max(0, Math.min(100, score));

  // Bonus points for significant positive roster improvement
  if (tradeValueChange > 0 && rosterImpactPct > 0.05) {
    score = Math.min(100, score + Math.round(rosterImpactPct * 40));
  }
  // Penalty for significant negative impact
  if (tradeValueChange < 0 && rosterImpactPct > 0.05) {
    score = Math.max(0, score - Math.round(rosterImpactPct * 40));
  }

  // Build rationale
  const pct = Math.round((ratio - 1) * 100);
  if (ratio >= 1.05) {
    rationale = `Receiving ${pct}% more value than giving up.`;
  } else if (ratio >= 0.95) {
    rationale = `Roughly even swap (within 5% value).`;
  } else {
    rationale = `Giving up ${Math.abs(pct)}% more value than receiving.`;
  }

  // Map score to letter grade
  let grade: string;
  if (score >= 97) grade = "A+";
  else if (score >= 93) grade = "A";
  else if (score >= 90) grade = "A-";
  else if (score >= 87) grade = "B+";
  else if (score >= 83) grade = "B";
  else if (score >= 80) grade = "B-";
  else if (score >= 77) grade = "C+";
  else if (score >= 73) grade = "C";
  else if (score >= 70) grade = "C-";
  else if (score >= 67) grade = "D+";
  else if (score >= 63) grade = "D";
  else if (score >= 60) grade = "D-";
  else grade = "F";

  return { grade, score, gradeRationale: rationale };
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

    const valueGiven = given.reduce((s, p) => s + p.tradeValue, 0);
    const valueReceived = received.reduce((s, p) => s + p.tradeValue, 0);

    let verdict = "neutral";
    if (tradeValueChange > 5) verdict = "win";
    else if (tradeValueChange < -5) verdict = "loss";

    const { grade, score, gradeRationale } = calculateGrade(
      valueGiven,
      valueReceived,
      tradeValueChange,
      tradeValueBefore
    );

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
      grade,
      score,
      gradeRationale,
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
