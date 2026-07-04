import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SessionState {
  sessionId: string | null;
  setSession: (sessionId: string) => void;
  clearSession: () => void;
  isLoaded: boolean;
}

const SessionContext = createContext<SessionState>({
  sessionId: null,
  setSession: () => {},
  clearSession: () => {},
  isLoaded: false,
});

const SESSION_KEY = "tradesim_session_id";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY).then((val) => {
      if (val) setSessionId(val);
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

  return (
    <SessionContext.Provider value={{ sessionId, setSession, clearSession, isLoaded }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
