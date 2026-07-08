# Fantasy Gods

## Overview

Fantasy Gods is a league-agnostic fantasy football war room. It is built for any team count and any roster configuration — not tied to ESPN or any single platform. ESPN import is one optional data source, not the product.

**Module 1: Multi-Team Trade Simulator** — simulate trades between any number of teams simultaneously, a feature no native platform offers.

The single source of truth engine lives in `artifacts/trade-sim/src` (types, utils, context). `artifacts/api-server/src/lib/tradeSimulator.ts` is legacy and will be unified into the engine in a later work order. `artifacts/trade-sim-mobile` is parked — do not build there unless explicitly ordered.

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
│   ├── api-server/         # Express API server (legacy trade simulator — do not extend)
│   ├── trade-sim/          # React + Vite frontend — PRIMARY engine home
│   └── trade-sim-mobile/   # Expo mobile app — PARKED, do not build unless ordered
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Engine Source of Truth (`artifacts/trade-sim/src`)

| Path | Role |
|------|------|
| `src/types/league.ts` | All canonical type definitions |
| `src/utils/transactionHandler.ts` | Atomic transactions, move execution, drop routing |
| `src/utils/valuationEngine.ts` | ROS valuation, undo stack, most-recent flags |
| `src/utils/draftUtils.ts` | Draft matrix and schedule generation |
| `src/context/LeagueStateContext.tsx` | React context + reducer wrapping the engine |
| `src/__tests__/leagueEngine.test.ts` | Engine unit tests (node:test) |

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
- `POST /api/trades/simulate` — Simulate a multi-team trade (no DB write, pure calculation)
- `GET /api/trades/saved` — List saved trades for a session
- `POST /api/trades/saved` — Save a trade scenario
- `DELETE /api/trades/saved/:tradeId` — Delete a saved trade

## Database Schema

- `saved_trades` — Persists trade simulation results with sessionId, leagueId, name, and JSONB result

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`.

- `pnpm run typecheck` — full typecheck
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API types after spec changes
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm --filter @workspace/trade-sim run test` — run engine unit tests

## Key Documents

- [Roadmap](docs/ROADMAP.md) — vision, naming, monetization, build order, security, and verification protocol

## User preferences

- Minimal narration in responses; no summary reports unless explicitly requested.
