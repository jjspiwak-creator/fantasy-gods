---
name: Projection sync pipeline
description: How Thursday projection sync works — ESPN public API, DB table, admin route, and simulator integration
---

## ESPN Public API endpoint
`GET https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leaguedefaults/{scoringType}?view=kona_player_info`
- No auth cookies required — public endpoint
- Requires `X-Fantasy-Filter` header with player filter JSON (slot IDs, status, limit)
- scoringType: 0=Standard, 1=Half-PPR, 3=PPR (default)
- stat keys: statSourceId 1=projected, statSplitTypeId 0=full-season, 1=ROS, 5=weekly

## DB table: player_projections
- PK: player_id (text, ESPN player ID as string)
- Columns: player_name, position, pro_team, ros_projection (real), weekly_projection (real), auction_value (real nullable), last_synced_at
- Upserted in batches of 100 on conflict do update

## Admin sync route
- POST /admin/sync/projections — requires X-Admin-Key header matching ADMIN_API_KEY env var
- GET /admin/sync/status — returns isSyncing + lastSyncAt
- 503 if ADMIN_API_KEY not set, 401 if key mismatch, 409 if already syncing

## Simulator integration (espn.ts)
- fetchLeagueTeams() collects all player IDs from raw roster entries BEFORE mapping
- Single bulk DB SELECT with inArray() gets synced ROS projections
- projectionMap (Map<playerId, rosProjection>) passed into parseRoster()
- In parseRoster: if syncedRos > 0, use Math.round(syncedRos) as tradeValue (valueSynced=true)
- Otherwise falls back to keeperValue or estimateTradeValue() heuristic
- Graceful degradation: DB errors are warned and heuristic takes over

**Why:** Synced values significantly improve trade grade accuracy. The fallback ensures no breakage when the table is empty (first deploy) or DB is unavailable.
