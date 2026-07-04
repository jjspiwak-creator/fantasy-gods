import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  registerUser,
  loginUser,
  updateUserSettings,
} from "@workspace/api-client-react";
import { useToast } from "./use-toast";

export interface UserProfile {
  id: string;
  email: string;
  showLeagueWarnings: boolean;
  createdAt: string;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  /** For guests: local override of the league warnings preference */
  guestShowWarnings: boolean;
  setAuth: (token: string, user: UserProfile) => void;
  clearAuth: () => void;
  setShowLeagueWarnings: (show: boolean) => void;
  setGuestShowWarnings: (show: boolean) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      guestShowWarnings: true,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
      setShowLeagueWarnings: (show) =>
        set((s) => ({
          user: s.user ? { ...s.user, showLeagueWarnings: show } : null,
        })),
      setGuestShowWarnings: (show) => set({ guestShowWarnings: show }),
    }),
    { name: "tradesim-auth" }
  )
);

/** Whether league warnings should be shown for the current user (logged in or guest). */
export function useShowLeagueWarnings(): boolean {
  return useAuth((s) =>
    s.user ? s.user.showLeagueWarnings : s.guestShowWarnings
  );
}

export function useRegisterMutation() {
  const { toast } = useToast();
  const setAuth = useAuth((s) => s.setAuth);

  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      registerUser(data),
    onSuccess: (data) => {
      setAuth(data.token, data.user as UserProfile);
      toast({ title: "Account created!", description: "Welcome to TradeSim." });
    },
    onError: (err: any) => {
      toast({
        title: "Registration failed",
        description: err?.response?.data?.error ?? "Please try again.",
        variant: "destructive",
      });
    },
  });
}

export function useLoginMutation() {
  const { toast } = useToast();
  const setAuth = useAuth((s) => s.setAuth);

  return useMutation({
    mutationFn: (data: { email: string; password: string }) => loginUser(data),
    onSuccess: (data) => {
      setAuth(data.token, data.user as UserProfile);
      toast({
        title: "Signed in",
        description: `Welcome back, ${data.user.email}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Sign in failed",
        description: err?.response?.data?.error ?? "Invalid email or password.",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateWarningsMutation() {
  const { toast } = useToast();
  const token = useAuth((s) => s.token);
  const setShowLeagueWarnings = useAuth((s) => s.setShowLeagueWarnings);
  const setGuestShowWarnings = useAuth((s) => s.setGuestShowWarnings);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (show: boolean) => {
      if (token) {
        return updateUserSettings(
          { showLeagueWarnings: show },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      // Guest — resolve immediately with a dummy value
      return Promise.resolve({ showLeagueWarnings: show } as any);
    },
    onSuccess: (_data, show) => {
      if (token) {
        setShowLeagueWarnings(show);
      } else {
        setGuestShowWarnings(show);
      }
      if (!show) {
        toast({
          title: "Banner hidden",
          description: "Turn it back on in Settings anytime.",
        });
      }
    },
  });
}
