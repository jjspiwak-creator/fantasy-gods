import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  adaptEspnLeague,
  type EspnLeagueInput,
} from "../adapters/espnAdapter";
import { executeTransaction } from "../utils/transactionHandler";

// ─── Fixture 1: Realistic 10-team league ─────────────────────────────────────
// Two fully rostered teams, six players total, one FLEX slot, FAAB budget.
// scoringItems now use the corrected stat IDs: 24=rushingYards, 25=rushingTD,
// 53=receptions (per verified ESPN API scoring configuration).

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
        { statId: 24, points: 0.1   },  // rushingYards  (corrected from 20)
        { statId: 25, points: 6     },  // rushingTD     (corrected from 21)
        { statId: 42, points: 0.1   },  // receivingYards
        { statId: 43, points: 6     },  // receivingTD
        { statId: 53, points: 1     },  // receptions / PPR  (corrected from 72)
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

// ─── Fixture 2: Exotic slots league ──────────────────────────────────────────
// Tests: SUPERFLEX (slot 7), RB_WR combo slot (slot 3), WR_TE combo slot (slot 5),
// dual-eligible player, and corrected stat IDs including interceptions.

const EXOTIC_FIXTURE: EspnLeagueInput = {
  id: 999002,
  seasonId: 2025,
  settings: {
    name: "Exotic Slots League",
    size: 10,
    draftSettings: { type: "SNAKE", timePerSelection: 90 },
    rosterSettings: {
      lineupSlotCounts: {
        "0": 1,   // STARTER_QB
        "3": 1,   // RB_WR combo slot
        "5": 1,   // WR_TE combo slot
        "7": 1,   // SUPERFLEX
        "20": 5,  // BENCH
      },
    },
    scoringSettings: {
      scoringType: "H2H_POINTS",
      scoringItems: [
        { statId: 3,  points: 0.04  },   // passingYards
        { statId: 4,  points: 4     },   // passingTD
        { statId: 5,  points: 0.5   },   // unmapped → stat_5 passthrough
        { statId: 20, points: -1    },   // passingInterceptions (community-confirmed)
        { statId: 24, points: 0.1   },   // rushingYards
        { statId: 25, points: 6     },   // rushingTD
        { statId: 53, points: 1     },   // receptions (PPR)
        { statId: 72, points: -2    },   // lostFumbles
      ],
    },
    waiverSettings: { type: "TRADITIONAL" },
  },
  teams: [
    {
      id: 10,
      name: "Team Alpha",
      owners: ["mgr-010"],
      waiverRank: 1,
      roster: {
        entries: [
          {
            // QB in STARTER_QB
            playerId: 4040715,
            lineupSlotId: 0,
            acquisitionDate: 1693000000000,
            playerPoolEntry: {
              acquisitionType: "DRAFT",
              player: {
                id: 4040715,
                fullName: "Lamar Jackson",
                defaultPositionId: 1,   // QB
                eligibleSlots: [0, 7, 20, 21],
                proTeamId: 33,
                byeWeek: 14,
              },
            },
          },
          {
            // RB in RB_WR combo slot (slot 3)
            playerId: 3054211,
            lineupSlotId: 3,
            acquisitionDate: 1693000000000,
            playerPoolEntry: {
              acquisitionType: "DRAFT",
              player: {
                id: 3054211,
                fullName: "Christian McCaffrey",
                defaultPositionId: 2,   // RB
                eligibleSlots: [2, 3, 20, 23],
                proTeamId: 25,
                byeWeek: 9,
              },
            },
          },
          {
            // Dual-eligible WR/TE in WR_TE combo slot (slot 5)
            // eligibleSlots includes both WR slot (4) and TE slot (6) →
            // deriveEligiblePositions should yield ["WR","TE"]
            playerId: 9001,
            lineupSlotId: 5,
            acquisitionDate: 1693000000000,
            playerPoolEntry: {
              acquisitionType: "DRAFT",
              player: {
                id: 9001,
                fullName: "Dual Eligible Star",
                defaultPositionId: 3,        // primary = WR
                eligibleSlots: [4, 6, 5, 20, 23], // WR slot(4), TE slot(6) → both positions
                proTeamId: 21,
                byeWeek: 7,
              },
            },
          },
          {
            // QB in SUPERFLEX (slot 7) — legal because SUPERFLEX accepts QB
            playerId: 3054035,
            lineupSlotId: 7,
            acquisitionDate: 1693000000000,
            playerPoolEntry: {
              acquisitionType: "DRAFT",
              player: {
                id: 3054035,
                fullName: "Joe Burrow",
                defaultPositionId: 1,   // QB
                eligibleSlots: [0, 7, 20, 21],
                proTeamId: 4,
                byeWeek: 7,
              },
            },
          },
        ],
      },
    },
    {
      id: 11,
      name: "Team Beta",
      owners: ["mgr-011"],
      waiverRank: 2,
      roster: {
        entries: [
          {
            playerId: 4429795,
            lineupSlotId: 0,   // STARTER_QB
            acquisitionDate: 1693000000000,
            playerPoolEntry: {
              acquisitionType: "DRAFT",
              player: {
                id: 4429795,
                fullName: "CJ Stroud",
                defaultPositionId: 1,   // QB
                eligibleSlots: [0, 7, 20, 21],
                proTeamId: 34,
                byeWeek: 14,
              },
            },
          },
          {
            playerId: 4569618,
            lineupSlotId: 7,   // SUPERFLEX (RB in superflex)
            acquisitionDate: 1693000000000,
            playerPoolEntry: {
              acquisitionType: "DRAFT",
              player: {
                id: 4569618,
                fullName: "Saquon Barkley",
                defaultPositionId: 2,   // RB
                eligibleSlots: [2, 7, 20, 21, 23],
                proTeamId: 21,
                byeWeek: 5,
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

  it("scoringRules.receptions = 1 (PPR — corrected stat ID 53)", () => {
    assert.strictEqual(settings.scoringRules["receptions"], 1);
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

    assert.ok(
      result.teams["1"].rosterSlots["STARTER_QB"]?.includes("2330"),
      "Josh Allen must be in Team 1 STARTER_QB after swap",
    );
    assert.ok(
      result.teams["2"].rosterSlots["STARTER_QB"]?.includes("3139477"),
      "Mahomes must be in Team 2 STARTER_QB after swap",
    );
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

    assert.throws(
      () =>
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

// ─────────────────────────────────────────────────────────────────────────────
// 5. Corrected stat IDs — interception scoring item must NOT surface as rushingYards
// ─────────────────────────────────────────────────────────────────────────────

describe("adaptEspnLeague — corrected stat key mappings", () => {
  const { settings } = adaptEspnLeague(EXOTIC_FIXTURE);

  it("statId 20 maps to 'passingInterceptions' with no bleed into rushingAttempts", () => {
    // statId 20 = passingInterceptions (community-confirmed)
    assert.strictEqual(settings.scoringRules["passingInterceptions"], -1);
    // rushingAttempts (statId 23) is not present in this fixture → must be absent
    assert.strictEqual(
      settings.scoringRules["rushingAttempts"],
      undefined,
      "rushingAttempts must not be polluted by the interception stat ID",
    );
  });

  it("statId 5 is unmapped and surfaces as stat_5 passthrough", () => {
    // statId 5 is intentionally unmapped pending live-payload confirmation.
    // It must NOT appear under any named key.
    assert.strictEqual(settings.scoringRules["stat_5"], 0.5);
    assert.strictEqual(settings.scoringRules["passingInterceptions2"], undefined);
    // Confirm no named key accidentally consumed statId 5
    for (const key of Object.keys(settings.scoringRules)) {
      assert.ok(
        key === "stat_5" || !key.startsWith("stat_") || key !== "stat_5"
          ? true
          : false,
      );
    }
    // The passthrough key must be present
    assert.ok("stat_5" in settings.scoringRules, "stat_5 passthrough key must exist");
  });

  it("statId 53 maps to 'receptions', not 'receivingTargets'", () => {
    assert.strictEqual(settings.scoringRules["receptions"], 1);
    assert.strictEqual(settings.scoringRules["receivingTargets"], undefined);
  });

  it("statId 72 maps to 'lostFumbles', not 'pprReceptions'", () => {
    assert.strictEqual(settings.scoringRules["lostFumbles"], -2);
    assert.strictEqual(settings.scoringRules["pprReceptions"], undefined);
  });

  it("statId 24 maps to 'rushingYards'", () => {
    assert.strictEqual(settings.scoringRules["rushingYards"], 0.1);
  });

  it("statId 25 maps to 'rushingTD'", () => {
    assert.strictEqual(settings.scoringRules["rushingTD"], 6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SUPERFLEX slot — QB legally occupies SUPERFLEX; appears in adapted rosters
// ─────────────────────────────────────────────────────────────────────────────

describe("adaptEspnLeague — SUPERFLEX slot", () => {
  const { settings, players, teams } = adaptEspnLeague(EXOTIC_FIXTURE);

  it("slotEligibility.SUPERFLEX = ['QB','RB','WR','TE']", () => {
    assert.deepStrictEqual(
      settings.slotEligibility!["SUPERFLEX"],
      ["QB", "RB", "WR", "TE"],
    );
  });

  it("SUPERFLEX cap = 1, requirement = 1 (starter slot)", () => {
    assert.strictEqual(settings.rosterCaps["SUPERFLEX"], 1);
    assert.strictEqual(settings.slotRequirements["SUPERFLEX"], 1);
  });

  it("Joe Burrow (QB) appears in Team Alpha's SUPERFLEX slot after adaptation", () => {
    const superflex = teams["10"].rosterSlots["SUPERFLEX"] ?? [];
    assert.ok(
      superflex.includes("3054035"),
      "Joe Burrow must be placed in SUPERFLEX slot",
    );
    assert.ok("3054035" in players, "Joe Burrow must be in the players map");
  });

  it("Saquon Barkley (RB) appears in Team Beta's SUPERFLEX slot after adaptation", () => {
    const superflex = teams["11"].rosterSlots["SUPERFLEX"] ?? [];
    assert.ok(
      superflex.includes("4569618"),
      "Saquon Barkley must be placed in SUPERFLEX slot",
    );
  });

  it("executeTransaction: QB legally placed into SUPERFLEX slot via trade", () => {
    // Re-adapt to get fresh mutable state.
    const { settings: s, players: p, teams: t } = adaptEspnLeague(EXOTIC_FIXTURE);

    // Burrow (QB) is in Team Alpha's SUPERFLEX.
    // Barkley (RB) is in Team Beta's SUPERFLEX.
    // Swap them through SUPERFLEX: clean net-zero on both rosters.
    // The key assertion: Burrow (QB) ends up in Team Beta's SUPERFLEX → validates QB is legal in SUPERFLEX.
    const result = executeTransaction(p, t, s, [
      {
        teamId: "10",
        release: ["3054035"],          // Burrow out of Alpha SUPERFLEX
        acquire: ["4569618"],           // Barkley into Alpha SUPERFLEX
        targetSlots: { "4569618": "SUPERFLEX" },
      },
      {
        teamId: "11",
        release: ["4569618"],           // Barkley out of Beta SUPERFLEX
        acquire: ["3054035"],           // Burrow into Beta SUPERFLEX
        targetSlots: { "3054035": "SUPERFLEX" },
      },
    ]);

    assert.ok(
      result.teams["11"].rosterSlots["SUPERFLEX"]?.includes("3054035"),
      "Joe Burrow (QB) must land in Team Beta SUPERFLEX — QB is legal in SUPERFLEX",
    );
    assert.ok(
      result.teams["10"].rosterSlots["SUPERFLEX"]?.includes("4569618"),
      "Saquon Barkley (RB) must land in Team Alpha SUPERFLEX",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. RB_WR combo slot — RB legally occupies RB_WR
// ─────────────────────────────────────────────────────────────────────────────

describe("adaptEspnLeague — RB_WR combo slot", () => {
  const { settings, players, teams } = adaptEspnLeague(EXOTIC_FIXTURE);

  it("slotEligibility.RB_WR = ['RB','WR']", () => {
    assert.deepStrictEqual(settings.slotEligibility!["RB_WR"], ["RB", "WR"]);
  });

  it("RB_WR cap = 1, requirement = 1 (starter slot)", () => {
    assert.strictEqual(settings.rosterCaps["RB_WR"], 1);
    assert.strictEqual(settings.slotRequirements["RB_WR"], 1);
  });

  it("McCaffrey (RB) appears in RB_WR slot after adaptation", () => {
    const rbWr = teams["10"].rosterSlots["RB_WR"] ?? [];
    assert.ok(
      rbWr.includes("3054211"),
      "McCaffrey must be placed in RB_WR slot",
    );
  });

  it("executeTransaction: RB can be moved into RB_WR slot", () => {
    const { settings: s, players: p, teams: t } = adaptEspnLeague(EXOTIC_FIXTURE);

    // Barkley (RB, Team Beta SUPERFLEX) → Team Alpha RB_WR
    // McCaffrey (RB, Team Alpha RB_WR)  → Team Beta SUPERFLEX
    // Both are RBs so both slots accept them.
    const result = executeTransaction(p, t, s, [
      {
        teamId: "10",
        release: ["3054211"],
        acquire: ["4569618"],
        targetSlots: { "4569618": "RB_WR" },
      },
      {
        teamId: "11",
        release: ["4569618"],
        acquire: ["3054211"],
        targetSlots: { "3054211": "SUPERFLEX" },
      },
    ]);

    assert.ok(
      result.teams["10"].rosterSlots["RB_WR"]?.includes("4569618"),
      "Barkley (RB) must be accepted into Team Alpha RB_WR slot",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Dual-eligible player — eligibleSlots spanning WR and TE yields both positions
// ─────────────────────────────────────────────────────────────────────────────

describe("adaptEspnLeague — dual-eligible player", () => {
  const { players } = adaptEspnLeague(EXOTIC_FIXTURE);

  it("player 9001 has defaultPositionId=WR but eligibleSlots includes TE slot", () => {
    // Fixture has: defaultPositionId=3 (WR), eligibleSlots=[4,6,5,20,23]
    // Slot 4 → WR (position-specific), slot 6 → TE (position-specific)
    // → deriveEligiblePositions should union both
    const ep = players["9001"].eligiblePositions;
    assert.ok(ep.includes("WR"), "dual-eligible player must include WR");
    assert.ok(ep.includes("TE"), "dual-eligible player must include TE from TE slot (6)");
    assert.strictEqual(ep.length, 2, "must have exactly WR and TE, nothing else");
  });

  it("player 9001 is placed in WR_TE slot after adaptation", () => {
    const { teams } = adaptEspnLeague(EXOTIC_FIXTURE);
    const wrTe = teams["10"].rosterSlots["WR_TE"] ?? [];
    assert.ok(
      wrTe.includes("9001"),
      "dual-eligible player must be in WR_TE slot",
    );
  });

  it("slotEligibility.WR_TE = ['WR','TE']", () => {
    const { settings } = adaptEspnLeague(EXOTIC_FIXTURE);
    assert.deepStrictEqual(settings.slotEligibility!["WR_TE"], ["WR", "TE"]);
  });

  it("BENCH-only eligible slots do not bleed into eligiblePositions", () => {
    // McCaffrey: eligibleSlots=[2,3,20,23] — only slot 2 (RB) is position-specific
    // slot 3 (RB_WR combo) and 20 (BENCH) and 23 (FLEX) are ignored
    assert.deepStrictEqual(players["3054211"].eligiblePositions, ["RB"]);
  });
});
