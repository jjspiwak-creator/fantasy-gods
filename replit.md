# Fantasy Gods

## Overview

Fantasy Gods is a league-agnostic fantasy football war room. It is built for any team count and any roster configuration — not tied to ESPN or any single platform. ESPN import is one optional data source, not the product.

**Module 1: Multi-Team Trade Simulator** — simulate trades between any number of teams simultaneously, a feature no native platform offers.

The single source of truth engine lives in `lib/engine/src` (types, utils, context). `artifacts/api-server/src/lib/tradeSimulator.ts` now runs an engine gate (slotResolver → executeTransaction) before the legacy value calculation; `TradeRejectedError` signals HTTP 400, all other throws become HTTP 500. `artifacts/trade-sim-mobile` is parked — do not build there unless explicitly ordered. It is also excluded from the aggregate typecheck gate until unparked.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui + Zustand + Framer Motion

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (engine-gated simulate; legacy value calc pending retirement)
│   ├── trade-sim/          # React + Vite frontend
│   └── trade-sim-mobile/   # Expo mobile app — PARKED, do not build unless ordered
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── engine/             # PRIMARY engine home — types, utils, ESPN adapter
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Engine Source of Truth (`lib/engine/src`)

| Path | Role |
|------|------|
| `lib/engine/src/types/league.ts` | All canonical type definitions |
| `lib/engine/src/utils/transactionHandler.ts` | Atomic transactions, move execution, drop routing |
| `lib/engine/src/utils/valuationEngine.ts` | ROS valuation, undo stack, most-recent flags |
| `lib/engine/src/utils/draftUtils.ts` | Draft matrix and schedule generation |
| `lib/engine/src/adapters/espnAdapter.ts` | ESPN → engine type adapter |
| `lib/engine/src/utils/engineHydration.ts` | API response → engine state hydration |
| `lib/engine/src/__tests__/` | Engine unit tests (node:test) |

Note: `artifacts/trade-sim/src/context/LeagueStateContext.tsx` remains the React context + reducer wrapping the engine (not moved — it uses React).

## Key Architectural Rules

1. **League-agnostic**: every setting that varies by league lives in `LeagueSettings`.
2. **No ESPN coupling in the engine**: ESPN import is a data-loading concern at the boundary, not a core type.
3. **Immutable engine**: `executeTransaction` and `executeMoveTransaction` never mutate inputs — they deep-clone and throw on violation.
4. **Timezone-aware**: calendar-day comparisons use `Intl.DateTimeFormat` in `leagueTimezone` (default `America/New_York`), never machine-local time.
5. **Slot eligibility**: if `LeagueSettings.slotEligibility` is provided, position legality is enforced on every move.

## API Routes (api-server)

- `POST /api/espn/connect` — Authenticate with ESPN credentials
- `GET /api/espn/leagues` — Get user's leagues
- `GET /api/espn/leagues/:leagueId/teams` — Get teams + rosters in a league
- `GET /api/espn/leagues/:leagueId/settings` — league rulebook (scoring, roster, waivers, draft)
- `POST /api/trades/simulate` — Simulate a multi-team trade; accepts optional `settings` (LeagueSettings) to enforce real roster caps and slot eligibility; engine gate rejects illegal trades with HTTP 400
- `GET /api/trades/saved` — List saved trades for a session
- `POST /api/trades/saved` — Save a trade scenario
- `DELETE /api/trades/saved/:tradeId` — Delete a saved trade

## Database Schema

- `users` — Registered accounts with email, hashed password, and preferences (showLeagueWarnings, vibePreference)
- `sessions` — ESPN session tokens mapped to sessionId + username for ESPN API calls
- `manual_leagues` — User-created league-agnostic war rooms: name, inviteCode, creatorUserId, teamCount, rosterSlots (jsonb), scoringBasics (jsonb)
- `manual_teams` — Teams within a manual league: leagueId FK, ownerUserId FK (nullable = unowned slot), name
- `manual_roster_players` — Players on a manual team: teamId FK, name, position (uppercase-normalised), realTeam, byeWeek, isStarter
- `saved_trades` — Persists trade simulation results with sessionId, leagueId, name, and JSONB result

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`.

- `pnpm run typecheck` — full typecheck
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API types after spec changes
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm --filter @workspace/engine run test` — run engine unit tests

## Key Documents

- [Roadmap](docs/ROADMAP.md) — vision, naming, monetization, build order, security, and verification protocol

## User preferences

- Minimal narration in responses; no summary reports unless explicitly requested.
