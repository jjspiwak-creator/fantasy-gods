/**
 * MIRROR CONTRACT — parity tests for the client-side grading hook.
 *
 * SOURCE OF TRUTH: artifacts/api-server/src/lib/tradeSimulator.ts
 *   — calculateGrade() (exported)
 *
 * These golden fixtures are DUPLICATED from:
 *   artifacts/api-server/src/lib/__tests__/tradeSimulator.grades.test.ts
 *
 * Goldens were frozen at pin ab68b83. Any change must land in BOTH
 * test files and in both formula implementations simultaneously.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { useLiveTradeGrade } from "../useLiveTradeGrade.ts";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makePlayer(id: string, tradeValue: number) {
  return {
    id,
    name: `Player ${id}`,
    position: "WR" as const,
    nflTeam: "KC",
    points: 0,
    projectedPoints: 0,
    tradeValue,
    isStarter: true,
    injuryStatus: null,
    lineupSlotId: undefined,
  };
}

function makeTeam(id: string, players: ReturnType<typeof makePlayer>[]) {
  return {
    id,
    name: `Team ${id}`,
    ownerName: `Owner ${id}`,
    abbreviation: id.toUpperCase(),
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    totalTradeValue: players.reduce((s, p) => s + p.tradeValue, 0),
    roster: players,
  };
}

// ─── GOLDEN FIXTURES (duplicated from tradeSimulator.grades.test.ts) ─────────

const FIXTURE_1_LOPSIDED = {
  goldens: {
    teamA: { grade: "F", score: 36, tradeValueChange: -30 },
    teamB: { grade: "A+", score: 100, tradeValueChange: 30 },
  },
};

const FIXTURE_2_EVEN = {
  goldens: {
    teamC: { grade: "C", score: 75, tradeValueChange: 0 },
    teamD: { grade: "C", score: 75, tradeValueChange: 0 },
  },
};

const FIXTURE_3_THREE_TEAM = {
  goldens: {
    teamE: { grade: "D+", score: 67, tradeValueChange: -5 },
    teamF: { grade: "B", score: 85, tradeValueChange: 5 },
    teamG: { grade: "C", score: 75, tradeValueChange: 0 },
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useLiveTradeGrade — fixture 1: lopsided 2-team trade", () => {
  const teamA = makeTeam("A", [makePlayer("p1", 50)]);
  const teamB = makeTeam("B", [makePlayer("p2", 20)]);
  const transfers = [
    { playerId: "p1", fromTeamId: "A", toTeamId: "B" },
    { playerId: "p2", fromTeamId: "B", toTeamId: "A" },
  ];
  const teams = [teamA, teamB];

  it("returns non-null result", () => {
    const result = useLiveTradeGrade(teams, transfers);
    assert.ok(result !== null);
  });

  it("team A → F / 36 / tradeValueChange -30", () => {
    const result = useLiveTradeGrade(teams, transfers)!;
    const a = result.find((r) => r.teamId === "A")!;
    assert.strictEqual(a.grade, FIXTURE_1_LOPSIDED.goldens.teamA.grade);
    assert.strictEqual(a.score, FIXTURE_1_LOPSIDED.goldens.teamA.score);
    assert.strictEqual(a.tradeValueChange, FIXTURE_1_LOPSIDED.goldens.teamA.tradeValueChange);
  });

  it("team B → A+ / 100 / tradeValueChange +30", () => {
    const result = useLiveTradeGrade(teams, transfers)!;
    const b = result.find((r) => r.teamId === "B")!;
    assert.strictEqual(b.grade, FIXTURE_1_LOPSIDED.goldens.teamB.grade);
    assert.strictEqual(b.score, FIXTURE_1_LOPSIDED.goldens.teamB.score);
    assert.strictEqual(b.tradeValueChange, FIXTURE_1_LOPSIDED.goldens.teamB.tradeValueChange);
  });
});

describe("useLiveTradeGrade — fixture 2: even 2-team trade", () => {
  const teamC = makeTeam("C", [makePlayer("p3", 30)]);
  const teamD = makeTeam("D", [makePlayer("p4", 30)]);
  const transfers = [
    { playerId: "p3", fromTeamId: "C", toTeamId: "D" },
    { playerId: "p4", fromTeamId: "D", toTeamId: "C" },
  ];
  const teams = [teamC, teamD];

  it("team C → C / 75 / tradeValueChange 0", () => {
    const result = useLiveTradeGrade(teams, transfers)!;
    const c = result.find((r) => r.teamId === "C")!;
    assert.strictEqual(c.grade, FIXTURE_2_EVEN.goldens.teamC.grade);
    assert.strictEqual(c.score, FIXTURE_2_EVEN.goldens.teamC.score);
    assert.strictEqual(c.tradeValueChange, FIXTURE_2_EVEN.goldens.teamC.tradeValueChange);
  });

  it("team D → C / 75 / tradeValueChange 0", () => {
    const result = useLiveTradeGrade(teams, transfers)!;
    const d = result.find((r) => r.teamId === "D")!;
    assert.strictEqual(d.grade, FIXTURE_2_EVEN.goldens.teamD.grade);
    assert.strictEqual(d.score, FIXTURE_2_EVEN.goldens.teamD.score);
    assert.strictEqual(d.tradeValueChange, FIXTURE_2_EVEN.goldens.teamD.tradeValueChange);
  });
});

describe("useLiveTradeGrade — fixture 3: 3-team circular trade", () => {
  const teamE = makeTeam("E", [makePlayer("p5", 40)]);
  const teamF = makeTeam("F", [makePlayer("p6", 35)]);
  const teamG = makeTeam("G", [makePlayer("p7", 35)]);
  const transfers = [
    { playerId: "p5", fromTeamId: "E", toTeamId: "F" },
    { playerId: "p6", fromTeamId: "F", toTeamId: "G" },
    { playerId: "p7", fromTeamId: "G", toTeamId: "E" },
  ];
  const teams = [teamE, teamF, teamG];

  it("returns 3 results", () => {
    const result = useLiveTradeGrade(teams, transfers);
    assert.ok(result !== null);
    assert.strictEqual(result!.length, 3);
  });

  it("team E (gives 40, receives 35) → D+ / 67 / tradeValueChange -5", () => {
    const result = useLiveTradeGrade(teams, transfers)!;
    const e = result.find((r) => r.teamId === "E")!;
    assert.strictEqual(e.grade, FIXTURE_3_THREE_TEAM.goldens.teamE.grade);
    assert.strictEqual(e.score, FIXTURE_3_THREE_TEAM.goldens.teamE.score);
    assert.strictEqual(e.tradeValueChange, FIXTURE_3_THREE_TEAM.goldens.teamE.tradeValueChange);
  });

  it("team F (gives 35, receives 40) → B / 85 / tradeValueChange +5", () => {
    const result = useLiveTradeGrade(teams, transfers)!;
    const f = result.find((r) => r.teamId === "F")!;
    assert.strictEqual(f.grade, FIXTURE_3_THREE_TEAM.goldens.teamF.grade);
    assert.strictEqual(f.score, FIXTURE_3_THREE_TEAM.goldens.teamF.score);
    assert.strictEqual(f.tradeValueChange, FIXTURE_3_THREE_TEAM.goldens.teamF.tradeValueChange);
  });

  it("team G (gives 35, receives 35) → C / 75 / tradeValueChange 0", () => {
    const result = useLiveTradeGrade(teams, transfers)!;
    const g = result.find((r) => r.teamId === "G")!;
    assert.strictEqual(g.grade, FIXTURE_3_THREE_TEAM.goldens.teamG.grade);
    assert.strictEqual(g.score, FIXTURE_3_THREE_TEAM.goldens.teamG.score);
    assert.strictEqual(g.tradeValueChange, FIXTURE_3_THREE_TEAM.goldens.teamG.tradeValueChange);
  });
});

describe("useLiveTradeGrade — null guard", () => {
  it("returns null when teams is undefined", () => {
    assert.strictEqual(useLiveTradeGrade(undefined, []), null);
  });

  it("returns null when transfers is empty", () => {
    const team = makeTeam("X", [makePlayer("px", 20)]);
    assert.strictEqual(useLiveTradeGrade([team], []), null);
  });

  it("returns null when a player has a non-numeric tradeValue", () => {
    const badTeam = {
      ...makeTeam("X", []),
      roster: [{ ...makePlayer("px", 0), tradeValue: NaN }],
    };
    const goodTeam = makeTeam("Y", [makePlayer("py", 30)]);
    const transfers = [{ playerId: "px", fromTeamId: "X", toTeamId: "Y" }];
    assert.strictEqual(useLiveTradeGrade([badTeam, goodTeam], transfers), null);
  });
});
