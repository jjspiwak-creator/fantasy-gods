# Fantasy Gods — Roadmap

## 1. Vision

Fantasy Gods is a league-agnostic fantasy football war room. The goal is to give managers the kind of analytical power that professional front offices have — regardless of which platform they play on.

**Module 1** is the multi-team trade simulator: simulate trades between any number of teams simultaneously, inspect the grade for every side, and save scenarios for later.

ESPN import is one optional data source, not the product. Manual league entry is a first-class path — a manager who plays on Sleeper, Yahoo, or a fully custom league should be able to use every feature without touching ESPN.

---

## 2. Naming (Open Decision)

**Working title: Fantasy Gods.**

Concern on the table: religious users may read "Fantasy Gods" as blasphemous. This has not been tested. Decision is to keep the name through beta, then test with a real user sample before any public launch. If the name changes, it changes everywhere at once — no partial rename.

**Also on the table:** the UI still shows legacy names in several places ("TradeSim," "League Intelligence," "ESPN Fantasy Trade Simulator"). A single rename pass will happen immediately before launch, once the name decision is settled.

---

## 3. Monetization (Open — Logged, Not Decided)

Three models are on the table. No implementation work starts until the product is further along.

**(a) Free with ads** — lowest friction for user acquisition; revenue depends on volume.

**(b) Ads + paid ad-free tier** — standard two-tier. Ad-free buyers pay to remove friction; free users fund the baseline.

**(c) "Pay to play god" tiered model** — free/beta tier gets core trade simulator; paid tiers unlock the full god-mode feature set (advanced scoring layers, live ticker, multi-league war room, etc.). This model aligns price with power-user value and keeps the top of the funnel open.

No decision. Revisit when Module 2 scope is clearer and a user base exists to survey.

---

## 4. Platform

One web codebase now. Native storefront comes later via a thin native wrapper around the web app.

**Hard requirement at the native milestone:** in-app ESPN login that captures credentials inside the app shell. The current web flow requires users to copy cookies out of a browser — this is fragile (breaks on iOS due to `javascript:` URL stripping) and will not pass app store review. The native shell can open a webview, intercept the cookie header, and handle this cleanly. The web version cannot.

`artifacts/trade-sim-mobile` stays parked. Do not build there unless explicitly ordered.

---

## 5. Build Order

Each slice below is a discrete work order block. Later slices depend on earlier ones.

1. **Real league-settings data** — extend api-server as a thin data proxy only (its legacy trade logic stays untouched). Fetch actual scoring rules, roster caps, and waiver settings from ESPN and feed them into `buildEngineState`. Hydration then uses the real rulebook instead of synthesised defaults.

2. **Trade flow through the engine** — retire the flat `tradeValue` number. Route the simulate endpoint through the engine's `executeTransaction` so that every trade respects real slot eligibility, roster caps, and scoring rules. The api-server's `tradeSimulator.ts` becomes a thin adapter.

3. **Scoring / standings layer** — weekly scoreboards, guillotine elimination tracking, best-ball auto-lineup. This unlocks league-mode features beyond the trade simulator.

4. **Live NFL scores ticker** — real-time score updates during game days, wired into the standings layer.

---

## 6. Pre-Launch Security Checklist

Items that must be resolved before any public launch:

- **Auth / password storage audit** — verify hashing, session handling, and token expiry meet current standards.
- **ESPN cookie handling** — cookies are sensitive credentials. Audit how they are stored, transmitted, and expired on the server. Ensure they are never logged.
- **Connect-flow overhaul** — the current instructions for extracting ESPN cookies break on iOS (`javascript:` URLs are stripped by Safari and most iOS browsers). The UX also relies on a copy-box pattern that is confusing to non-technical users. This flow needs a redesign before the product is put in front of a general audience.

---

## 7. Verification Protocol

- **Small work orders only.** Each work order touches a narrow, well-defined slice.
- **Suite stays green.** Every merge must leave all tests passing. No exceptions.
- **Delivery verified via commit-pinned GitHub reads.** Each completed work order is confirmed by reading the relevant files at the specific commit SHA, not from local state.
- **Owner confirms commit count after every push.** After each `git push`, the owner reads back the resulting commit SHA and confirms it matches the remote. This closes the loop on any silent push failures.
