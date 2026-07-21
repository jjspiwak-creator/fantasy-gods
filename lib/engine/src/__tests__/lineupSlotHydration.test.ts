/**
 * WO15c — lineupSlotId hydration tests.
 * Verifies that real ESPN lineupSlotId is honored by buildEngineState,
 * fallback inference is preserved for manual leagues, and a trade
 * on a FLEX-inclusive roster runs clean through executeTransaction.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildEngineState, executeTransaction } from "@workspace/engine";
import type { Team, LeagueSettings as ApiLeagueSettings } from "@workspace/api-client-react";

// ─── Shared fixture: real WO15a slot cap map ──────────────────────────────────

const REAL_SLOT_COUNTS: Record<string, number> = {
  "0":  1,  // STARTER_QB
  "2":  2,  // STARTER_RB
  "4":  2,  // STARTER_WR
  "6":  1,  // STARTER_TE
  "16": 1,  // STARTER_DST
  "17": 1,  // STARTER_K
  "20": 7,  // BENCH
  "21": 1,  // IR
  "23": 1,  // FLEX
};

const REAL_SETTINGS: ApiLeagueSettings = {
  name: "Test League",
  size: 10,
  draftSettings: {
    type: "SNAKE",
    timePerSelection: 90,
    auctionBudget: 200,
    pickOrder: [],
  },
  rosterSettings: {
    lineupSlotCounts: REAL_SLOT_COUNTS,
  },
  scoringSettings: {
    scoringType: "H2H_POINTS",
    scoringItems: [],
  },
  acquisitionSettings: {
    acquisitionType: "GAMEDAY_MORNING",
    acquisitionBudget: 0,
    isUsingAcquisitionBudget: false,
    minimumBid: 0,
    waiverHours: 24,
    waiverProcessDays: ["WEDNESDAY"],
    waiverProcessHour: 3,
    waiverOrderReset: true,
  },
  tradeSettings: {
    deadlineDate: 0,
    max: 0,
    revisionHours: 24,
    vetoVotesRequired: 4,
    allowOutOfUniverse: false,
  },
};

// ─── Test A: Real slot honored ────────────────────────────────────────────────

describe("lineupSlotHydration — A: real slot honored", () => {
  const teams: Team[] = [
    {
      id: "1",
      name: "Alpha",
      ownerName: "Alice",
      wins: 5, losses: 5, ties: 0,
      pointsFor: 900, pointsAgainst: 880,
      totalTradeValue: 400,
      roster: [
        { id: "a-qb",   name: "QB1",  position: "QB",   nflTeam: "KC",  points: 0, projectedPoints: 0, tradeValue: 30, isStarter: true,  lineupSlotId: 0,  injuryStatus: null },
        { id: "a-rb1",  name: "RB1",  position: "RB",   nflTeam: "PHI", points: 0, projectedPoints: 0, tradeValue: 30, isStarter: true,  lineupSlotId: 2,  injuryStatus: null },
        { id: "a-rb2",  name: "RB2",  position: "RB",   nflTeam: "GB",  points: 0, projectedPoints: 0, tradeValue: 25, isStarter: true,  lineupSlotId: 2,  injuryStatus: null },
        { id: "a-wr1",  name: "WR1",  position: "WR",   nflTeam: "MIA", points: 0, projectedPoints: 0, tradeValue: 30, isStarter: true,  lineupSlotId: 4,  injuryStatus: null },
        { id: "a-wr2",  name: "WR2",  position: "WR",   nflTeam: "DAL", points: 0, projectedPoints: 0, tradeValue: 28, isStarter: true,  lineupSlotId: 4,  injuryStatus: null },
        // KEY: WR in FLEX slot — old code would place this in STARTER_WR → cap violation
        { id: "a-wr-flex", name: "WR-FLEX", position: "WR", nflTeam: "NO", points: 0, projectedPoints: 0, tradeValue: 20, isStarter: true, lineupSlotId: 23, injuryStatus: null },
        { id: "a-te",   name: "TE1",  position: "TE",   nflTeam: "BAL", points: 0, projectedPoints: 0, tradeValue: 25, isStarter: true,  lineupSlotId: 6,  injuryStatus: null },
        { id: "a-k",    name: "K1",   position: "K",    nflTeam: "KC",  points: 0, projectedPoints: 0, tradeValue: 10, isStarter: true,  lineupSlotId: 17, injuryStatus: null },
        { id: "a-dst",  name: "DST1", position: "D/ST", nflTeam: "SF",  points: 0, projectedPoints: 0, tradeValue: 10, isStarter: true,  lineupSlotId: 16, injuryStatus: null },
        { id: "a-bn1",  name: "BN1",  position: "WR",   nflTeam: "SEA", points: 0, projectedPoints: 0, tradeValue: 15, isStarter: false, lineupSlotId: 20, injuryStatus: null },
      ],
    },
  ];

  const result = buildEngineState("test-a", teams, REAL_SETTINGS);
  const team = result.teams["1"];

  it("WR-FLEX player lands in FLEX engine slot", () => {
    const flexSlot = team.rosterSlots["FLEX"] ?? [];
    assert.ok(flexSlot.includes("a-wr-flex"), "a-wr-flex must be in FLEX slot");
  });

  it("STARTER_WR slot holds exactly 2 players (within cap)", () => {
    const wrSlot = team.rosterSlots["STARTER_WR"] ?? [];
    assert.strictEqual(wrSlot.length, 2, "STARTER_WR must have exactly 2 entries");
    assert.ok(!wrSlot.includes("a-wr-flex"), "a-wr-flex must NOT be in STARTER_WR");
  });
});

// ─── Test B: Fallback preserved ───────────────────────────────────────────────

describe("lineupSlotHydration — B: fallback preserved for manual leagues", () => {
  const teams: Team[] = [
    {
      id: "2",
      name: "Beta",
      ownerName: "Bob",
      wins: 3, losses: 7, ties: 0,
      pointsFor: 700, pointsAgainst: 900,
      totalTradeValue: 300,
      roster: [
        // No lineupSlotId — must fall back to isStarter inference
        { id: "b-wr-starter", name: "WR-Starter", position: "WR", nflTeam: "KC",  points: 0, projectedPoints: 0, tradeValue: 20, isStarter: true,  injuryStatus: null },
        { id: "b-wr-bench",   name: "WR-Bench",   position: "WR", nflTeam: "MIA", points: 0, projectedPoints: 0, tradeValue: 15, isStarter: false, injuryStatus: null },
      ],
    },
  ];

  const result = buildEngineState("test-b", teams);
  const team = result.teams["2"];

  it("WR with isStarter=true and no lineupSlotId lands in STARTER_WR (slot 4)", () => {
    const wrSlot = team.rosterSlots["STARTER_WR"] ?? [];
    assert.ok(wrSlot.includes("b-wr-starter"), "b-wr-starter must be in STARTER_WR");
  });

  it("WR with isStarter=false and no lineupSlotId lands in BENCH (slot 20)", () => {
    const benchSlot = team.rosterSlots["BENCH"] ?? [];
    assert.ok(benchSlot.includes("b-wr-bench"), "b-wr-bench must be in BENCH");
  });
});

// ─── Test C: Regression — no cap exceeded, trade passes ───────────────────────

describe("lineupSlotHydration — C: no slot exceeds cap; trade executes clean", () => {
  // Two teams each with the real WO15a distribution:
  //   QB(0), RB(2), RB(2), WR(4), WR(4), TE(6), K(17), DST(16), WR-FLEX(23), bench(20)x7
  function makeRoster(prefix: string): Team["roster"] {
    return [
      { id: `${prefix}-qb`,  name: "QB",      position: "QB",   nflTeam: "KC",  points: 0, projectedPoints: 0, tradeValue: 30, isStarter: true,  lineupSlotId: 0,  injuryStatus: null },
      { id: `${prefix}-rb1`, name: "RB1",     position: "RB",   nflTeam: "PHI", points: 0, projectedPoints: 0, tradeValue: 28, isStarter: true,  lineupSlotId: 2,  injuryStatus: null },
      { id: `${prefix}-rb2`, name: "RB2",     position: "RB",   nflTeam: "GB",  points: 0, projectedPoints: 0, tradeValue: 25, isStarter: true,  lineupSlotId: 2,  injuryStatus: null },
      { id: `${prefix}-wr1`, name: "WR1",     position: "WR",   nflTeam: "MIA", points: 0, projectedPoints: 0, tradeValue: 30, isStarter: true,  lineupSlotId: 4,  injuryStatus: null },
      { id: `${prefix}-wr2`, name: "WR2",     position: "WR",   nflTeam: "DAL", points: 0, projectedPoints: 0, tradeValue: 28, isStarter: true,  lineupSlotId: 4,  injuryStatus: null },
      { id: `${prefix}-wrx`, name: "WR-FLEX", position: "WR",   nflTeam: "NO",  points: 0, projectedPoints: 0, tradeValue: 20, isStarter: true,  lineupSlotId: 23, injuryStatus: null },
      { id: `${prefix}-te`,  name: "TE",      position: "TE",   nflTeam: "BAL", points: 0, projectedPoints: 0, tradeValue: 24, isStarter: true,  lineupSlotId: 6,  injuryStatus: null },
      { id: `${prefix}-k`,   name: "K",       position: "K",    nflTeam: "KC",  points: 0, projectedPoints: 0, tradeValue: 10, isStarter: true,  lineupSlotId: 17, injuryStatus: null },
      { id: `${prefix}-dst`, name: "DST",     position: "D/ST", nflTeam: "SF",  points: 0, projectedPoints: 0, tradeValue: 10, isStarter: true,  lineupSlotId: 16, injuryStatus: null },
      { id: `${prefix}-bn1`, name: "BN1",     position: "RB",   nflTeam: "TEN", points: 0, projectedPoints: 0, tradeValue: 12, isStarter: false, lineupSlotId: 20, injuryStatus: null },
      { id: `${prefix}-bn2`, name: "BN2",     position: "WR",   nflTeam: "SEA", points: 0, projectedPoints: 0, tradeValue: 10, isStarter: false, lineupSlotId: 20, injuryStatus: null },
      { id: `${prefix}-bn3`, name: "BN3",     position: "QB",   nflTeam: "DAL", points: 0, projectedPoints: 0, tradeValue: 8,  isStarter: false, lineupSlotId: 20, injuryStatus: null },
      { id: `${prefix}-bn4`, name: "BN4",     position: "WR",   nflTeam: "ATL", points: 0, projectedPoints: 0, tradeValue: 8,  isStarter: false, lineupSlotId: 20, injuryStatus: null },
      { id: `${prefix}-bn5`, name: "BN5",     position: "RB",   nflTeam: "CHI", points: 0, projectedPoints: 0, tradeValue: 7,  isStarter: false, lineupSlotId: 20, injuryStatus: null },
      { id: `${prefix}-bn6`, name: "BN6",     position: "TE",   nflTeam: "MIN", points: 0, projectedPoints: 0, tradeValue: 7,  isStarter: false, lineupSlotId: 20, injuryStatus: null },
      { id: `${prefix}-bn7`, name: "BN7",     position: "K",    nflTeam: "NE",  points: 0, projectedPoints: 0, tradeValue: 5,  isStarter: false, lineupSlotId: 20, injuryStatus: null },
    ];
  }

  const teams: Team[] = [
    {
      id: "T1", name: "Team 1", ownerName: "Alice",
      wins: 5, losses: 5, ties: 0,
      pointsFor: 900, pointsAgainst: 880, totalTradeValue: 400,
      roster: makeRoster("t1"),
    },
    {
      id: "T2", name: "Team 2", ownerName: "Bob",
      wins: 4, losses: 6, ties: 0,
      pointsFor: 850, pointsAgainst: 920, totalTradeValue: 370,
      roster: makeRoster("t2"),
    },
  ];

  const { settings, players, teams: engineTeams } = buildEngineState("test-c", teams, REAL_SETTINGS);

  it("no slot exceeds its roster cap after hydration", () => {
    for (const [, team] of Object.entries(engineTeams)) {
      for (const [slot, ids] of Object.entries(team.rosterSlots)) {
        const cap = settings.rosterCaps[slot];
        if (cap != null) {
          assert.ok(
            ids.length <= cap,
            `Slot ${slot} has ${ids.length} players but cap is ${cap} (team ${team.teamId})`,
          );
        }
      }
    }
  });

  it("1-for-1 WR-for-WR trade between T1 and T2 runs without throwing", () => {
    // Swap WR1 starters between the two teams.
    assert.doesNotThrow(() => {
      executeTransaction(players, engineTeams, settings, [
        {
          teamId: "T1",
          acquire: ["t2-wr1"],
          release: ["t1-wr1"],
          targetSlots: { "t2-wr1": "STARTER_WR" },
        },
        {
          teamId: "T2",
          acquire: ["t1-wr1"],
          release: ["t2-wr1"],
          targetSlots: { "t1-wr1": "STARTER_WR" },
        },
      ]);
    });
  });
});
