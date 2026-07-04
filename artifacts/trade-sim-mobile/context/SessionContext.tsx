import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Auth / User types ──────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  showLeagueWarnings: boolean;
  createdAt: string;
}

// ─── Keys ────────────────────────────────────────────────────────────────────
const SESSION_KEY = "tradesim_session_id";
const AUTH_TOKEN_KEY = "tradesim_auth_token";
const AUTH_USER_KEY = "tradesim_auth_user";
const GUEST_WARNINGS_KEY = "tradesim_guest_warnings";

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
  // Loaded flag
  isLoaded: boolean;
}

const SessionContext = createContext<SessionState>({
  sessionId: null,
  setSession: () => {},
  clearSession: () => {},
  authToken: null,
  user: null,
  setAuth: () => {},
  clearAuth: () => {},
  showLeagueWarnings: true,
  setShowLeagueWarnings: () => {},
  isLoaded: false,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showLeagueWarnings, _setShowLeagueWarnings] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SESSION_KEY),
      AsyncStorage.getItem(AUTH_TOKEN_KEY),
      AsyncStorage.getItem(AUTH_USER_KEY),
      AsyncStorage.getItem(GUEST_WARNINGS_KEY),
    ]).then(([sid, token, userStr, guestWarnings]) => {
      if (sid) setSessionId(sid);
      if (token) setAuthToken(token);
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr) as UserProfile;
          setUser(parsed);
          _setShowLeagueWarnings(parsed.showLeagueWarnings);
        } catch {}
      } else if (guestWarnings !== null) {
        _setShowLeagueWarnings(guestWarnings !== "false");
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
