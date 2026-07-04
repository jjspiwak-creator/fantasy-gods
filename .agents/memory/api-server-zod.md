---
name: API server Zod usage constraints
description: How to use Zod correctly in the api-server package when writing route validation
---

When writing route validation in `artifacts/api-server/src/routes/`, these rules apply:

1. Import from `"zod"` directly — NOT `"zod/v4"`. esbuild cannot resolve the `zod/v4` subpath export.
2. Use `z.string().email()` — NOT `z.email()`. The project uses Zod v3; `z.email()` is Zod v4 API only.
3. `zod` must be declared in `artifacts/api-server/package.json` as a direct dependency. It is not hoisted from `@workspace/api-zod`, so esbuild won't find it without an explicit dep entry.

**Why:** api-server builds with esbuild bundle=true and resolves packages relative to its own package.json. The `lib/api-zod` generated code uses `zod/v4` import paths — this only works because those files are bundled through a different pipeline.

**How to apply:** Any new route file that needs inline Zod validation should start with `import { z } from "zod"` and use v3-compatible APIs only.
