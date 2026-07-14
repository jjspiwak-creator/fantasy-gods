---
name: Orval mutation body shape
description: How orval wraps mutation arguments in generated React Query hooks
---

When orval generates a `useMutation` hook for a POST/PUT/DELETE endpoint, the mutation variable object always wraps the request body under a `data:` key — it is NOT spread flat.

**Rule:** `mutation.mutate({ data: bodyObject })` not `mutation.mutate(bodyObject)`

Path parameters are separate named keys alongside `data`:
```typescript
addMutation.mutate({ leagueId, teamId, data: { name, position, ... } })
```

**Why:** orval normalises all generated hooks this way regardless of endpoint shape. Spreading the body flat compiles because TypeScript says the fields don't exist in `{ data: Body }`, producing a TS2353 error ("Object literal may only specify known properties").

**How to apply:** Any time a new API endpoint is added and a generated hook is called for the first time, wrap the body in `data:`. Check the generated signature (grep `UseMutationOptions` for the hook) to confirm path-param names.
