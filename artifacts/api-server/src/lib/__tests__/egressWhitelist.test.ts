import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EGRESS_WHITELIST } from "../egressWhitelist.ts";

const HOST_RE = /\b(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|io|co|dev|app|gov|edu)\b/g;

const THIS_FILE = fileURLToPath(import.meta.url);
// Test file: src/lib/__tests__/egressWhitelist.test.ts
// dirname = src/lib/__tests__ → ../.. → src/
const SRC_ROOT = resolve(dirname(THIS_FILE), "../..");

const EXCLUDE_SEGMENTS = new Set(["node_modules", "dist"]);

function collectAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (full === THIS_FILE) continue;
    if (EXCLUDE_SEGMENTS.has(entry)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectAllTsFiles(full));
    } else if (entry.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

const files = collectAllTsFiles(SRC_ROOT);

describe("egressWhitelist — egress guard", () => {
  it("all hostname-shaped strings in src/ are on the whitelist", () => {
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        HOST_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = HOST_RE.exec(lines[i])) !== null) {
          const host = m[0];
          if (!(EGRESS_WHITELIST as readonly string[]).includes(host)) {
            violations.push(`${file}:${i + 1} — unrecognized host: ${host}`);
          }
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `Egress violations found:\n${violations.join("\n")}`
    );
  });

  it("positive control — lm-api-reads.fantasy.espn.com is detected in lib/espn.ts", () => {
    const espnFile = resolve(SRC_ROOT, "lib/espn.ts");
    const content = readFileSync(espnFile, "utf8");
    const matches: string[] = content.match(HOST_RE) ?? [];
    assert.ok(
      matches.includes("lm-api-reads.fantasy.espn.com"),
      "Expected lm-api-reads.fantasy.espn.com to be detected in lib/espn.ts"
    );
  });

  it("positive control — fan.api.espn.com is detected in lib/espn.ts", () => {
    const espnFile = resolve(SRC_ROOT, "lib/espn.ts");
    const content = readFileSync(espnFile, "utf8");
    const matches: string[] = content.match(HOST_RE) ?? [];
    assert.ok(
      matches.includes("fan.api.espn.com"),
      "Expected fan.api.espn.com to be detected in lib/espn.ts"
    );
  });
});
