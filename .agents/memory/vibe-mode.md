---
name: Vibe Mode architecture
description: How vibePreference is stored, surfaced, and consumed across web and mobile
---

`vibePreference` is a `text NOT NULL DEFAULT 'corporate'` column on the `users` table. Valid values: `'corporate' | 'the_boys'`.

## Web
- `UserProfile` interface in `use-auth.ts` includes `vibePreference`
- `useVibePreference()` selector exported from `use-auth.ts`
- `useVibeText(corporate, theBoys)` hook in `hooks/use-vibe-text.ts` — returns the correct string based on active vibe
- `useUpdateVibeMutation()` in `use-auth.ts` — calls `PATCH /auth/settings { vibePreference }`, updates local store
- Guest vibe stored in Zustand persisted store as `guestVibePreference`

## Mobile
- `vibePreference` on `UserProfile` type and in `SessionContext`
- `useVibeText(corporate, theBoys)` hook in `hooks/useVibeText.ts` — reads from `useSession().vibePreference`
- `setVibePreference(vibe)` on `SessionContext` — persists to AsyncStorage key `tradesim_guest_vibe` for guests, or updates stored user JSON for accounts
- `vibePreference` destructured from `useSession()` in trade screen for community card conditional

## API
- `PATCH /auth/settings` body is now fully optional (both `showLeagueWarnings` and `vibePreference` are optional)
- Send only the fields you want to change — partial update pattern

**Why:** Both preferences (warnings + vibe) follow the same partial-update pattern so settings calls don't need to carry the full settings object.
