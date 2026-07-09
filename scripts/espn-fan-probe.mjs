// scripts/espn-fan-probe.mjs
// DIAGNOSTIC ONLY — reads ESPN Fan API to discover league IDs for a user.
// Credentials come from env vars ESPN_S2 and SWID. Nothing is modified.

const rawS2 = process.env.ESPN_S2 ?? "";
const rawSwid = process.env.SWID ?? "";

function redact(text) {
  let out = String(text);
  if (rawS2) out = out.split(rawS2).join("[REDACTED]");
  if (rawSwid) {
    out = out.split(rawSwid).join("[REDACTED]");
    const swidNoBraces = rawSwid.replace(/[{}]/g, "");
    if (swidNoBraces) out = out.split(swidNoBraces).join("[REDACTED]");
  }
  return out;
}

function log(msg) {
  console.log(redact(msg));
}

async function main() {
  if (!rawS2 || !rawSwid) {
    console.log("MISSING ENV: ESPN_S2 or SWID");
    process.exit(1);
  }

  const season = Number(process.env.PROBE_SEASON) || new Date().getFullYear();

  const espnS2 = rawS2.replace(/\s+/g, "");
  const swid = rawSwid.replace(/\s+/g, "");
  const swidNoBraces = swid.replace(/[{}]/g, "");

  const cookie = `espn_s2=${espnS2}; SWID=${swid}`;
  const baseHeaders = {
    Cookie: cookie,
    Accept: "application/json",
  };

  // ── STEP A — Fan API attempts ──────────────────────────────────────────────

  const swidEncoded = encodeURIComponent(swid);
  const swidNoBracesEncoded = encodeURIComponent(swidNoBraces);
  const queryParams =
    "?displayEvents=true&displayNow=true&displayRecs=true&recLimit=5" +
    "&context=fantasy&source=espncom-fantasy&lang=en&section=espn&region=us";

  const fanAttempts = [
    {
      num: 1,
      url: `https://fan.api.espn.com/apis/v2/fans/${swidEncoded}`,
    },
    {
      num: 2,
      url: `https://fan.api.espn.com/apis/v2/fans/${swidNoBracesEncoded}`,
    },
    {
      num: 3,
      url: `https://fan.api.espn.com/apis/v2/fans/${swidEncoded}${queryParams}`,
    },
  ];

  let successResp = null;
  for (const attempt of fanAttempts) {
    const displayUrl = attempt.url
      .replace(swidEncoded, "[REDACTED]")
      .replace(swidNoBracesEncoded, "[REDACTED]");
    log(`Attempt ${attempt.num}: ${displayUrl}`);
    const resp = await fetch(attempt.url, { headers: baseHeaders });
    log(`Attempt ${attempt.num} status: ${resp.status}`);
    if (resp.status === 200) {
      successResp = resp;
      break;
    }
  }

  if (!successResp) {
    log("ALL FAN API ATTEMPTS FAILED");
    return;
  }

  // ── Parse JSON from the successful response ───────────────────────────────

  const bodyText = await successResp.text();
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch (e) {
    log(`JSON PARSE ERROR: ${e.message}`);
    process.exit(1);
  }

  log(`TOP-LEVEL KEYS: ${Object.keys(data).join(", ")}`);

  const preferences = data.preferences;
  if (!Array.isArray(preferences)) {
    log("NO PREFERENCES FIELD FOUND");
    return;
  }

  log(`PREFERENCES COUNT: ${preferences.length}`);

  if (preferences.length === 0) {
    log("PREFERENCES EMPTY");
    return;
  }

  // ── Football filter ───────────────────────────────────────────────────────

  const footballPrefs = preferences.filter((p) =>
    JSON.stringify(p).includes("FFL")
  );

  log(`FOOTBALL PREFERENCES COUNT: ${footballPrefs.length}`);

  const prefsToShow =
    footballPrefs.length > 0 ? footballPrefs.slice(0, 2) : null;

  if (prefsToShow) {
    for (let i = 0; i < prefsToShow.length; i++) {
      let pretty = redact(JSON.stringify(prefsToShow[i], null, 2));
      if (pretty.length > 6000) {
        pretty = pretty.slice(0, 6000);
        log(`Football preference ${i + 1}:\n${pretty}\nTRUNCATED`);
      } else {
        log(`Football preference ${i + 1}:\n${pretty}`);
      }
    }
  } else {
    log(
      "NO OBVIOUS FOOTBALL MARKER — printing first 2 preferences raw"
    );
    const firstTwo = preferences.slice(0, 2);
    for (let i = 0; i < firstTwo.length; i++) {
      let pretty = redact(JSON.stringify(firstTwo[i], null, 2));
      if (pretty.length > 6000) {
        pretty = pretty.slice(0, 6000);
        log(`Preference ${i + 1}:\n${pretty}\nTRUNCATED`);
      } else {
        log(`Preference ${i + 1}:\n${pretty}`);
      }
    }
  }

  // ── STEP B — Cross-check ──────────────────────────────────────────────────

  const firstFootball =
    footballPrefs.length > 0 ? footballPrefs[0] : preferences[0];

  let groupId = null;

  try {
    groupId = firstFootball?.metaData?.entry?.groups?.[0]?.groupId ?? null;
  } catch (_) {}

  if (groupId == null) {
    const searchObj = (obj) => {
      if (typeof obj !== "object" || obj === null) return null;
      for (const [k, v] of Object.entries(obj)) {
        if (k === "groupId") return v;
        const found = searchObj(v);
        if (found !== null) return found;
      }
      return null;
    };
    groupId = searchObj(firstFootball);
  }

  if (groupId == null) {
    log("NO groupId FIELD FOUND — SKIPPING CROSS-CHECK");
    return;
  }

  log(`groupId found: ${groupId}`);

  const seasonId =
    firstFootball?.metaData?.entry?.seasonId ?? null;
  if (seasonId !== null) {
    log(`metaData.entry.seasonId: ${seasonId}`);
  }

  const crossUrl =
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}` +
    `/segments/0/leagues/${groupId}?view=mSettings&view=mStatus`;

  log(`CROSS-CHECK URL: ${crossUrl}`);
  const crossResp = await fetch(crossUrl, { headers: baseHeaders });
  log(`CROSS-CHECK STATUS: ${crossResp.status}`);

  if (crossResp.status === 200) {
    const crossText = await crossResp.text();
    let crossData;
    try {
      crossData = JSON.parse(crossText);
    } catch (e) {
      log(`CROSS-CHECK JSON PARSE ERROR: ${e.message}`);
      return;
    }
    log(
      `settings.name: ${redact(String(crossData?.settings?.name ?? "N/A"))}`
    );
    log(
      `settings.size: ${redact(String(crossData?.settings?.size ?? "N/A"))}`
    );
    log(
      `status.currentMatchupPeriod: ${redact(
        String(crossData?.status?.currentMatchupPeriod ?? "N/A")
      )}`
    );
  }
}

try {
  await main();
  process.exit(0);
} catch (err) {
  const raw = err?.stack ?? err?.message ?? String(err);
  let safe = raw;
  if (rawS2) safe = safe.split(rawS2).join("[REDACTED]");
  if (rawSwid) {
    safe = safe.split(rawSwid).join("[REDACTED]");
    const nb = rawSwid.replace(/[{}]/g, "");
    if (nb) safe = safe.split(nb).join("[REDACTED]");
  }
  console.log(`SCRIPT ERROR: ${safe}`);
  process.exit(1);
}
