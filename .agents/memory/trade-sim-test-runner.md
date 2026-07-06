---
name: trade-sim test runner
description: How to run TypeScript tests in @workspace/trade-sim without vitest (blocked by Replit package firewall).
---

## Rule
`vitest` and `tsx` cannot be installed into `@workspace/trade-sim` via pnpm — the Replit package firewall returns 403 for both. Use Node 24's built-in `node:test` runner with the tsx ESM loader that already exists in the pnpm virtual store.

## Test script (package.json)
```json
"test": "node --import /home/runner/workspace/node_modules/.pnpm/node_modules/tsx/dist/esm/index.mjs --test src/__tests__/leagueEngine.test.ts"
```

**Why:** tsx ESM loader is pre-installed as a transitive dependency of vite and drizzle-kit. It lives at a stable path in the pnpm content-addressable store. Node 24's `node:test` module is the stable built-in test runner.

## Test file conventions
- Use `import { describe, it, before } from "node:test"` and `import assert from "node:assert/strict"`.
- All imports must use **relative paths** with explicit `.ts` extensions (e.g. `../utils/draftUtils.ts`), not `@/` path aliases — tsx resolves aliases via tsconfig, but only relative paths are guaranteed safe.
- Never import `.tsx` (JSX) files from the test entry point — extract pure utility functions into `.ts` files first.

## How to apply
Any time a new `.test.ts` file is added under `src/__tests__/`, either append it to the `--test` argument list or glob it (`src/__tests__/*.test.ts`). Do not attempt to reinstall vitest.
