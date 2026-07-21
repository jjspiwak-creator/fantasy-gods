import { logger } from "./logger";

export interface EspnCredentials {
  espnS2: string;
  swid: string;
}

export interface EspnLeague {
  id: string;
  name: string;
  season: number;
  currentWeek: number;
  teamCount: number;
  scoringType: string;
}

export interface EspnPlayer {
  id: string;
  name: string;
  position: string;
  nflTeam: string;
  points: number;
  projectedPoints: number;
  tradeValue: number;
  isStarter: boolean;
  lineupSlotId?: number;
  injuryStatus: string | null;
}

export interface EspnScoringItem {
  statId: number;
  points: number;
  pointsOverrides: Record<string, unknown>;
  isReverseItem: boolean;
}

export interface EspnLeagueSettings {
  name: string;
  size: number;
  draftSettings: {
    type: string;
    timePerSelection: number;
    auctionBudget: number;
    pickOrder: number[];
  };
  rosterSettings: {
    lineupSlotCounts: Record<string, number>;
  };
  scoringSettings: {
    scoringType: string;
    scoringItems: EspnScoringItem[];
  };
  acquisitionSettings: {
    acquisitionType: string;
    acquisitionBudget: number;
    isUsingAcquisitionBudget: boolean;
    minimumBid: number;
    waiverHours: number;
    waiverProcessDays: string[];
    waiverProcessHour: number;
    waiverOrderReset: boolean;
  };
  tradeSettings: {
    deadlineDate: number;
    max: number;
    revisionHours: number;
    vetoVotesRequired: number;
    allowOutOfUniverse: boolean;
  };
}

export interface EspnTeam {
  id: string;
  name: string;
  abbreviation: string;
  ownerName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  totalTradeValue: number;
  roster: EspnPlayer[];
}

const ESPN_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";

const POSITION_MAP: Record<number, string> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "D/ST",
  17: "QB",
  20: "QB",
  21: "RB",
  22: "WR",
  23: "TE",
  24: "FLEX",
};

const NFL_TEAMS: Record<number, string> = {
  1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE",
  6: "DAL", 7: "DEN", 8: "DET", 9: "GB", 10: "TEN",
  11: "IND", 12: "KC", 13: "LV", 14: "LAR", 15: "MIA",
  16: "MIN", 17: "NE", 18: "NO", 19: "NYG", 20: "NYJ",
  21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC", 25: "SF",
  26: "SEA", 27: "TB", 28: "WSH", 29: "CAR", 30: "JAX",
  33: "BAL", 34: "HOU",
};

const stripWs = (v: string) => v.replace(/\s+/g, "");

function buildHeaders(creds: EspnCredentials) {
  return {
    Cookie: `espn_s2=${stripWs(creds.espnS2)}; SWID=${stripWs(creds.swid)}`,
    "X-Fantasy-Filter": JSON.stringify({}),
    "Accept": "application/json",
  };
}

export function extractFootballLeagueIds(fanData: unknown, season: number): string[] {
  const preferences = (fanData as any)?.preferences;
  if (!Array.isArray(preferences)) return [];

  const ids = new Set<string>();

  for (const pref of preferences) {
    if (pref?.typeId !== 9) continue;
    const entry = pref?.metaData?.entry;
    if (entry?.abbrev !== "FFL") continue;
    if (entry?.seasonId !== season) continue;

    const groups = entry?.groups;
    if (!Array.isArray(groups)) continue;

    for (const group of groups) {
      const groupId = group?.groupId;
      if (groupId != null) ids.add(String(groupId));
    }
  }

  return Array.from(ids);
}

export async function fetchUserLeagues(creds: EspnCredentials, season = new Date().getFullYear()): Promise<EspnLeague[]> {
  try {
    const leagueIds = await getUserLeagueIds(creds, season);

    const leagues: EspnLeague[] = [];
    for (const leagueId of leagueIds) {
      try {
        const leagueData = await fetchLeagueData(creds, leagueId, season);
        if (leagueData) leagues.push(leagueData);
      } catch (e) {
        logger.warn({ leagueId, err: e }, "Failed to fetch league data");
      }
    }
    return leagues;
  } catch (err) {
    logger.error({ err }, "Failed to fetch user leagues");
    if (err instanceof Error) throw err;
    throw new Error("Failed to fetch leagues from ESPN. Please verify your credentials.");
  }
}

async function getUserLeagueIds(creds: EspnCredentials, season: number): Promise<string[]> {
  const url = `https://fan.api.espn.com/apis/v2/fans/${encodeURIComponent(creds.swid.trim())}`;
  const headers = {
    ...buildHeaders(creds),
    Accept: "application/json",
  };

  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    logger.warn({ status: resp.status }, "ESPN Fan API non-OK response");
    throw new Error(`ESPN Fan API returned ${resp.status}. Please re-check your ESPN connection.`);
  }

  const data: any = await resp.json();
  return extractFootballLeagueIds(data, season);
}

async function fetchLeagueData(creds: EspnCredentials, leagueId: string, season: number): Promise<EspnLeague | null> {
  const url = `${ESPN_BASE}/seasons/${season}/segments/0/leagues/${leagueId}?view=mSettings&view=mStatus`;
  const headers = buildHeaders(creds);

  const resp = await fetch(url, { headers });
  if (!resp.ok) return null;

  const data: any = await resp.json();
  const settings = data.settings || {};
  const status = data.status || {};

  return {
    id: String(data.id || leagueId),
    name: settings.name || `League ${leagueId}`,
    season: data.seasonId || season,
    currentWeek: status.currentMatchupPeriod || 1,
    teamCount: settings.size || 10,
    scoringType: settings.scoringSettings?.scoringType || "H2H_POINTS",
  };
}

export async function fetchLeagueTeams(creds: EspnCredentials, leagueId: string, season = new Date().getFullYear()): Promise<EspnTeam[]> {
  const url = `${ESPN_BASE}/seasons/${season}/segments/0/leagues/${leagueId}?view=mRoster&view=mTeam&view=mMatchupScore`;
  const headers = buildHeaders(creds);

  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    logger.error(
      { url, status: resp.status, leagueId, season },
      "ESPN fetchLeagueTeams non-OK response"
    );
    throw new Error(`ESPN API returned ${resp.status} for league ${leagueId}`);
  }

  const data: any = await resp.json();
  const teams: any[] = data.teams || [];
  const members: any[] = data.members || [];

  const memberMap: Record<string, string> = {};
  for (const member of members) {
    memberMap[member.id] = `${member.firstName} ${member.lastName}`;
  }

  return teams.map((team: any) => {
    const owner = team.owners?.[0] ? memberMap[team.owners[0]] || "Unknown" : "Unknown";
    const record = team.record?.overall || {};
    const roster = parseRoster(team.roster?.entries || []);
    const totalTradeValue = roster.reduce((sum: number, p: EspnPlayer) => sum + p.tradeValue, 0);

    return {
      id: String(team.id),
      name: team.name || `Team ${team.id}`,
      abbreviation: team.abbrev || "",
      ownerName: owner,
      wins: record.wins || 0,
      losses: record.losses || 0,
      ties: record.ties || 0,
      pointsFor: team.record?.overall?.pointsFor || 0,
      pointsAgainst: team.record?.overall?.pointsAgainst || 0,
      totalTradeValue,
      roster,
    };
  });
}

export async function fetchLeagueSettings(creds: EspnCredentials, leagueId: string, season = new Date().getFullYear()): Promise<EspnLeagueSettings> {
  const url = `${ESPN_BASE}/seasons/${season}/segments/0/leagues/${leagueId}?view=mSettings`;
  const headers = buildHeaders(creds);

  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    logger.error(
      { url, status: resp.status, leagueId, season },
      "ESPN fetchLeagueSettings non-OK response"
    );
    throw new Error(`ESPN API returned ${resp.status} for league ${leagueId} settings`);
  }

  const data: any = await resp.json();
  const settings = data.settings;

  if (!settings || typeof settings !== "object") {
    throw new Error(`ESPN settings response for league ${leagueId} is missing the settings object`);
  }

  const missing: string[] = [];
  if (typeof settings.name !== "string") missing.push("name");
  if (typeof settings.size !== "number") missing.push("size");

  const draft = settings.draftSettings;
  if (!draft) missing.push("draftSettings");
  else {
    if (typeof draft.type !== "string") missing.push("draftSettings.type");
    if (typeof draft.timePerSelection !== "number") missing.push("draftSettings.timePerSelection");
    if (typeof draft.auctionBudget !== "number") missing.push("draftSettings.auctionBudget");
    if (!Array.isArray(draft.pickOrder)) missing.push("draftSettings.pickOrder");
  }

  const roster = settings.rosterSettings;
  if (!roster) missing.push("rosterSettings");
  else if (!roster.lineupSlotCounts || typeof roster.lineupSlotCounts !== "object") {
    missing.push("rosterSettings.lineupSlotCounts");
  }

  const scoring = settings.scoringSettings;
  if (!scoring) missing.push("scoringSettings");
  else {
    if (typeof scoring.scoringType !== "string") missing.push("scoringSettings.scoringType");
    if (!Array.isArray(scoring.scoringItems)) missing.push("scoringSettings.scoringItems");
  }

  const acquisition = settings.acquisitionSettings;
  if (!acquisition) missing.push("acquisitionSettings");
  else {
    if (typeof acquisition.acquisitionType !== "string") missing.push("acquisitionSettings.acquisitionType");
    if (typeof acquisition.acquisitionBudget !== "number") missing.push("acquisitionSettings.acquisitionBudget");
    if (typeof acquisition.isUsingAcquisitionBudget !== "boolean") missing.push("acquisitionSettings.isUsingAcquisitionBudget");
    if (typeof acquisition.minimumBid !== "number") missing.push("acquisitionSettings.minimumBid");
    if (typeof acquisition.waiverHours !== "number") missing.push("acquisitionSettings.waiverHours");
    if (!Array.isArray(acquisition.waiverProcessDays)) missing.push("acquisitionSettings.waiverProcessDays");
    if (typeof acquisition.waiverProcessHour !== "number") missing.push("acquisitionSettings.waiverProcessHour");
    if (typeof acquisition.waiverOrderReset !== "boolean") missing.push("acquisitionSettings.waiverOrderReset");
  }

  const trade = settings.tradeSettings;
  if (!trade) missing.push("tradeSettings");
  else {
    if (typeof trade.deadlineDate !== "number") missing.push("tradeSettings.deadlineDate");
    if (typeof trade.max !== "number") missing.push("tradeSettings.max");
    if (typeof trade.revisionHours !== "number") missing.push("tradeSettings.revisionHours");
    if (typeof trade.vetoVotesRequired !== "number") missing.push("tradeSettings.vetoVotesRequired");
    if (typeof trade.allowOutOfUniverse !== "boolean") missing.push("tradeSettings.allowOutOfUniverse");
  }

  if (missing.length > 0) {
    throw new Error(`ESPN settings response for league ${leagueId} is missing required fields: ${missing.join(", ")}`);
  }

  return {
    name: settings.name,
    size: settings.size,
    draftSettings: {
      type: draft.type,
      timePerSelection: draft.timePerSelection,
      auctionBudget: draft.auctionBudget,
      pickOrder: draft.pickOrder,
    },
    rosterSettings: {
      lineupSlotCounts: roster.lineupSlotCounts,
    },
    scoringSettings: {
      scoringType: scoring.scoringType,
      scoringItems: scoring.scoringItems.map((item: any) => ({
        statId: item.statId,
        points: item.points,
        pointsOverrides: item.pointsOverrides ?? {},
        isReverseItem: !!item.isReverseItem,
      })),
    },
    acquisitionSettings: {
      acquisitionType: acquisition.acquisitionType,
      acquisitionBudget: acquisition.acquisitionBudget,
      isUsingAcquisitionBudget: acquisition.isUsingAcquisitionBudget,
      minimumBid: acquisition.minimumBid,
      waiverHours: acquisition.waiverHours,
      waiverProcessDays: acquisition.waiverProcessDays,
      waiverProcessHour: acquisition.waiverProcessHour,
      waiverOrderReset: acquisition.waiverOrderReset,
    },
    tradeSettings: {
      deadlineDate: trade.deadlineDate,
      max: trade.max,
      revisionHours: trade.revisionHours,
      vetoVotesRequired: trade.vetoVotesRequired,
      allowOutOfUniverse: trade.allowOutOfUniverse,
    },
  };
}

function parseRoster(entries: any[]): EspnPlayer[] {
  return entries.map((entry: any) => {
    const playerInfo = entry.playerPoolEntry?.player || {};
    const stats = entry.playerPoolEntry?.player?.stats || [];
    const projStats = stats.find((s: any) => s.statSplitTypeId === 5) || {};
    const actualStats = stats.find((s: any) => s.statSplitTypeId === 0) || {};

    const position = POSITION_MAP[playerInfo.defaultPositionId] || "FLEX";
    const nflTeamId = playerInfo.proTeamId || 0;
    const injuryStatus = entry.playerPoolEntry?.injuryStatus || null;
    const tradeValue = entry.playerPoolEntry?.acquisitionType === "DRAFT"
      ? (entry.playerPoolEntry?.keeperValue || estimateTradeValue(playerInfo))
      : estimateTradeValue(playerInfo);

    return {
      id: String(playerInfo.id || entry.playerId),
      name: playerInfo.fullName || "Unknown",
      position,
      nflTeam: NFL_TEAMS[nflTeamId] || "FA",
      points: actualStats.appliedTotal || 0,
      projectedPoints: projStats.appliedTotal || 0,
      tradeValue,
      isStarter: isStarterSlot(entry.lineupSlotId),
      lineupSlotId: typeof entry.lineupSlotId === "number" ? entry.lineupSlotId : undefined,
      injuryStatus: injuryStatus === "ACTIVE" ? null : injuryStatus,
    };
  });
}

function isStarterSlot(slotId: number): boolean {
  const starterSlots = [0, 2, 4, 6, 17, 16, 23];
  return starterSlots.includes(slotId);
}

function estimateTradeValue(player: any): number {
  const stats = player.stats || [];
  const season = stats.find((s: any) => s.statSplitTypeId === 0 && s.scoringPeriodId === 0);
  if (!season) return 10;
  return Math.round((season.appliedTotal || 10) * 1.5);
}

export function verifyCredentials(creds: EspnCredentials): boolean {
  return !!(creds.espnS2 && creds.swid && creds.espnS2.length > 20 && creds.swid.length > 5);
}
