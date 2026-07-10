import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fetchLeagueSettings } from "../espn.ts";

const CREDS = { espnS2: "fake-s2-value-for-tests-only", swid: "{fake-swid}" };

function makeSettingsFixture(overrides: any = {}) {
  return {
    settings: {
      name: "League of Game Changers",
      size: 4,
      draftSettings: {
        type: "SNAKE",
        timePerSelection: 15,
        auctionBudget: 200,
        pickOrder: [3, 1, 2, 4],
      },
      rosterSettings: {
        lineupSlotCounts: { "0": 1, "2": 2, "4": 2, "6": 1, "16": 1, "17": 1, "20": 7, "21": 1, "23": 1 },
      },
      scoringSettings: {
        scoringType: "H2H_POINTS",
        scoringItems: [
          { statId: 20, points: -2, pointsOverrides: {}, isReverseItem: false },
          { statId: 72, points: -2, pointsOverrides: {}, isReverseItem: false },
          { statId: 85, points: -1, pointsOverrides: {}, isReverseItem: false },
        ],
      },
      acquisitionSettings: {
        acquisitionType: "WAIVERS_TRADITIONAL",
        acquisitionBudget: 100,
        isUsingAcquisitionBudget: false,
        minimumBid: 1,
        waiverHours: 24,
        waiverProcessDays: ["MONDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
        waiverProcessHour: 11,
        waiverOrderReset: true,
      },
      tradeSettings: {
        deadlineDate: 1234567890000,
        max: 10,
        revisionHours: 12,
        vetoVotesRequired: 4,
        allowOutOfUniverse: false,
      },
      ...overrides,
    },
  };
}

describe("fetchLeagueSettings", () => {
  afterEach(() => {
    mock.reset();
  });

  it("maps a happy-path ESPN response into the confirmed field subset", async () => {
    const fixture = makeSettingsFixture();
    mock.method(global, "fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => fixture,
    }));

    const result = await fetchLeagueSettings(CREDS, "1002940162", 2026);

    assert.equal(result.name, "League of Game Changers");
    assert.equal(result.size, 4);
    assert.deepEqual(result.draftSettings, {
      type: "SNAKE",
      timePerSelection: 15,
      auctionBudget: 200,
      pickOrder: [3, 1, 2, 4],
    });
    assert.deepEqual(result.rosterSettings.lineupSlotCounts, fixture.settings.rosterSettings.lineupSlotCounts);
    assert.equal(result.scoringSettings.scoringType, "H2H_POINTS");
    assert.equal(result.scoringSettings.scoringItems.length, 3);
    assert.equal(result.acquisitionSettings.acquisitionType, "WAIVERS_TRADITIONAL");
    assert.equal(result.tradeSettings.vetoVotesRequired, 4);
  });

  it("throws a descriptive error when ESPN returns a non-200 status", async () => {
    mock.method(global, "fetch", async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    }));

    await assert.rejects(
      () => fetchLeagueSettings(CREDS, "1002940162", 2026),
      /ESPN API returned 401 for league 1002940162 settings/
    );
  });

  it("throws a descriptive error when required fields are missing (no silent fallback)", async () => {
    const fixture = makeSettingsFixture();
    delete fixture.settings.scoringSettings.scoringType;

    mock.method(global, "fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => fixture,
    }));

    await assert.rejects(
      () => fetchLeagueSettings(CREDS, "1002940162", 2026),
      /missing required fields.*scoringSettings\.scoringType/
    );
  });

  it("throws when the settings object itself is absent from the response", async () => {
    mock.method(global, "fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));

    await assert.rejects(
      () => fetchLeagueSettings(CREDS, "1002940162", 2026),
      /missing the settings object/
    );
  });
});
