import { Router, type IRouter } from "express";
import {
  ConnectEspnBody,
  ConnectEspnResponse,
  GetLeaguesQueryParams,
  GetLeaguesResponse,
  GetLeagueTeamsParams,
  GetLeagueTeamsQueryParams,
  GetLeagueTeamsResponse,
  GetLeagueSettingsParams,
  GetLeagueSettingsQueryParams,
  GetLeagueSettingsResponse,
} from "@workspace/api-zod";
import { fetchUserLeagues, fetchLeagueTeams, fetchLeagueSettings, verifyCredentials } from "../lib/espn";
import { createSession, getSession } from "../lib/sessions";

const router: IRouter = Router();

router.post("/espn/connect", async (req, res): Promise<void> => {
  const parsed = ConnectEspnBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { espnS2, swid } = parsed.data;

  if (!verifyCredentials({ espnS2, swid })) {
    res.status(400).json({ error: "Invalid ESPN credentials format. Please check your espn_s2 and SWID values." });
    return;
  }

  try {
    const sessionId = await createSession({ espnS2, swid });

    const result = ConnectEspnResponse.parse({
      sessionId,
      connected: true,
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "ESPN connect error");
    res.status(500).json({ error: "Failed to create session. Please try again." });
  }
});

router.get("/espn/leagues", async (req, res): Promise<void> => {
  const params = GetLeaguesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const creds = await getSession(params.data.sessionId);
  if (!creds) {
    res.status(401).json({ error: "Session not found or expired. Please reconnect your ESPN account." });
    return;
  }

  try {
    const season = new Date().getFullYear();
    const leagues = await fetchUserLeagues(creds, season);

    if (leagues.length === 0) {
      const prevSeason = season - 1;
      const prevLeagues = await fetchUserLeagues(creds, prevSeason);
      res.json(GetLeaguesResponse.parse(prevLeagues));
      return;
    }

    res.json(GetLeaguesResponse.parse(leagues));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch leagues");
    res.status(500).json({ error: "Failed to fetch leagues from ESPN. Please check your credentials." });
  }
});

router.get("/espn/leagues/:leagueId/teams", async (req, res): Promise<void> => {
  const pathParams = GetLeagueTeamsParams.safeParse(req.params);
  if (!pathParams.success) {
    res.status(400).json({ error: "Invalid league ID" });
    return;
  }

  const queryParams = GetLeagueTeamsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const creds = await getSession(queryParams.data.sessionId);
  if (!creds) {
    res.status(401).json({ error: "Session not found or expired. Please reconnect your ESPN account." });
    return;
  }

  try {
    const season = queryParams.data.season ? parseInt(queryParams.data.season, 10) : new Date().getFullYear();
    const teams = await fetchLeagueTeams(creds, pathParams.data.leagueId, season);
    res.json(GetLeagueTeamsResponse.parse(teams));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch league teams");
    res.status(500).json({ error: "Failed to fetch teams from ESPN. Please check your credentials and league ID." });
  }
});

router.get("/espn/leagues/:leagueId/settings", async (req, res): Promise<void> => {
  const pathParams = GetLeagueSettingsParams.safeParse(req.params);
  if (!pathParams.success) {
    res.status(400).json({ error: "Invalid league ID" });
    return;
  }

  const queryParams = GetLeagueSettingsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const creds = await getSession(queryParams.data.sessionId);
  if (!creds) {
    res.status(401).json({ error: "Session not found or expired. Please reconnect your ESPN account." });
    return;
  }

  try {
    const season = queryParams.data.season ? parseInt(queryParams.data.season, 10) : new Date().getFullYear();
    const settings = await fetchLeagueSettings(creds, pathParams.data.leagueId, season);
    res.json(GetLeagueSettingsResponse.parse(settings));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch league settings");
    res.status(502).json({ error: "Failed to fetch league settings from ESPN. Please check your credentials and league ID." });
  }
});

export default router;
