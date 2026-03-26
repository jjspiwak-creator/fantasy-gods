# Workspace

## Overview

ESPN Fantasy Football Multi-Team Trade Simulator. A full-stack web app that connects to ESPN Fantasy Football accounts and enables simulating trades between 3+ teams simultaneously — a feature no other platform offers.

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
│   ├── api-server/         # Express API server
│   └── trade-sim/          # React + Vite frontend (ESPN Trade Simulator)
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

## Features

1. **ESPN Account Connection** — Users enter ESPN S2 cookie and SWID to authenticate. Stored as server-side sessions.
2. **League Browser** — View all fantasy football leagues for the connected account.
3. **Team Roster View** — See all teams in a league with full rosters, player stats, and trade values.
4. **Multi-Team Trade Simulator** — The core feature: build trades between 2+ teams (including 3-way, 4-way, etc.), something ESPN doesn't support.
5. **Trade Analysis** — Side-by-side before/after roster comparisons, trade value scoring, win/loss/neutral verdicts per team.
6. **Save Trades** — Save and revisit trade simulations (stored in PostgreSQL).

## API Routes

- `POST /api/espn/connect` — Authenticate with ESPN credentials
- `GET /api/espn/leagues` — Get user's leagues
- `GET /api/espn/leagues/:leagueId/teams` — Get teams + rosters in a league
- `POST /api/trades/simulate` — Simulate a multi-team trade (no DB write, pure calculation)
- `GET /api/trades/saved` — List saved trades for a session
- `POST /api/trades/saved` — Save a trade scenario
- `DELETE /api/trades/saved/:tradeId` — Delete a saved trade

## Database Schema

- `saved_trades` — Persists trade simulation results with sessionId, leagueId, name, and JSONB result

## Key Files

- `artifacts/api-server/src/lib/espn.ts` — ESPN API integration (fetches leagues, teams, rosters)
- `artifacts/api-server/src/lib/tradeSimulator.ts` — Core trade simulation logic
- `artifacts/api-server/src/lib/sessions.ts` — In-memory session management for ESPN credentials
- `artifacts/trade-sim/src/pages/trade-builder.tsx` — Main trade builder UI
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`.

- `pnpm run typecheck` — full typecheck
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API types after spec changes
- `pnpm --filter @workspace/db run push` — push DB schema changes
