import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionState {
  sessionId: string | null;
  username: string | null;
  setSession: (sessionId: string, username?: string) => void;
  clearSession: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      sessionId: null,
      username: null,
      setSession: (sessionId, username) => set({ sessionId, username: username || null }),
      clearSession: () => set({ sessionId: null, username: null }),
    }),
    {
      name: 'espn-trade-session',
    }
  )
);
