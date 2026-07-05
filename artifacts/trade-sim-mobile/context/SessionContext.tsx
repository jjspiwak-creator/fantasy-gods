import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeKey } from "@/constants/colors";

// ─── Auth / User types ──────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  showLeagueWarnings: boolean;
  vibePreference: "corporate" | "the_boys" | "coach_speak" | "vegas_degenerate";
  createdAt: string;
}

// ─── Keys ────────────────────────────────────────────────────────────────────
const SESSION_KEY = "tradesim_session_id";
const AUTH_TOKEN_KEY = "tradesim_auth_token";
const AUTH_USER_KEY = "tradesim_auth_user";
const GUEST_WARNINGS_KEY = "tradesim_guest_warnings";
const GUEST_VIBE_KEY = "tradesim_guest_vibe";
const GUEST_THEME_KEY = "tradesim_guest_theme";

// ─── Context shape ───────────────────────────────────────────────────────────
interface SessionState {
  // ESPN session
  sessionId: string | null;
  setSession: (sessionId: string) => void;
  clearSession: () => void;
  // Account auth
  authToken: string | null;
  user: UserProfile | null;
  setAuth: (token: string, user: UserProfile) => void;
  clearAuth: () => void;
  // League warning preference (per-user or guest local)
  showLeagueWarnings: boolean;
  setShowLeagueWarnings: (show: boolean) => void;
  // Vibe preference (per-user or guest local)
  vibePreference: "corporate" | "the_boys" | "coach_speak" | "vegas_degenerate";
  setVibePreference: (vibe: "corporate" | "the_boys" | "coach_speak" | "vegas_degenerate") => void;
  // Visual theme (always guest-local — not synced to server)
  themePreference: ThemeKey;
  setThemePreference: (theme: ThemeKey) => void;
  // Loaded flag
  isLoaded: boolean;
}

export const SessionContext = createContext<SessionState>({
  sessionId: null,
  setSession: () => {},
  clearSession: () => {},
  authToken: null,
  user: null,
  setAuth: () => {},
  clearAuth: () => {},
  showLeagueWarnings: true,
  setShowLeagueWarnings: () => {},
  vibePreference: "corporate",
  setVibePreference: () => {},
  themePreference: "dark",
  setThemePreference: () => {},
  isLoaded: false,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showLeagueWarnings, _setShowLeagueWarnings] = useState(true);
  const [vibePreference, _setVibePreference] = useState<"corporate" | "the_boys" | "coach_speak" | "vegas_degenerate">("corporate");
  const [themePreference, _setThemePreference] = useState<ThemeKey>("dark");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SESSION_KEY),
      AsyncStorage.getItem(AUTH_TOKEN_KEY),
      AsyncStorage.getItem(AUTH_USER_KEY),
      AsyncStorage.getItem(GUEST_WARNINGS_KEY),
      AsyncStorage.getItem(GUEST_VIBE_KEY),
      AsyncStorage.getItem(GUEST_THEME_KEY),
    ]).then(([sid, token, userStr, guestWarnings, guestVibe, guestTheme]) => {
      if (sid) setSessionId(sid);
      if (token) setAuthToken(token);
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr) as UserProfile;
          setUser(parsed);
          _setShowLeagueWarnings(parsed.showLeagueWarnings);
          _setVibePreference(parsed.vibePreference ?? "corporate");
        } catch {}
      } else {
        if (guestWarnings !== null) {
          _setShowLeagueWarnings(guestWarnings !== "false");
        }
        const validVibes = ["corporate", "the_boys", "coach_speak", "vegas_degenerate"];
        if (guestVibe && validVibes.includes(guestVibe)) {
          _setVibePreference(guestVibe as "corporate" | "the_boys" | "coach_speak" | "vegas_degenerate");
        }
      }
      // Theme is always guest-local regardless of auth state
      const validThemes: ThemeKey[] = ["dark", "light", "field"];
      if (guestTheme && validThemes.includes(guestTheme as ThemeKey)) {
        _setThemePreference(guestTheme as ThemeKey);
      }
      setIsLoaded(true);
    });
  }, []);

  const setSession = (id: string) => {
    setSessionId(id);
    AsyncStorage.setItem(SESSION_KEY, id);
  };

  const clearSession = () => {
    setSessionId(null);
    AsyncStorage.removeItem(SESSION_KEY);
  };

  const setAuth = (token: string, profile: UserProfile) => {
    setAuthToken(token);
    setUser(profile);
    _setShowLeagueWarnings(profile.showLeagueWarnings);
    _setVibePreference(profile.vibePreference ?? "corporate");
    AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(profile));
  };

  const clearAuth = () => {
    setAuthToken(null);
    setUser(null);
    AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    AsyncStorage.removeItem(AUTH_USER_KEY);
  };

  const setShowLeagueWarnings = (show: boolean) => {
    _setShowLeagueWarnings(show);
    if (user) {
      const updated = { ...user, showLeagueWarnings: show };
      setUser(updated);
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
    } else {
      AsyncStorage.setItem(GUEST_WARNINGS_KEY, String(show));
    }
  };

  const setVibePreference = (vibe: "corporate" | "the_boys" | "coach_speak" | "vegas_degenerate") => {
    _setVibePreference(vibe);
    if (user) {
      const updated = { ...user, vibePreference: vibe };
      setUser(updated);
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
    } else {
      AsyncStorage.setItem(GUEST_VIBE_KEY, vibe);
    }
  };

  const setThemePreference = (theme: ThemeKey) => {
    _setThemePreference(theme);
    AsyncStorage.setItem(GUEST_THEME_KEY, theme);
  };

  return (
    <SessionContext.Provider
      value={{
        sessionId,
        setSession,
        clearSession,
        authToken,
        user,
        setAuth,
        clearAuth,
        showLeagueWarnings,
        setShowLeagueWarnings,
        vibePreference,
        setVibePreference,
        themePreference,
        setThemePreference,
        isLoaded,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
