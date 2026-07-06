import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { generateDraftMatrix } from "../utils/draftUtils.ts";
import {
  setPlayerSelection,
  clearPlayerSelection,
  executeMoveTransaction,
  routeDroppedPlayer,
} from "../utils/transactionHandler.ts";
import { undoLastPlayerMove } from "../utils/valuationEngine.ts";
import type {
  LeagueSettings,
  Player,
  TeamRoster,
} from "../types/league.ts";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSettings(overrides?: Partial<LeagueSettings>): LeagueSettings {
  return {
    leagueId: "test-league",
    leagueStyle: "lineup",
    draftType: "snake",
    tieBreakerMetric: "points_for",
    waiverSystem: "faab_with_rolling_tiebreaker",
    draftClockDuration: 90,
    useLeagueMedian: false,
    divisionIds: [],
    scoringRules: { passingYards: 0.04, passingTD: 4, rushingYards: 0.1, rushingTD: 6 },
    slotRequirements: { STARTER_QB: 1, STARTER_RB: 2, BENCH: 5 },
    rosterCaps: { STARTER_QB: 2, STARTER_RB: 4, BENCH: 7 },
    totalAuctionBudget: 200,
    ...overrides,
  };
}

function makeTeams(count: number): TeamRoster[] {
  return Array.from({ length: count }, (_, i) => ({
    teamId: `T${i + 1}`,
    teamName: `Team ${i + 1}`,
    managerName: `Manager ${i + 1}`,
    divisionId: null,
    financialBalances: {},
    rosterSlots: { STARTER_QB: [], STARTER_RB: [], BENCH: [] },
    draftQueue: [],
    isAutoDraftActive: false,
    waiverRank: i + 1,
    keeperRules: {},
    futureAssets: [],
  }));
}

function makePlayer(id: string, overrides?: Partial<Player>): Player {
  return {
    id,
    name: `Player ${id}`,
    realTeam: "KC",
    byeWeek: 7,
    eligiblePositions: ["QB"],
    lockStatus: "free",
    acquiredTimestamp: null,
    activeSelectionByTeamId: null,
    lastMovedByTeamId: null,
    isMostRecentMoveForTeam: false,
    playerHistoryStack: [],
    efficiencyMetrics: {
      targetShare: 0.3,
      firstReadShare: 0.5,
      yprr: 1.2,
      yardsBeforeContact: 2.1,
      stuffedRate: 0.08,
    },
    schemeModifiers: { teamProe: 0.05, motionRate: 0.22, personnelType: "11" },
    riskProfile: { injuryRiskMultiplier: 0.9, suspensionWeeks: 0, holdoutRisk: false },
    contingencyValue: { handcuffId: null, upsideMultiplierIfPrimaryRemoved: 1 },
    weeklyProjections: {},
    customMetadata: {},
    ...overrides,
  };
}

// Fixed anchor: July 5 2026 at noon EDT (16:00 UTC) — safely midday, no midnight edge cases.
const ANCHOR_NOW = new Date("2026-07-05T16:00:00Z").getTime();
const SAME_DAY_MS = ANCHOR_NOW - 30 * 60 * 1000;           // 30 min before anchor
const YESTERDAY_MS = ANCHOR_NOW - 25 * 60 * 60 * 1000;     // 25 h before = prior calendar day
const THREE_DAYS_AGO_MS = ANCHOR_NOW - 3 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// 1. 3RR Pick-Flipping Algorithm
// ─────────────────────────────────────────────────────────────────────────────

describe("3RR draft matrix pick-flipping", () => {
  const teams = makeTeams(4);
  const settings = makeSettings({ draftType: "3rr" });
  let slots: ReturnType<typeof generateDraftMatrix>;

  before(() => {
    slots = generateDraftMatrix(settings, teams, 4);
  });

  it("Round 1 is ascending: T1 T2 T3 T4", () => {
    const r1 = slots.filter((s) => s.round === 1).map((s) => s.currentOwnerId);
    assert.deepStrictEqual(r1, ["T1", "T2", "T3", "T4"]);
  });

  it("Round 2 is descending (standard snake reversal): T4 T3 T2 T1", () => {
    const r2 = slots.filter((s) => s.round === 2).map((s) => s.currentOwnerId);
    assert.deepStrictEqual(r2, ["T4", "T3", "T2", "T1"]);
  });

  it("Round 3 is also descending (3RR stays inverted): T4 T3 T2 T1", () => {
    const r3 = slots.filter((s) => s.round === 3).map((s) => s.currentOwnerId);
    assert.deepStrictEqual(r3, ["T4", "T3", "T2", "T1"]);
  });

  it("Round 4 returns to ascending (snake resumes): T1 T2 T3 T4", () => {
    const r4 = slots.filter((s) => s.round === 4).map((s) => s.currentOwnerId);
    assert.deepStrictEqual(r4, ["T1", "T2", "T3", "T4"]);
  });

  it("Rounds 2 and 3 have identical pick order (the core 3RR invariant)", () => {
    const r2 = slots.filter((s) => s.round === 2).map((s) => s.currentOwnerId);
    const r3 = slots.filter((s) => s.round === 3).map((s) => s.currentOwnerId);
    assert.deepStrictEqual(r3, r2);
  });

  it("overallIndex is sequential across all rounds", () => {
    slots.forEach((s, i) => assert.strictEqual(s.overallIndex, i));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Selection vs Move State — select/deselect leaves zero move trace
// ─────────────────────────────────────────────────────────────────────────────

describe("Player selection state — selecting and deselecting leaves zero move trace", () => {
  it("setPlayerSelection sets activeSelectionByTeamId but leaves move fields untouched", () => {
    const players = { P1: makePlayer("P1") };
    const updated = setPlayerSelection(players, "P1", "T1");
    assert.strictEqual(updated["P1"].activeSelectionByTeamId, "T1");
    assert.strictEqual(updated["P1"].lastMovedByTeamId, null);
    assert.strictEqual(updated["P1"].isMostRecentMoveForTeam, false);
    assert.strictEqual(updated["P1"].playerHistoryStack.length, 0);
  });

  it("clearPlayerSelection resets activeSelectionByTeamId without altering move state", () => {
    const players = { P1: makePlayer("P1") };
    const afterSelect = setPlayerSelection(players, "P1", "T1");
    const afterClear = clearPlayerSelection(afterSelect, "P1");
    assert.strictEqual(afterClear["P1"].activeSelectionByTeamId, null);
    assert.strictEqual(afterClear["P1"].lastMovedByTeamId, null);
    assert.strictEqual(afterClear["P1"].isMostRecentMoveForTeam, false);
    assert.strictEqual(afterClear["P1"].playerHistoryStack.length, 0);
  });

  it("full select→deselect cycle leaves all move-related fields identical to original", () => {
    const original = makePlayer("P1");
    const players = { P1: original };
    const afterCycle = clearPlayerSelection(setPlayerSelection(players, "P1", "T1"), "P1");
    assert.strictEqual(afterCycle["P1"].lastMovedByTeamId, original.lastMovedByTeamId);
    assert.strictEqual(afterCycle["P1"].isMostRecentMoveForTeam, original.isMostRecentMoveForTeam);
    assert.deepStrictEqual(afterCycle["P1"].playerHistoryStack, original.playerHistoryStack);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Roster Churn — Drop Destination Routing (injected timestamps)
// ─────────────────────────────────────────────────────────────────────────────

describe("routeDroppedPlayer — same-day vs held-past-midnight routing", () => {
  it("routes to FREE_AGENT when acquiredTimestamp is null (never acquired)", () => {
    assert.strictEqual(
      routeDroppedPlayer(makePlayer("P1", { acquiredTimestamp: null }), ANCHOR_NOW),
      "FREE_AGENT",
    );
  });

  it("routes to FREE_AGENT when acquired 30 minutes ago (same calendar day)", () => {
    assert.strictEqual(
      routeDroppedPlayer(makePlayer("P1", { acquiredTimestamp: SAME_DAY_MS }), ANCHOR_NOW),
      "FREE_AGENT",
    );
  });

  it("routes to FREE_AGENT when acquired seconds ago", () => {
    assert.strictEqual(
      routeDroppedPlayer(makePlayer("P1", { acquiredTimestamp: ANCHOR_NOW - 1000 }), ANCHOR_NOW),
      "FREE_AGENT",
    );
  });

  it("routes to WAIVER_COLUMN when acquired 25 hours ago (prior calendar day)", () => {
    assert.strictEqual(
      routeDroppedPlayer(makePlayer("P1", { acquiredTimestamp: YESTERDAY_MS }), ANCHOR_NOW),
      "WAIVER_COLUMN",
    );
  });

  it("routes to WAIVER_COLUMN when acquired 3 days ago", () => {
    assert.strictEqual(
      routeDroppedPlayer(makePlayer("P1", { acquiredTimestamp: THREE_DAYS_AGO_MS }), ANCHOR_NOW),
      "WAIVER_COLUMN",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Asset-Isolated History Pop
// ─────────────────────────────────────────────────────────────────────────────

describe("undoLastPlayerMove — only the target player's stack is mutated", () => {
  const settings = makeSettings();

  function buildFixtures() {
    let players: Record<string, Player> = {
      P1: makePlayer("P1"),
      P2: makePlayer("P2"),
    };
    let teams: Record<string, TeamRoster> = {
      T1: {
        ...makeTeams(1)[0],
        rosterSlots: { STARTER_QB: ["P1"], STARTER_RB: ["P2"], BENCH: [] },
      },
    };

    // Build P1's history: BENCH → STARTER_QB (2 frames)
    ({ players, teams } = executeMoveTransaction(players, teams, "P1", "BENCH", "T1", settings));
    ({ players, teams } = executeMoveTransaction(players, teams, "P1", "STARTER_QB", "T1", settings));
    // Build P2's independent history: STARTER_RB (1 frame)
    ({ players, teams } = executeMoveTransaction(players, teams, "P2", "STARTER_RB", "T1", settings));
    return { players, teams };
  }

  it("pops exactly one frame from the target player's history", () => {
    const { players, teams } = buildFixtures();
    const stackBefore = players["P1"].playerHistoryStack.length;
    const { players: updated } = undoLastPlayerMove("P1", players, teams);
    assert.strictEqual(updated["P1"].playerHistoryStack.length, stackBefore - 1);
  });

  it("leaves P2's history stack completely untouched", () => {
    const { players, teams } = buildFixtures();
    const p2StackBefore = [...players["P2"].playerHistoryStack];
    const { players: updated } = undoLastPlayerMove("P1", players, teams);
    assert.deepStrictEqual(updated["P2"].playerHistoryStack, p2StackBefore);
  });

  it("leaves P2's lastMovedByTeamId and isMostRecentMoveForTeam unchanged", () => {
    const { players, teams } = buildFixtures();
    const before = players["P2"];
    const { players: updated } = undoLastPlayerMove("P1", players, teams);
    assert.strictEqual(updated["P2"].lastMovedByTeamId, before.lastMovedByTeamId);
    assert.strictEqual(updated["P2"].isMostRecentMoveForTeam, before.isMostRecentMoveForTeam);
  });

  it("returns the popped frame for caller inspection", () => {
    const { players, teams } = buildFixtures();
    const topFrame = players["P1"].playerHistoryStack.at(-1)!;
    const { poppedFrame } = undoLastPlayerMove("P1", players, teams);
    assert.deepStrictEqual(poppedFrame, topFrame);
  });

  it("throws when the player has no history to undo", () => {
    const { players, teams } = buildFixtures();
    const freshPlayers = { ...players, P99: makePlayer("P99") };
    assert.throws(() => undoLastPlayerMove("P99", freshPlayers, teams), /no move history/i);
  });

  it("throws for a nonexistent player ID", () => {
    const { players, teams } = buildFixtures();
    assert.throws(() => undoLastPlayerMove("GHOST", players, teams), /not found/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Undo Round-Trip — two moves then two undos, no vanishing
// ─────────────────────────────────────────────────────────────────────────────

describe("undo round-trip — two moves then two undos return player to exact original state", () => {
  it("player ends up on exact original team, slot, and acquiredTimestamp after double undo", () => {
    const settings = makeSettings();
    const originalTimestamp = THREE_DAYS_AGO_MS;

    let players: Record<string, Player> = {
      P1: makePlayer("P1", { acquiredTimestamp: originalTimestamp }),
    };
    let teams: Record<string, TeamRoster> = {
      T1: {
        ...makeTeams(1)[0],
        rosterSlots: { STARTER_QB: ["P1"], BENCH: [] },
      },
    };

    // Two moves (slot shuffles on T1 — acquiredTimestamp must be preserved)
    ({ players, teams } = executeMoveTransaction(players, teams, "P1", "BENCH", "T1", settings));
    ({ players, teams } = executeMoveTransaction(players, teams, "P1", "STARTER_QB", "T1", settings));

    assert.strictEqual(
      players["P1"].acquiredTimestamp,
      originalTimestamp,
      "acquiredTimestamp must be preserved across slot shuffles",
    );

    // Two undos
    ({ players, teams } = undoLastPlayerMove("P1", players, teams));
    ({ players, teams } = undoLastPlayerMove("P1", players, teams));

    // Back to original state
    assert.strictEqual(
      players["P1"].acquiredTimestamp,
      originalTimestamp,
      "acquiredTimestamp must be restored after two undos",
    );
    assert.ok(
      teams["T1"].rosterSlots["STARTER_QB"]?.includes("P1"),
      "P1 must be in STARTER_QB after double undo",
    );
    assert.ok(
      !(teams["T1"].rosterSlots["BENCH"] ?? []).includes("P1"),
      "P1 must NOT be in BENCH after double undo",
    );
    assert.strictEqual(players["P1"].playerHistoryStack.length, 0, "History stack must be empty");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Waiver Clock — slot shuffle must not reset acquiredTimestamp
// ─────────────────────────────────────────────────────────────────────────────

describe("waiver clock — slot shuffle does not reset acquiredTimestamp", () => {
  it("player acquired 3 days ago, shuffled between slots today, dropped today routes to WAIVER_COLUMN", () => {
    const settings = makeSettings();

    let players: Record<string, Player> = {
      P1: makePlayer("P1", {
        eligiblePositions: ["QB"],
        acquiredTimestamp: THREE_DAYS_AGO_MS,
      }),
    };
    let teams: Record<string, TeamRoster> = {
      T1: {
        ...makeTeams(1)[0],
        rosterSlots: { STARTER_QB: ["P1"], BENCH: [] },
      },
    };

    // Slot shuffle: STARTER_QB → BENCH (same team, must not reset clock)
    ({ players, teams } = executeMoveTransaction(
      players,
      teams,
      "P1",
      "BENCH",
      "T1",
      settings,
    ));

    assert.strictEqual(
      players["P1"].acquiredTimestamp,
      THREE_DAYS_AGO_MS,
      "acquiredTimestamp must not be reset by a slot shuffle",
    );

    // Drop today at ANCHOR_NOW → must go to WAIVER_COLUMN
    assert.strictEqual(
      routeDroppedPlayer(players["P1"], ANCHOR_NOW),
      "WAIVER_COLUMN",
      "player held since 3 days ago must route to WAIVER_COLUMN when dropped today",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. executeMoveTransaction — validation and cross-team semantics
// ─────────────────────────────────────────────────────────────────────────────

describe("executeMoveTransaction — validation and cross-team semantics", () => {
  it("throws on roster-cap violation with state unchanged", () => {
    const capsSettings = makeSettings({
      rosterCaps: { STARTER_QB: 1, BENCH: 1 },
      slotRequirements: { STARTER_QB: 1, BENCH: 1 },
    });
    const players: Record<string, Player> = {
      P1: makePlayer("P1", { eligiblePositions: ["QB"] }),
      P2: makePlayer("P2", { eligiblePositions: ["QB"] }),
      P3: makePlayer("P3", { eligiblePositions: ["QB"] }),
    };
    const teams: Record<string, TeamRoster> = {
      T1: {
        ...makeTeams(1)[0],
        rosterSlots: { STARTER_QB: ["P1"], BENCH: ["P2"] },
      },
    };

    // P3 is a free agent; trying to move into already-at-cap STARTER_QB must throw.
    assert.throws(
      () => executeMoveTransaction(players, teams, "P3", "STARTER_QB", "T1", capsSettings),
      /cap exceeded/i,
    );

    // Original state must be completely unchanged.
    assert.ok(!teams["T1"].rosterSlots["STARTER_QB"].includes("P3"));
    assert.ok(!teams["T1"].rosterSlots["BENCH"]?.includes("P3"));
  });

  it("throws on ineligible position with state unchanged", () => {
    const eligSettings = makeSettings({
      slotEligibility: { STARTER_QB: ["QB"] },
    });
    const players: Record<string, Player> = {
      P1: makePlayer("P1", { eligiblePositions: ["RB"] }),
    };
    const teams: Record<string, TeamRoster> = {
      T1: { ...makeTeams(1)[0], rosterSlots: { STARTER_QB: [], BENCH: [] } },
    };

    assert.throws(
      () => executeMoveTransaction(players, teams, "P1", "STARTER_QB", "T1", eligSettings),
      /ineligible/i,
    );
    assert.ok(!teams["T1"].rosterSlots["STARTER_QB"].includes("P1"));
  });

  it("cross-team move removes player from source team and adds to target team", () => {
    const settings = makeSettings();
    const players: Record<string, Player> = {
      P1: makePlayer("P1", { eligiblePositions: ["QB"] }),
    };
    const twoTeams = makeTeams(2);
    const teams: Record<string, TeamRoster> = {
      T1: { ...twoTeams[0], rosterSlots: { STARTER_QB: ["P1"], BENCH: [] } },
      T2: { ...twoTeams[1], rosterSlots: { STARTER_QB: [], BENCH: [] } },
    };

    const { teams: afterTeams } = executeMoveTransaction(
      players,
      teams,
      "P1",
      "STARTER_QB",
      "T2",
      settings,
    );

    // P1 fully removed from T1.
    assert.ok(
      !Object.values(afterTeams["T1"].rosterSlots).flat().includes("P1"),
      "P1 must be removed from all T1 slots",
    );
    // P1 added to T2's STARTER_QB.
    assert.ok(
      afterTeams["T2"].rosterSlots["STARTER_QB"].includes("P1"),
      "P1 must be in T2's STARTER_QB after cross-team move",
    );
  });

  it("cross-team move stamps a new acquiredTimestamp (genuine acquisition)", () => {
    const settings = makeSettings();
    const before = Date.now();
    const players: Record<string, Player> = {
      P1: makePlayer("P1", { acquiredTimestamp: THREE_DAYS_AGO_MS }),
    };
    const twoTeams = makeTeams(2);
    const teams: Record<string, TeamRoster> = {
      T1: { ...twoTeams[0], rosterSlots: { STARTER_QB: ["P1"], BENCH: [] } },
      T2: { ...twoTeams[1], rosterSlots: { STARTER_QB: [], BENCH: [] } },
    };

    const { players: after } = executeMoveTransaction(
      players,
      teams,
      "P1",
      "STARTER_QB",
      "T2",
      settings,
    );
    const after_ts = after["P1"].acquiredTimestamp!;
    assert.ok(
      after_ts >= before,
      "cross-team acquisition must stamp a new acquiredTimestamp",
    );
    assert.ok(
      after_ts !== THREE_DAYS_AGO_MS,
      "acquiredTimestamp must not be the old value after a cross-team move",
    );
  });
});
