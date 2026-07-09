import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractFootballLeagueIds } from "../espn.ts";

function makePreference(overrides: any = {}) {
  return {
    typeId: 9,
    metaData: {
      entry: {
        abbrev: "FFL",
        seasonId: 2026,
        groups: [{ groupId: 123456789 }],
        ...overrides.entry,
      },
      ...overrides.metaData,
    },
    ...overrides,
  };
}

describe("extractFootballLeagueIds", () => {
  it("returns the groupId for a single valid FFL preference matching the season", () => {
    const fanData = { preferences: [makePreference()] };
    assert.deepEqual(extractFootballLeagueIds(fanData, 2026), ["123456789"]);
  });

  it("excludes a decoy preference with typeId 9 but abbrev other than FFL", () => {
    const decoy = makePreference({ entry: { abbrev: "FLB" } });
    const fanData = { preferences: [decoy] };
    assert.deepEqual(extractFootballLeagueIds(fanData, 2026), []);
  });

  it("excludes an FFL preference whose seasonId does not match the requested season", () => {
    const wrongSeason = makePreference({ entry: { seasonId: 2025 } });
    const fanData = { preferences: [wrongSeason] };
    assert.deepEqual(extractFootballLeagueIds(fanData, 2026), []);
  });

  it("returns [] when preferences is missing or not an array", () => {
    assert.deepEqual(extractFootballLeagueIds({}, 2026), []);
    assert.deepEqual(extractFootballLeagueIds({ preferences: "not-an-array" }, 2026), []);
    assert.deepEqual(extractFootballLeagueIds(null, 2026), []);
    assert.deepEqual(extractFootballLeagueIds(undefined, 2026), []);
  });

  it("de-duplicates a groupId that appears in two valid preferences", () => {
    const prefA = makePreference({ entry: { groups: [{ groupId: 555555555 }] } });
    const prefB = makePreference({ entry: { groups: [{ groupId: 555555555 }] } });
    const fanData = { preferences: [prefA, prefB] };
    assert.deepEqual(extractFootballLeagueIds(fanData, 2026), ["555555555"]);
  });
});
