// NOTE: `generated/api.ts` and `generated/types/*.ts` both declare exports for
// request params/body schemas (the former as runtime zod objects, the latter
// as plain TS type aliases of the same name). Orval's zod-client "split" mode
// always emits both, so re-exporting each barrel wildcard-style causes a
// TS2308 duplicate-export ambiguity for every schema that has an inline body/
// params object. The runtime zod objects from `generated/api` are what all
// consumers actually use (e.g. `Foo.safeParse(...)`), so those five type-only
// duplicates are excluded here in favor of the canonical zod-object exports.
// If orval's output changes and introduces a new duplicate, add its type file
// to this exclusion list rather than re-introducing a blanket `export *`.
export * from "./generated/api";
export * from "./generated/types/authToken";
export * from "./generated/types/errorResponse";
export * from "./generated/types/espnConnectBody";
export * from "./generated/types/espnConnectResponse";
export * from "./generated/types/getLeaguesParams";
export * from "./generated/types/getSavedTradesParams";
export * from "./generated/types/healthStatus";
export * from "./generated/types/league";
export * from "./generated/types/leagueSettings";
export * from "./generated/types/leagueSettingsAcquisitionSettings";
export * from "./generated/types/leagueSettingsDraftSettings";
export * from "./generated/types/leagueSettingsRosterSettings";
export * from "./generated/types/leagueSettingsRosterSettingsLineupSlotCounts";
export * from "./generated/types/leagueSettingsScoringSettings";
export * from "./generated/types/leagueSettingsTradeSettings";
export * from "./generated/types/loginBody";
export * from "./generated/types/player";
export * from "./generated/types/playerTransfer";
export * from "./generated/types/registerBody";
export * from "./generated/types/rosterOverflow";
export * from "./generated/types/savedTrade";
export * from "./generated/types/scoringItem";
export * from "./generated/types/scoringItemPointsOverrides";
export * from "./generated/types/team";
export * from "./generated/types/teamTradeResult";
export * from "./generated/types/tradeSimulationResult";
export * from "./generated/types/updateSettingsBody";
export * from "./generated/types/updateSettingsBodyVibePreference";
export * from "./generated/types/userProfile";
export * from "./generated/types/userProfileVibePreference";
// Excluded (duplicate name with a runtime zod object in "./generated/api"):
//   getLeagueSettingsParams, getLeagueTeamsParams, refreshSavedTradeParams,
//   saveTradeBody, simulateTradeBody
