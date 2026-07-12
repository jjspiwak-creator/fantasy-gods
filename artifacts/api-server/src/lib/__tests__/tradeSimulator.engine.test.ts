import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Team as ApiTeam, LeagueSettings as ApiLeagueSettings } from "@workspace/api-zod";
import { simulateTrade, TradeRejectedError } from "../tradeSimulator.ts";

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function makePlayer(
  id: string,
  position: string,
  tradeValue: number,
  isStarter = true,
): ApiTeam["roster"][number] {
  return {
    id,
    name: `Player ${id}`,
    position,
    nflTeam: "KC",
    points: 0,
    projectedPoints: 0,
    tradeValue,
    isStarter,
    injuryStatus: null,
  };
}

function makeTeam(id: string, players: ApiTeam["roster"]): ApiTeam {
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
    totalTradeValue: players.reduce((s: number, p: ApiTeam["roster"][number]) => s + p.tradeValue, 0),
    roster: players,
  };
}

/**
 * Builds a minimal but structurally complete ApiLeagueSettings with the
 * provided lineupSlotCounts. All other required fields are populated with
 * inert defaults.
 */
function makeSettings(lineupSlotCounts: Record<string, number>): ApiLeagueSettings {
  return {
    name: "Test League",
    size: 2,
    draftSettings: {
      type: "SNAKE",
      timePerSelection: 60,
      auctionBudget: 200,
      pickOrder: [1, 2],
    },
    rosterSettings: { lineupSlotCounts },
    scoringSettings: { scoringType: "H2H_POINTS", scoringItems: [] },
    acquisitionSettings: {
      acquisitionType: "WAIVERS_TRADITIONAL",
      acquisitionBudget: 100,
      isUsingAcquisitionBudget: false,
      minimumBid: 1,
      waiverHours: 24,
      waiverProcessDays: ["MONDAY"],
      waiverProcessHour: 11,
      waiverOrderReset: true,
    },
    tradeSettings: {
      deadlineDate: 9_999_999_999_999,
      max: 10,
      revisionHours: 24,
      vetoVotesRequired: 4,
      allowOutOfUniverse: false,
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("simulateTrade — engine gate and legacy response shape", () => {

  // ── Test 1 ────────────────────────────────────────────────────────────────
  it("legal QB-for-QB trade passes the engine gate and response keys match legacy shape", () => {
    const teamA = makeTeam("A", [makePlayer("P1", "QB", 100, true)]);
    const teamB = makeTeam("B", [makePlayer("P2", "QB", 80, true)]);

    const result = simulateTrade(
      "LEAGUE_1",
      [
        { playerId: "P1", fromTeamId: "A", toTeamId: "B" },
        { playerId: "P2", fromTeamId: "B", toTeamId: "A" },
      ],
      [teamA, teamB],
    );

    assert.strictEqual(result.leagueId, "LEAGUE_1");
    assert.ok(Array.isArray(result.teamResults));
    assert.strictEqual(result.teamResults.length, 2);
    assert.ok(typeof result.overallBalance === "number");
    assert.ok(typeof result.summary === "string");
    assert.ok(typeof result.hasRosterOverflow === "boolean");
    assert.ok(Array.isArray(result.leagueWarnings));

    const keys = Object.keys(result).sort();
    assert.deepStrictEqual(keys, [
      "hasRosterOverflow",
      "leagueId",
      "leagueWarnings",
      "overallBalance",
      "summary",
      "teamResults",
    ]);
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────
  it("roster-cap violation is caught by the engine and throws TradeRejectedError", () => {
    // BENCH cap = 1. TeamA starts with empty bench. TeamB sends 2 players to TeamA.
    // Resolver places both in BENCH; executeTransaction catches the 2nd placement
    // exceeding the cap and throws.
    const settings = makeSettings({ "20": 1 });

    const teamA = makeTeam("A", []);
    const teamB = makeTeam("B", [
      makePlayer("P2", "RB", 50, false),
      makePlayer("P3", "WR", 40, false),
    ]);

    assert.throws(
      () =>
        simulateTrade(
          "LEAGUE_2",
          [
            { playerId: "P2", fromTeamId: "B", toTeamId: "A" },
            { playerId: "P3", fromTeamId: "B", toTeamId: "A" },
          ],
          [teamA, teamB],
          settings,
        ),
      (err: unknown) => {
        assert.ok(err instanceof TradeRejectedError);
        assert.match((err as TradeRejectedError).message, /cap exceeded/i);
        return true;
      },
    );
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────
  it("position-ineligible player throws TradeRejectedError with no-slot message", () => {
    // Settings only define STARTER_QB (slot 0). slotEligibility["STARTER_QB"] = ["QB"].
    // Sending a RB into a QB-only environment has no eligible target slot.
    const settings = makeSettings({ "0": 1 });

    const teamA = makeTeam("A", [makePlayer("P1", "QB", 100, true)]);
    const teamB = makeTeam("B", [makePlayer("P2", "RB", 60, false)]);

    assert.throws(
      () =>
        simulateTrade(
          "LEAGUE_3",
          [
            { playerId: "P1", fromTeamId: "A", toTeamId: "B" },
            { playerId: "P2", fromTeamId: "B", toTeamId: "A" },
          ],
          [teamA, teamB],
          settings,
        ),
      (err: unknown) => {
        assert.ok(err instanceof TradeRejectedError);
        assert.match((err as TradeRejectedError).message, /ineligible|no valid slot/i);
        return true;
      },
    );
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────
  it("unknown playerId throws TradeRejectedError — no silent skip", () => {
    const teamA = makeTeam("A", [makePlayer("P1", "QB", 100, true)]);
    const teamB = makeTeam("B", [makePlayer("P2", "QB", 80, true)]);

    assert.throws(
      () =>
        simulateTrade(
          "LEAGUE_4",
          [{ playerId: "GHOST", fromTeamId: "A", toTeamId: "B" }],
          [teamA, teamB],
        ),
      (err: unknown) => {
        assert.ok(err instanceof TradeRejectedError);
        assert.match((err as TradeRejectedError).message, /Unknown player 'GHOST'/);
        return true;
      },
    );
  });

  // ── Test 5 ────────────────────────────────────────────────────────────────
  it("resolver: vacated-slot reuse — QB-for-QB trade with only STARTER_QB slot passes", () => {
    // Settings define only STARTER_QB (cap 1). No bench slot exists.
    // Each team's QB vacates STARTER_QB; the incoming QB reuses that slot.
    // If vacated-slot reuse did NOT work, the resolver would find no room
    // and throw — so a successful result proves the vacated-slot path fired.
    const settings = makeSettings({ "0": 1 });

    const teamA = makeTeam("A", [makePlayer("P1", "QB", 100, true)]);
    const teamB = makeTeam("B", [makePlayer("P2", "QB", 80, true)]);

    const result = simulateTrade(
      "LEAGUE_5",
      [
        { playerId: "P1", fromTeamId: "A", toTeamId: "B" },
        { playerId: "P2", fromTeamId: "B", toTeamId: "A" },
      ],
      [teamA, teamB],
      settings,
    );

    assert.strictEqual(result.leagueId, "LEAGUE_5");
    assert.ok(!result.hasRosterOverflow);
  });

  // ── Test 6 ────────────────────────────────────────────────────────────────
  it("resolver: bench fallback — RB lands in BENCH when vacated QB slot is ineligible", () => {
    // Settings: STARTER_QB cap=1, BENCH cap=3.
    // TeamA has QB P1 (fills STARTER_QB). TeamB has RB P2 in BENCH.
    // After the trade: P2 (RB) arrives at TeamA. The vacated slot is STARTER_QB
    // which only allows QB — so P2 falls through to BENCH (path 2: bench fallback).
    // Trade succeeds, proving the bench-fallback path was taken.
    const settings = makeSettings({ "0": 1, "20": 3 });

    const teamA = makeTeam("A", [makePlayer("P1", "QB", 100, true)]);
    const teamB = makeTeam("B", [makePlayer("P2", "RB", 60, false)]);

    const result = simulateTrade(
      "LEAGUE_6",
      [
        { playerId: "P1", fromTeamId: "A", toTeamId: "B" },
        { playerId: "P2", fromTeamId: "B", toTeamId: "A" },
      ],
      [teamA, teamB],
      settings,
    );

    assert.strictEqual(result.leagueId, "LEAGUE_6");
  });

  // ── Test 7 ────────────────────────────────────────────────────────────────
  it("resolver: no-slot-available rejection when all eligible slots are at capacity", () => {
    // Settings: STARTER_QB cap=1, BENCH cap=1.
    // TeamA already has QB P1 in STARTER_QB and P_bench in BENCH (both full).
    // TeamB sends QB P3 to TeamA without receiving anything.
    // Neither slot has room for P3 → SlotResolveError wrapped as TradeRejectedError.
    const settings = makeSettings({ "0": 1, "20": 1 });

    const teamA = makeTeam("A", [
      makePlayer("P1", "QB", 100, true),
      makePlayer("P_bench", "RB", 40, false),
    ]);
    const teamB = makeTeam("B", [makePlayer("P3", "QB", 90, true)]);

    assert.throws(
      () =>
        simulateTrade(
          "LEAGUE_7",
          [{ playerId: "P3", fromTeamId: "B", toTeamId: "A" }],
          [teamA, teamB],
          settings,
        ),
      (err: unknown) => {
        assert.ok(err instanceof TradeRejectedError);
        assert.match(
          (err as TradeRejectedError).message,
          /no valid slot|at capacity|ineligible/i,
        );
        return true;
      },
    );
  });
});
