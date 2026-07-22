/**
 * MIRROR CONTRACT — parity tests for the grading formula.
 *
 * SOURCE OF TRUTH: artifacts/api-server/src/lib/tradeSimulator.ts
 *   — calculateGrade() (exported)
 *
 * These golden fixtures MUST be kept in sync with:
 *   artifacts/trade-sim/src/hooks/__tests__/useLiveTradeGrade.test.ts
 *
 * Goldens were frozen at pin ab68b83 and must not be changed without a
 * corresponding formula change in BOTH tradeSimulator.ts AND
 * useLiveTradeGrade.ts.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateGrade } from "../tradeSimulator.ts";

// ─── Golden fixtures ──────────────────────────────────────────────────────────

const FIXTURE_1_LOPSIDED = {
  teamA: { valueGiven: 50, valueReceived: 20, tradeValueChange: -30, rosterValueBefore: 50 },
  teamB: { valueGiven: 20, valueReceived: 50, tradeValueChange: 30, rosterValueBefore: 20 },
  goldens: {
    teamA: { grade: "F", score: 36, gradeRationale: "Giving up 60% more value than receiving." },
    teamB: { grade: "A+", score: 100, gradeRationale: "Receiving 150% more value than giving up." },
  },
} as const;

const FIXTURE_2_EVEN = {
  teamC: { valueGiven: 30, valueReceived: 30, tradeValueChange: 0, rosterValueBefore: 30 },
  teamD: { valueGiven: 30, valueReceived: 30, tradeValueChange: 0, rosterValueBefore: 30 },
  goldens: {
    teamC: { grade: "C", score: 75, gradeRationale: "Roughly even swap (within 5% value)." },
    teamD: { grade: "C", score: 75, gradeRationale: "Roughly even swap (within 5% value)." },
  },
} as const;

const FIXTURE_3_THREE_TEAM = {
  teamE: { valueGiven: 40, valueReceived: 35, tradeValueChange: -5, rosterValueBefore: 40 },
  teamF: { valueGiven: 35, valueReceived: 40, tradeValueChange: 5, rosterValueBefore: 35 },
  teamG: { valueGiven: 35, valueReceived: 35, tradeValueChange: 0, rosterValueBefore: 35 },
  goldens: {
    teamE: { grade: "D+", score: 67, gradeRationale: "Giving up 12% more value than receiving." },
    teamF: { grade: "B", score: 85, gradeRationale: "Receiving 14% more value than giving up." },
    teamG: { grade: "C", score: 75, gradeRationale: "Roughly even swap (within 5% value)." },
  },
} as const;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("calculateGrade — fixture 1: lopsided 2-team trade", () => {
  it("team A (gives 50, receives 20) → F / 36", () => {
    const { valueGiven, valueReceived, tradeValueChange, rosterValueBefore } = FIXTURE_1_LOPSIDED.teamA;
    const result = calculateGrade(valueGiven, valueReceived, tradeValueChange, rosterValueBefore);
    assert.strictEqual(result.grade, FIXTURE_1_LOPSIDED.goldens.teamA.grade);
    assert.strictEqual(result.score, FIXTURE_1_LOPSIDED.goldens.teamA.score);
    assert.strictEqual(result.gradeRationale, FIXTURE_1_LOPSIDED.goldens.teamA.gradeRationale);
  });

  it("team B (gives 20, receives 50) → A+ / 100", () => {
    const { valueGiven, valueReceived, tradeValueChange, rosterValueBefore } = FIXTURE_1_LOPSIDED.teamB;
    const result = calculateGrade(valueGiven, valueReceived, tradeValueChange, rosterValueBefore);
    assert.strictEqual(result.grade, FIXTURE_1_LOPSIDED.goldens.teamB.grade);
    assert.strictEqual(result.score, FIXTURE_1_LOPSIDED.goldens.teamB.score);
    assert.strictEqual(result.gradeRationale, FIXTURE_1_LOPSIDED.goldens.teamB.gradeRationale);
  });
});

describe("calculateGrade — fixture 2: even 2-team trade", () => {
  it("team C (gives 30, receives 30) → C / 75", () => {
    const { valueGiven, valueReceived, tradeValueChange, rosterValueBefore } = FIXTURE_2_EVEN.teamC;
    const result = calculateGrade(valueGiven, valueReceived, tradeValueChange, rosterValueBefore);
    assert.strictEqual(result.grade, FIXTURE_2_EVEN.goldens.teamC.grade);
    assert.strictEqual(result.score, FIXTURE_2_EVEN.goldens.teamC.score);
    assert.strictEqual(result.gradeRationale, FIXTURE_2_EVEN.goldens.teamC.gradeRationale);
  });

  it("team D (gives 30, receives 30) → C / 75", () => {
    const { valueGiven, valueReceived, tradeValueChange, rosterValueBefore } = FIXTURE_2_EVEN.teamD;
    const result = calculateGrade(valueGiven, valueReceived, tradeValueChange, rosterValueBefore);
    assert.strictEqual(result.grade, FIXTURE_2_EVEN.goldens.teamD.grade);
    assert.strictEqual(result.score, FIXTURE_2_EVEN.goldens.teamD.score);
    assert.strictEqual(result.gradeRationale, FIXTURE_2_EVEN.goldens.teamD.gradeRationale);
  });
});

describe("calculateGrade — fixture 3: 3-team circular trade", () => {
  it("team E (gives 40, receives 35) → D+ / 67", () => {
    const { valueGiven, valueReceived, tradeValueChange, rosterValueBefore } = FIXTURE_3_THREE_TEAM.teamE;
    const result = calculateGrade(valueGiven, valueReceived, tradeValueChange, rosterValueBefore);
    assert.strictEqual(result.grade, FIXTURE_3_THREE_TEAM.goldens.teamE.grade);
    assert.strictEqual(result.score, FIXTURE_3_THREE_TEAM.goldens.teamE.score);
    assert.strictEqual(result.gradeRationale, FIXTURE_3_THREE_TEAM.goldens.teamE.gradeRationale);
  });

  it("team F (gives 35, receives 40) → B / 85", () => {
    const { valueGiven, valueReceived, tradeValueChange, rosterValueBefore } = FIXTURE_3_THREE_TEAM.teamF;
    const result = calculateGrade(valueGiven, valueReceived, tradeValueChange, rosterValueBefore);
    assert.strictEqual(result.grade, FIXTURE_3_THREE_TEAM.goldens.teamF.grade);
    assert.strictEqual(result.score, FIXTURE_3_THREE_TEAM.goldens.teamF.score);
    assert.strictEqual(result.gradeRationale, FIXTURE_3_THREE_TEAM.goldens.teamF.gradeRationale);
  });

  it("team G (gives 35, receives 35) → C / 75", () => {
    const { valueGiven, valueReceived, tradeValueChange, rosterValueBefore } = FIXTURE_3_THREE_TEAM.teamG;
    const result = calculateGrade(valueGiven, valueReceived, tradeValueChange, rosterValueBefore);
    assert.strictEqual(result.grade, FIXTURE_3_THREE_TEAM.goldens.teamG.grade);
    assert.strictEqual(result.score, FIXTURE_3_THREE_TEAM.goldens.teamG.score);
    assert.strictEqual(result.gradeRationale, FIXTURE_3_THREE_TEAM.goldens.teamG.gradeRationale);
  });
});

describe("calculateGrade — edge cases", () => {
  it("no players exchanged → C / 70", () => {
    const result = calculateGrade(0, 0, 0, 100);
    assert.strictEqual(result.grade, "C");
    assert.strictEqual(result.score, 70);
    assert.strictEqual(result.gradeRationale, "No measurable value moved on this side.");
  });

  it("receives value, gives nothing → A+ / 100", () => {
    const result = calculateGrade(0, 40, 40, 0);
    assert.strictEqual(result.grade, "A+");
    assert.strictEqual(result.score, 100);
  });

  it("gives value, receives nothing → F / 20", () => {
    const result = calculateGrade(40, 0, -40, 40);
    assert.strictEqual(result.grade, "F");
    assert.strictEqual(result.score, 20);
  });
});
