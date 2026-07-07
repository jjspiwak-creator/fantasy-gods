import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  adaptEspnLeague,
  type EspnLeagueInput,
} from "../adapters/espnAdapter.ts";
import { executeTransaction } from "../utils/transactionHandler.ts";

// ─── Realistic 10-team league fixture ────────────────────────────────────────
// Two fully rostered teams, six players total, one FLEX slot, FAAB budget.

const FIXTURE: EspnLeagueInput = {
  id: 336699,
  seasonId: 2025,
  currentMatchupPeriod: 4,
  settings: {
    name: "Fantasy Gods Test League",
    size: 10,
    draftSettings: {
      type: "SNAKE",
      timePerSelection: 90,
    },
    rosterSettings: {
      lineupSlotCounts: {
        "0": 1,   // STARTER_QB  → 1
        "2": 2,   // STARTER_RB  → 2
        "4": 2,   // STARTER_WR  → 2
        "6": 1,   // STARTER_TE  → 1
        "16": 1,  // STARTER_DST → 1
        "17": 1,  // STARTER_K   → 1
        "23": 1,  // FLEX        → 1
        "20": 7,  // BENCH       → 7
        "21": 1,  // IR          → 1
      },
    },
    scoringSettings: {
      scoringType: "H2H_POINTS",
      scoringItems: [
        { statId: 3,  points: 0.04  },  // passingYards
        { statId: 4,  points: 4     },  // passingTD
        { statId: 20, points: 0.1   },  // rushingYards
        { statId: 21, points: 6     },  // rushingTD
        { statId: 42, points: 0.1   },  // receivingYards
        { statId: 43, points: 6     },  // receivingTD
        { statId: 72, points: 1     },  // pprReceptions (PPR)
      ],
    },
    financeSettings: {
      acquisitionBudget: 100,
    },
    waiverSettings: {
      type: "GAMEDAY_MORNING",
    },
    useLeagueMedian: false,
  },
  teams: [
    // ── Team 1: "Mahomes Marauders" ──────────────────────────────────────
    {
      id: 1,
      name: "Mahomes Marauders",
      abbrev: "MM",
      owners: ["mgr-001"],
      waiverRank: 3,
      record: { overall: { wins: 3, losses: 1, ties: 0 } },
      roster: {
        entries: [
          {
            playerId: 3139477,
            lineupSlotId: 0,   // STARTER_QB
            acquisitionDate: 1693000000000,
            playerPoolEntry: {
              acquisitionType: "DRAFT",
              injuryStatus: "ACTIVE",
              player: {
                id: 3139477,
                fullName: "Patrick Mahomes",
                defaultPositionId: 1,   // QB
                eligibleSlots: [0, 20, 21],
                proTeamId: 12,
                byeWeek: 6,
              },
            },
          },
          {
            playerId: 3054211,
            lineupSlotId: 2,   // STARTER_RB
            acquisitionDate: 1693000000000,
            playerPoolEntry: {
              acquisitionType: "DRAFT",
              injuryStatus: "ACTIVE",
              player: {
                id: 3054211,
                fullName: "Christian McCaffrey",
                defaultPositionId: 2,   // RB
                eligibleSlots: [2, 20, 21, 23],
                proTeamId: 25,
                byeWeek: 9,
              },
            },
          },
          {
            playerId: 4047365,
            lineupSlotId: 23,  // FLEX (WR playing flex)
            acquisitionDate: 1694500000000,
            playerPoolEntry: {
              acquisitionType: "WAIVER",
              injuryStatus: "ACTIVE",
              player: {
                id: 4047365,
                fullName: "Stefon Diggs",
                defaultPositionId: 3,   // WR
                eligibleSlots: [4, 20, 21, 23],
                proTeamId: 2,
                byeWeek: 14,
              },
            },
          },
        ],
      },
    },

    // ── Team 2: "Room Temperature IQ" ───────────────────────────────────
    {
      id: 2,
      name: "Room Temperature IQ",
      abbrev: "RTIQ",
      owners: ["mgr-002"],
      waiverRank: 7,
      record: { overall: { wins: 1, losses: 3, ties: 0 } },
      roster: {
        entries: [
          {
            playerId: 2330,
            lineupSlotId: 0,   // STARTER_QB
            acquisitionDate: 1693000000000,
            playerPoolEntry: {
              acquisitionType: "DRAFT",
              injuryStatus: "ACTIVE",
              player: {
                id: 2330,
                fullName: "Josh Allen",
                defaultPositionId: 1,   // QB
                eligibleSlots: [0, 20, 21],
                proTeamId: 2,
                byeWeek: 12,
              },
            },
          },
          {
            playerId: 3916387,
            lineupSlotId: 2,   // STARTER_RB
            acquisitionDate: 1693000000000,
            playerPoolEntry: {
              acquisitionType: "DRAFT",
              injuryStatus: "ACTIVE",
              player: {
                id: 3916387,
                fullName: "Derrick Henry",
                defaultPositionId: 2,   // RB
                eligibleSlots: [2, 20, 21, 23],
                proTeamId: 17,
                byeWeek: 14,
              },
            },
          },
          {
            playerId: 3054245,
            lineupSlotId: 23,  // FLEX (TE playing flex)
            acquisitionDate: 1693000000000,
            playerPoolEntry: {
              acquisitionType: "DRAFT",
              injuryStatus: "ACTIVE",
              player: {
                id: 3054245,
                fullName: "Travis Kelce",
                defaultPositionId: 4,   // TE
                eligibleSlots: [6, 20, 21, 23],
                proTeamId: 12,
                byeWeek: 6,
              },
            },
          },
        ],
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Player uniqueness — every rostered player ID appears exactly once
// ─────────────────────────────────────────────────────────────────────────────

describe("adaptEspnLeague — player uniqueness", () => {
  const { players, teams } = adaptEspnLeague(FIXTURE);

  it("every rostered player ID appears in the players map", () => {
    const allRosteredIds = Object.values(teams).flatMap((t) =>
      Object.values(t.rosterSlots).flat(),
    );
    for (const id of allRosteredIds) {
      assert.ok(id in players, `Player ${id} missing from players map`);
    }
  });

  it("no player ID appears more than once across all team rosterSlots", () => {
    const allIds = Object.values(teams).flatMap((t) =>
      Object.values(t.rosterSlots).flat(),
    );
    const counts: Record<string, number> = {};
    for (const id of allIds) counts[id] = (counts[id] ?? 0) + 1;
    for (const [id, count] of Object.entries(counts)) {
      assert.strictEqual(count, 1, `Player ${id} appears ${count} times`);
    }
  });

  it("total adapted player count equals total roster entries", () => {
    const totalEntries = FIXTURE.teams.reduce(
      (n, t) => n + t.roster.entries.length,
      0,
    );
    assert.strictEqual(Object.keys(players).length, totalEntries);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Settings derivation — slotRequirements, rosterCaps, slotEligibility
// ─────────────────────────────────────────────────────────────────────────────

describe("adaptEspnLeague — settings derivation", () => {
  const { settings } = adaptEspnLeague(FIXTURE);

  it("STARTER_QB cap = 1, requirement = 1", () => {
    assert.strictEqual(settings.rosterCaps["STARTER_QB"], 1);
    assert.strictEqual(settings.slotRequirements["STARTER_QB"], 1);
  });

  it("STARTER_RB cap = 2, requirement = 2", () => {
    assert.strictEqual(settings.rosterCaps["STARTER_RB"], 2);
    assert.strictEqual(settings.slotRequirements["STARTER_RB"], 2);
  });

  it("STARTER_WR cap = 2, requirement = 2", () => {
    assert.strictEqual(settings.rosterCaps["STARTER_WR"], 2);
    assert.strictEqual(settings.slotRequirements["STARTER_WR"], 2);
  });

  it("FLEX cap = 1, requirement = 1", () => {
    assert.strictEqual(settings.rosterCaps["FLEX"], 1);
    assert.strictEqual(settings.slotRequirements["FLEX"], 1);
  });

  it("BENCH cap = 7, requirement = 0 (optional fill)", () => {
    assert.strictEqual(settings.rosterCaps["BENCH"], 7);
    assert.strictEqual(settings.slotRequirements["BENCH"], 0);
  });

  it("IR cap = 1, requirement = 0 (optional fill)", () => {
    assert.strictEqual(settings.rosterCaps["IR"], 1);
    assert.strictEqual(settings.slotRequirements["IR"], 0);
  });

  it("slotEligibility.STARTER_QB = ['QB']", () => {
    assert.deepStrictEqual(settings.slotEligibility!["STARTER_QB"], ["QB"]);
  });

  it("slotEligibility.FLEX = ['RB', 'WR', 'TE']", () => {
    assert.deepStrictEqual(settings.slotEligibility!["FLEX"], ["RB", "WR", "TE"]);
  });

  it("slotEligibility has no entry for BENCH (no position restriction)", () => {
    assert.strictEqual(settings.slotEligibility!["BENCH"], undefined);
  });

  it("slotEligibility has no entry for IR (no position restriction)", () => {
    assert.strictEqual(settings.slotEligibility!["IR"], undefined);
  });

  it("scoringRules.passingYards = 0.04", () => {
    assert.strictEqual(settings.scoringRules["passingYards"], 0.04);
  });

  it("scoringRules.pprReceptions = 1 (PPR)", () => {
    assert.strictEqual(settings.scoringRules["pprReceptions"], 1);
  });

  it("FAAB budget seeded into each team's financialBalances", () => {
    const { teams } = adaptEspnLeague(FIXTURE);
    for (const team of Object.values(teams)) {
      assert.strictEqual(
        team.financialBalances["FAAB"],
        100,
        `Team ${team.teamId} missing FAAB balance`,
      );
    }
  });

  it("leagueId stringified from numeric input", () => {
    assert.strictEqual(settings.leagueId, "336699");
  });

  it("waiverSystem derived from ESPN type", () => {
    assert.strictEqual(settings.waiverSystem, "faab_with_rolling_tiebreaker");
  });

  it("draftType mapped from SNAKE", () => {
    assert.strictEqual(settings.draftType, "snake");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Player field correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("adaptEspnLeague — player field correctness", () => {
  const { players } = adaptEspnLeague(FIXTURE);

  it("Mahomes has eligiblePositions=['QB']", () => {
    assert.deepStrictEqual(players["3139477"].eligiblePositions, ["QB"]);
  });

  it("McCaffrey has eligiblePositions=['RB']", () => {
    assert.deepStrictEqual(players["3054211"].eligiblePositions, ["RB"]);
  });

  it("Kelce has eligiblePositions=['TE']", () => {
    assert.deepStrictEqual(players["3054245"].eligiblePositions, ["TE"]);
  });

  it("acquiredTimestamp populated from ESPN acquisitionDate", () => {
    assert.strictEqual(players["3139477"].acquiredTimestamp, 1693000000000);
  });

  it("lockStatus is 'free' for ACTIVE players", () => {
    for (const player of Object.values(players)) {
      assert.strictEqual(player.lockStatus, "free");
    }
  });

  it("playerHistoryStack starts empty on all players", () => {
    for (const player of Object.values(players)) {
      assert.strictEqual(player.playerHistoryStack.length, 0);
    }
  });

  it("efficiencyMetrics all zeros (ESPN cannot supply them)", () => {
    const m = players["3139477"].efficiencyMetrics;
    assert.strictEqual(m.targetShare, 0);
    assert.strictEqual(m.yprr, 0);
    assert.strictEqual(m.stuffedRate, 0);
  });

  it("riskProfile neutral (injuryRiskMultiplier=1, suspensionWeeks=0)", () => {
    const r = players["3139477"].riskProfile;
    assert.strictEqual(r.injuryRiskMultiplier, 1);
    assert.strictEqual(r.suspensionWeeks, 0);
    assert.strictEqual(r.holdoutRisk, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Smoke test — executeTransaction accepts adapted data
// ─────────────────────────────────────────────────────────────────────────────

describe("adaptEspnLeague — executeTransaction smoke test", () => {
  it("legal two-team QB swap succeeds", () => {
    const { settings, players, teams } = adaptEspnLeague(FIXTURE);

    // Team 1 (id "1") sends Mahomes ("3139477") → Team 2 into STARTER_QB
    // Team 2 (id "2") sends Josh Allen ("2330")  → Team 1 into STARTER_QB
    const result = executeTransaction(players, teams, settings, [
      {
        teamId: "1",
        release: ["3139477"],
        acquire: ["2330"],
        targetSlots: { "2330": "STARTER_QB" },
      },
      {
        teamId: "2",
        release: ["2330"],
        acquire: ["3139477"],
        targetSlots: { "3139477": "STARTER_QB" },
      },
    ]);

    // Allen now on Team 1's STARTER_QB
    assert.ok(
      result.teams["1"].rosterSlots["STARTER_QB"]?.includes("2330"),
      "Josh Allen must be in Team 1 STARTER_QB after swap",
    );
    // Mahomes now on Team 2's STARTER_QB
    assert.ok(
      result.teams["2"].rosterSlots["STARTER_QB"]?.includes("3139477"),
      "Mahomes must be in Team 2 STARTER_QB after swap",
    );
    // Neither player is on their original team any more
    assert.ok(
      !Object.values(result.teams["1"].rosterSlots).flat().includes("3139477"),
      "Mahomes must be removed from Team 1",
    );
    assert.ok(
      !Object.values(result.teams["2"].rosterSlots).flat().includes("2330"),
      "Josh Allen must be removed from Team 2",
    );
  });

  it("illegal-position move throws — QB placed in FLEX slot", () => {
    const { settings, players, teams } = adaptEspnLeague(FIXTURE);

    // Attempt to move Mahomes (QB) from Team 1 into Team 2's FLEX slot.
    // slotEligibility.FLEX = ['RB','WR','TE'], so QB is ineligible.
    assert.throws(
      () =>
        executeTransaction(players, teams, settings, [
          {
            teamId: "2",
            release: ["3054245"],    // release Kelce from Team 2
            acquire: ["3139477"],    // acquire Mahomes from Team 1 (not released — will fail ownership check first)
            targetSlots: { "3139477": "FLEX" },
          },
          {
            teamId: "1",
            release: ["3139477"],
            acquire: ["3054245"],
            targetSlots: { "3054245": "FLEX" },
          },
        ]),
      /ineligible/i,
      "Placing a QB in FLEX must throw an ineligible-position error",
    );
  });

  it("adapted state is unchanged after a thrown transaction", () => {
    const { settings, players, teams } = adaptEspnLeague(FIXTURE);
    const originalT1Slots = JSON.stringify(teams["1"].rosterSlots);

    try {
      executeTransaction(players, teams, settings, [
        {
          teamId: "2",
          release: ["3054245"],
          acquire: ["3139477"],
          targetSlots: { "3139477": "FLEX" },
        },
        {
          teamId: "1",
          release: ["3139477"],
          acquire: ["3054245"],
          targetSlots: { "3054245": "FLEX" },
        },
      ]);
    } catch {
      // expected
    }

    assert.strictEqual(
      JSON.stringify(teams["1"].rosterSlots),
      originalT1Slots,
      "Original teams map must be unmodified after a thrown transaction",
    );
  });
});
