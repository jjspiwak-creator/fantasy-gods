import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeValue, normalizeDelta } from "../utils.js";

describe("normalizeValue", () => {
  it("zero-max guard returns 0", () => {
    assert.equal(normalizeValue(500, 0), 0);
  });

  it("maps max to 100", () => {
    assert.equal(normalizeValue(100, 100), 100);
  });

  it("maps zero value to 0", () => {
    assert.equal(normalizeValue(0, 100), 0);
  });

  it("rounds correctly", () => {
    assert.equal(normalizeValue(1, 3), 33);
    assert.equal(normalizeValue(2, 3), 67);
  });

  it("clamps floor at 0 (negative value)", () => {
    assert.equal(normalizeValue(-50, 100), 0);
  });

  it("clamps ceiling at 100 (value exceeds max)", () => {
    assert.equal(normalizeValue(200, 100), 100);
  });

  it("mid-range value", () => {
    assert.equal(normalizeValue(50, 100), 50);
  });
});

describe("normalizeDelta", () => {
  it("zero-max guard returns 0", () => {
    assert.equal(normalizeDelta(500, 0), 0);
  });

  it("positive delta maps correctly", () => {
    assert.equal(normalizeDelta(50, 100), 50);
  });

  it("negative delta preserves sign", () => {
    assert.equal(normalizeDelta(-50, 100), -50);
  });

  it("zero delta returns 0", () => {
    assert.equal(normalizeDelta(0, 100), 0);
  });

  it("clamps ceiling at +100", () => {
    assert.equal(normalizeDelta(300, 100), 100);
  });

  it("clamps floor at -100", () => {
    assert.equal(normalizeDelta(-300, 100), -100);
  });

  it("rounds correctly for positive delta", () => {
    assert.equal(normalizeDelta(1, 3), 33);
  });

  it("rounds correctly for negative delta", () => {
    assert.equal(normalizeDelta(-1, 3), -33);
  });
});
