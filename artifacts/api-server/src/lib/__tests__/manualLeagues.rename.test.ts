import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canRenameTeam, validateRenameBody } from "../../routes/manualLeagues.ts";

describe("canRenameTeam — scenario 1: owner renames own team", () => {
  it("returns true when caller is the team owner", () => {
    assert.strictEqual(canRenameTeam("u1", "u1", "u2"), true);
  });
});

describe("canRenameTeam — scenario 2: commissioner renames another member's team", () => {
  it("returns true when caller is league creator and team is owned by someone else", () => {
    assert.strictEqual(canRenameTeam("u2", "u1", "u2"), true);
  });
});

describe("canRenameTeam — scenario 3: commissioner renames an unclaimed team", () => {
  it("returns true when caller is league creator and team ownerUserId is null", () => {
    assert.strictEqual(canRenameTeam("u2", null, "u2"), true);
  });
});

describe("canRenameTeam — scenario 4: neither owner nor commissioner", () => {
  it("returns false when caller owns a different team and is not the league creator", () => {
    assert.strictEqual(canRenameTeam("u3", "u1", "u2"), false);
  });
});

describe("validateRenameBody — scenario 5: whitespace-only name", () => {
  it("rejects a name that is only spaces", () => {
    const result = validateRenameBody({ name: "   " });
    assert.strictEqual(result.ok, false);
  });

  it("rejects a name that is only a tab", () => {
    const result = validateRenameBody({ name: "\t" });
    assert.strictEqual(result.ok, false);
  });
});

describe("validateRenameBody — scenario 6: 61-character name", () => {
  it("rejects a name of 61 characters", () => {
    const result = validateRenameBody({ name: "a".repeat(61) });
    assert.strictEqual(result.ok, false);
  });

  it("accepts a name of exactly 60 characters", () => {
    const result = validateRenameBody({ name: "a".repeat(60) });
    assert.strictEqual(result.ok, true);
    if (result.ok) assert.strictEqual(result.name.length, 60);
  });

  it("accepts a valid trimmed name", () => {
    const result = validateRenameBody({ name: "  Fantasy Gods  " });
    assert.strictEqual(result.ok, true);
    if (result.ok) assert.strictEqual(result.name, "Fantasy Gods");
  });
});
