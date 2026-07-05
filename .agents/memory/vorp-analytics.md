---
name: VORP analytics engine
description: League power rankings and positional grading via VORP — architecture and key decisions
---

## Entry point
`computeLeagueSummary(leagueId, teams)` in `artifacts/api-server/src/lib/analytics.ts`
Pure function — no I/O, no side effects.

## Replacement baseline strategy
- Pool ALL rostered players per position across all teams
- Sort desc by value (tradeValue for ROS, projectedPoints for weekly)
- replacementIndex = teamCount × STARTER_SLOTS[pos]
- Example: 12 teams × 1 QB = replacement QB at index 12 (13th ranked)
- Fallback: if fewer players exist, use last available player's value

## Optimal lineup (weekly)
- Greedy by projectedPoints: fill QB/RB×2/WR×2/TE/K/D/ST dedicated slots first
- FLEX: best unused player from RB/WR/TE pool
- Greedy is optimal here — position slots are locked, no benefit to withholding

## Positional grade thresholds (deviation from league avg VORP)
- A+: ≥+40%, A: ≥+25%, A-: ≥+15%, B+: ≥+8%, B: ≥+3%, B-: ≥-3%
- C+: ≥-8%, C: ≥-15%, C-: ≥-25%, D+: ≥-35%, D: ≥-45%, D-: ≥-55%, F: below

## API endpoint
GET /api/metrics/league-summary?sessionId=&leagueId=&season=
- Same auth pattern as other ESPN routes (getSession from sessions.ts)
- Re-uses fetchLeagueTeams() which blends synced projections + heuristic
- Returns full LeagueSummary shape including weeklyRankings[], rosRankings[], baselines

## Graded positions
Only QB, RB, WR, TE get letter grades. K and D/ST VORP is computed for ROS total but not graded.

**Why pure function:** Makes the engine trivially testable and reusable. All ESPN/DB I/O stays in the route handler.
