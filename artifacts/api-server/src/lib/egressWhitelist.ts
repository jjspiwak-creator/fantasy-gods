// This list is EXACT-MATCH ONLY (no wildcards, no subdomain matching).
// Any new host requires a deliberate one-line addition here after Legal/Vault clearance.
// Do not add wildcard ESPN domain matching under any circumstance.
export const EGRESS_WHITELIST: readonly string[] = [
  "lm-api-reads.fantasy.espn.com",
  "fan.api.espn.com",
];
