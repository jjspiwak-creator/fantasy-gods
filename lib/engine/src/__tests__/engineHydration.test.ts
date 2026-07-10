/**
 * Unit tests for buildEngineState — feeds a fixture shaped like the REAL
 * GET /api/espn/leagues/{id}/teams response and asserts the engine output is
 * well-formed, non-empty, and internally consistent.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildEngineState, toEspnLeagueSettings } from "../utils/engineHydration";
import type { Team, LeagueSettings as ApiLeagueSettings } from "@workspace/api-client-react";

// ─── Fixture (shaped like real API response) ──────────────────────────────────

const REAL_SHAPE_FIXTURE: Team[] = [
  {
    id: "1",
    name: "Alpha Wolves",
    abbreviation: "ALW",
    ownerName: "Alice",
    wins: 7,
    losses: 3,
    ties: 0,
    pointsFor: 1140.5,
    pointsAgainst: 980.2,
    totalTradeValue: 450,
    roster: [
      { id: "p1",  name: "Patrick Mahomes",  position: "QB",   nflTeam: "KC",  points: 320, projectedPoints: 30, tradeValue: 90, isStarter: true,  injuryStatus: null },
      { id: "p2",  name: "Saquon Barkley",   position: "RB",   nflTeam: "PHI", points: 280, projectedPoints: 22, tradeValue: 85, isStarter: true,  injuryStatus: null },
      { id: "p3",  name: "Stefon Diggs",     position: "WR",   nflTeam: "HOU", points: 200, projectedPoints: 18, tradeValue: 55, isStarter: true,  injuryStatus: null },
      { id: "p4",  name: "Travis Kelce",     position: "TE",   nflTeam: "KC",  points: 260, projectedPoints: 20, tradeValue: 80, isStarter: true,  injuryStatus: null },
      { id: "p5",  name: "Harrison Butker",  position: "K",    nflTeam: "KC",  points: 95,  projectedPoints: 9,  tradeValue: 10, isStarter: true,  injuryStatus: null },
      { id: "p6",  name: "SF Defense",       position: "D/ST", nflTeam: "SF",  points: 85,  projectedPoints: 8,  tradeValue: 12, isStarter: true,  injuryStatus: null },
      { id: "p7",  name: "Josh Jacobs",      position: "RB",   nflTeam: "GB",  points: 170, projectedPoints: 14, tradeValue: 45, isStarter: false, injuryStatus: null },
      { id: "p8",  name: "Chris Olave",      position: "WR",   nflTeam: "NO",  points: 140, projectedPoints: 12, tradeValue: 40, isStarter: false, injuryStatus: "QUESTIONABLE" },
    ],
  },
  {
    id: "2",
    name: "Beta Bears",
    abbreviation: "BBR",
    ownerName: "Bob",
    wins: 5,
    losses: 5,
    ties: 0,
    pointsFor: 980.0,
    pointsAgainst: 1050.8,
    totalTradeValue: 380,
    roster: [
      { id: "p9",  name: "Lamar Jackson",    position: "QB",   nflTeam: "BAL", points: 310, projectedPoints: 28, tradeValue: 88, isStarter: true,  injuryStatus: null },
      { id: "p10", name: "Derrick Henry",    position: "RB",   nflTeam: "TEN", points: 255, projectedPoints: 20, tradeValue: 70, isStarter: true,  injuryStatus: null },
      { id: "p11", name: "Tyreek Hill",      position: "WR",   nflTeam: "MIA", points: 290, projectedPoints: 25, tradeValue: 82, isStarter: true,  injuryStatus: null },
      { id: "p12", name: "Mark Andrews",     position: "TE",   nflTeam: "BAL", points: 200, projectedPoints: 17, tradeValue: 60, isStarter: true,  injuryStatus: null },
      { id: "p13", name: "Justin Tucker",    position: "K",    nflTeam: "BAL", points: 110, projectedPoints: 10, tradeValue: 12, isStarter: true,  injuryStatus: null },
      { id: "p14", name: "Dallas Defense",   position: "D/ST", nflTeam: "DAL", points: 70,  projectedPoints: 7,  tradeValue: 9,  isStarter: true,  injuryStatus: null },
      { id: "p15", name: "Davante Adams",    position: "WR",   nflTeam: "LV",  points: 160, projectedPoints: 13, tradeValue: 50, isStarter: false, injuryStatus: null },
    ],
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildEngineState — output shape", () => {
  const result = buildEngineState("123", REAL_SHAPE_FIXTURE);

  it("returns settings, players, and teams keys", () => {
    assert.ok(result.settings,  "settings must be present");
    assert.ok(result.players,   "players must be present");
    assert.ok(result.teams,     "teams must be present");
  });

  it("settings.leagueId equals the leagueId argument", () => {
    assert.strictEqual(result.settings.leagueId, "123");
  });

  it("players map is non-empty", () => {
    assert.ok(Object.keys(result.players).length > 0, "players must be non-empty");
  });

  it("teams map is non-empty", () => {
    assert.ok(Object.keys(result.teams).length > 0, "teams must be non-empty");
  });

  it("teams map has exactly as many entries as fixture teams", () => {
    assert.strictEqual(
      Object.keys(result.teams).length,
      REAL_SHAPE_FIXTURE.length,
    );
  });
});

describe("buildEngineState — player uniqueness", () => {
  const { players, teams } = buildEngineState("123", REAL_SHAPE_FIXTURE);

  it("every player in the players map appears in exactly one team's rosterSlots", () => {
    const allRosteredIds: string[] = [];
    for (const team of Object.values(teams)) {
      for (const ids of Object.values(team.rosterSlots)) {
        allRosteredIds.push(...ids);
      }
    }
    const seen = new Set<string>();
    for (const id of allRosteredIds) {
      assert.ok(!seen.has(id), `Player ${id} appears more than once across all team rosterSlots`);
      seen.add(id);
    }
    // Every rostered id must be in the global players map
    for (const id of seen) {
      assert.ok(id in players, `Rostered player ${id} is missing from the global players map`);
    }
  });

  it("total players in rosterSlots equals total fixture roster entries", () => {
    const totalFixturePlayers = REAL_SHAPE_FIXTURE.reduce(
      (acc, t) => acc + t.roster.length, 0,
    );
    let totalRostered = 0;
    for (const team of Object.values(teams)) {
      for (const ids of Object.values(team.rosterSlots)) {
        totalRostered += ids.length;
      }
    }
    assert.strictEqual(totalRostered, totalFixturePlayers);
  });
});

describe("buildEngineState — player field correctness", () => {
  const { players } = buildEngineState("123", REAL_SHAPE_FIXTURE);

  it("Mahomes (QB) has eligiblePositions = ['QB']", () => {
    assert.deepStrictEqual(players["p1"].eligiblePositions, ["QB"]);
  });

  it("Barkley (RB) has eligiblePositions = ['RB']", () => {
    assert.deepStrictEqual(players["p2"].eligiblePositions, ["RB"]);
  });

  it("Kelce (TE) has eligiblePositions = ['TE']", () => {
    assert.deepStrictEqual(players["p4"].eligiblePositions, ["TE"]);
  });

  it("Butker (K) has eligiblePositions = ['K']", () => {
    assert.deepStrictEqual(players["p5"].eligiblePositions, ["K"]);
  });

  it("SF Defense (D/ST) has eligiblePositions = ['DST']", () => {
    assert.deepStrictEqual(players["p6"].eligiblePositions, ["DST"]);
  });

  it("injured player's lockStatus and name are preserved", () => {
    const olave = players["p8"];
    assert.ok(olave, "p8 must exist");
    assert.strictEqual(olave.name, "Chris Olave");
  });

  it("all players have empty playerHistoryStack", () => {
    for (const [id, p] of Object.entries(players)) {
      assert.deepStrictEqual(p.playerHistoryStack, [], `${id} must have empty history`);
    }
  });

  it("all players have null acquiredTimestamp (not available from /teams)", () => {
    for (const [id, p] of Object.entries(players)) {
      assert.strictEqual(p.acquiredTimestamp, null, `${id} acquiredTimestamp must be null`);
    }
  });
});

describe("buildEngineState — team field correctness", () => {
  const { teams } = buildEngineState("123", REAL_SHAPE_FIXTURE);

  it("team '1' has teamName = 'Alpha Wolves'", () => {
    assert.strictEqual(teams["1"].teamName, "Alpha Wolves");
  });

  it("team '2' has teamName = 'Beta Bears'", () => {
    assert.strictEqual(teams["2"].teamName, "Beta Bears");
  });

  it("team '1' managerName is 'Alice'", () => {
    assert.strictEqual(teams["1"].managerName, "Alice");
  });

  it("all teams have at least one rosterSlot with players", () => {
    for (const [id, team] of Object.entries(teams)) {
      const total = Object.values(team.rosterSlots).reduce(
        (acc, ids) => acc + ids.length, 0,
      );
      assert.ok(total > 0, `Team ${id} must have at least one rostered player`);
    }
  });
});

describe("buildEngineState — settings defaults", () => {
  const { settings } = buildEngineState("league-abc", REAL_SHAPE_FIXTURE);

  it("settings.leagueId matches argument", () => {
    assert.strictEqual(settings.leagueId, "league-abc");
  });

  it("settings.draftType is 'snake' (synthesised default)", () => {
    assert.strictEqual(settings.draftType, "snake");
  });

  it("settings.scoringRules is an object (empty when no scoringItems)", () => {
    assert.ok(typeof settings.scoringRules === "object");
  });

  it("settings.slotRequirements has at least one key (roster slots configured)", () => {
    assert.ok(Object.keys(settings.slotRequirements).length > 0);
  });
});

// ─── Real settings fixture (shaped like real API /settings response) ─────────

function buildScoringItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    statId: 1000 + i, // deliberately outside ESPN_STAT_KEYS's named IDs — every item is distinct
    points: 1,
    pointsOverrides: {},
    isReverseItem: false,
  }));
}

function makeApiSettingsFixture(overrides: {
  isUsingAcquisitionBudget: boolean;
  acquisitionBudget: number;
}): ApiLeagueSettings {
  return {
    name: "League of Game Changers",
    size: 4,
    draftSettings: {
      type: "SNAKE",
      timePerSelection: 15,
      auctionBudget: 0,
      pickOrder: [],
    },
    rosterSettings: {
      lineupSlotCounts: {
        "0": 1, "2": 2, "4": 2, "6": 1, "23": 1, "17": 1, "16": 1, "20": 7,
      },
    },
    scoringSettings: {
      scoringType: "H2H_POINTS",
      scoringItems: buildScoringItems(46),
    },
    acquisitionSettings: {
      acquisitionType: "WAIVERS_TRADITIONAL",
      acquisitionBudget: overrides.acquisitionBudget,
      isUsingAcquisitionBudget: overrides.isUsingAcquisitionBudget,
      minimumBid: 0,
      waiverHours: 0,
      waiverProcessDays: [],
      waiverProcessHour: 0,
      waiverOrderReset: false,
    },
    tradeSettings: {
      deadlineDate: 0,
      max: 0,
      revisionHours: 0,
      vetoVotesRequired: 0,
      allowOutOfUniverse: false,
    },
  };
}

describe("toEspnLeagueSettings", () => {
  it("puts acquisitionSettings.acquisitionType into waiverSettings.type", () => {
    const api = makeApiSettingsFixture({ isUsingAcquisitionBudget: false, acquisitionBudget: 100 });
    const espn = toEspnLeagueSettings(api);
    assert.strictEqual(espn.waiverSettings?.type, "WAIVERS_TRADITIONAL");
  });

  it("isUsingAcquisitionBudget:false + budget 100 -> no financeSettings, no totalAuctionBudget on engine settings", () => {
    const api = makeApiSettingsFixture({ isUsingAcquisitionBudget: false, acquisitionBudget: 100 });
    const espn = toEspnLeagueSettings(api);
    assert.strictEqual(espn.financeSettings, undefined);

    const { settings } = buildEngineState("123", REAL_SHAPE_FIXTURE, api);
    assert.strictEqual(settings.totalAuctionBudget, undefined);
  });

  it("isUsingAcquisitionBudget:true + budget 200 -> totalAuctionBudget 200", () => {
    const api = makeApiSettingsFixture({ isUsingAcquisitionBudget: true, acquisitionBudget: 200 });
    const espn = toEspnLeagueSettings(api);
    assert.strictEqual(espn.financeSettings?.acquisitionBudget, 200);

    const { settings } = buildEngineState("123", REAL_SHAPE_FIXTURE, api);
    assert.strictEqual(settings.totalAuctionBudget, 200);
  });
});

describe("buildEngineState — with real apiSettings", () => {
  const api = makeApiSettingsFixture({ isUsingAcquisitionBudget: false, acquisitionBudget: 100 });
  const { settings } = buildEngineState("123", REAL_SHAPE_FIXTURE, api);

  it("scoringRules has exactly 46 keys", () => {
    assert.strictEqual(Object.keys(settings.scoringRules).length, 46);
  });

  it("draftClockDuration is 15", () => {
    assert.strictEqual(settings.draftClockDuration, 15);
  });

  it("draftType is 'snake'", () => {
    assert.strictEqual(settings.draftType, "snake");
  });

  it("waiverSystem is 'rolling_priority'", () => {
    assert.strictEqual(settings.waiverSystem, "rolling_priority");
  });
});

describe("buildEngineState — without apiSettings still returns synthesized defaults", () => {
  const { settings } = buildEngineState("123", REAL_SHAPE_FIXTURE);

  it("draftType is 'snake' (synthesised default)", () => {
    assert.strictEqual(settings.draftType, "snake");
  });

  it("scoringRules is empty (no real scoringItems)", () => {
    assert.strictEqual(Object.keys(settings.scoringRules).length, 0);
  });

  it("totalAuctionBudget is undefined (no FAAB in default template)", () => {
    assert.strictEqual(settings.totalAuctionBudget, undefined);
  });
});
