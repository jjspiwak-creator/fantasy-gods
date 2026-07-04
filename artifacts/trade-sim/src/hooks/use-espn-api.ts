import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  connectEspn, 
  getLeagues, 
  getLeagueTeams,
  simulateTrade,
  getSavedTrades,
  saveTrade,
  deleteSavedTrade,
  refreshSavedTrade,
  type EspnConnectBody,
  type SimulateTradeBody,
  type SaveTradeBody
} from "@workspace/api-client-react";
import { useSession } from "./use-session";
import { useToast } from "./use-toast";
import { useAuth } from "./use-auth";

function authHeaders(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

// Wrappers around the generated hooks to handle session injection and standard error handling

export function useConnect() {
  const setSession = useSession(s => s.setSession);
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: EspnConnectBody) => connectEspn(data),
    onSuccess: (data) => {
      if (data.connected && data.sessionId) {
        setSession(data.sessionId, data.username);
        toast({
          title: "Connected Successfully",
          description: `Welcome back, ${data.username || 'Manager'}.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error?.message || "Invalid ESPN credentials.",
        variant: "destructive",
      });
    }
  });
}

export function useUserLeagues() {
  const sessionId = useSession(s => s.sessionId);
  return useQuery({
    queryKey: ['leagues', sessionId],
    queryFn: () => getLeagues({ sessionId: sessionId! }),
    enabled: !!sessionId,
  });
}

export function useLeagueTeams(leagueId: string) {
  const sessionId = useSession(s => s.sessionId);
  return useQuery({
    queryKey: ['leagueTeams', leagueId, sessionId],
    queryFn: () => getLeagueTeams(leagueId, { sessionId: sessionId! }),
    enabled: !!sessionId && !!leagueId,
  });
}

export function useSimulateTradeMutation() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: SimulateTradeBody) => simulateTrade(data),
    onError: (error: any) => {
      toast({
        title: "Simulation Failed",
        description: error?.message || "Could not process this trade.",
        variant: "destructive",
      });
    }
  });
}

export function useSavedTradesList() {
  const sessionId = useSession(s => s.sessionId);
  const token = useAuth(s => s.token);
  return useQuery({
    queryKey: ['savedTrades', sessionId, token],
    queryFn: () => getSavedTrades({ sessionId: sessionId! }, { headers: authHeaders(token) }),
    enabled: !!sessionId,
  });
}

export function useSaveTradeMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionId = useSession(s => s.sessionId);
  const token = useAuth(s => s.token);

  return useMutation({
    mutationFn: (data: SaveTradeBody) => saveTrade(data, { headers: authHeaders(token) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedTrades', sessionId] });
      toast({
        title: "Trade Saved",
        description: "Your simulation has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Could not save trade.",
        variant: "destructive",
      });
    }
  });
}

export function useRefreshTradeMutation() {
  const queryClient = useQueryClient();
  const sessionId = useSession(s => s.sessionId);
  const { toast } = useToast();

  return useMutation({
    mutationFn: (tradeId: number) =>
      refreshSavedTrade(tradeId, { sessionId: sessionId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedTrades', sessionId] });
      toast({
        title: "Scores Updated",
        description: "Trade grades recalculated with current player values.",
      });
    },
    onError: () => {
      toast({
        title: "Refresh Failed",
        description: "Could not fetch current player data from ESPN.",
        variant: "destructive",
      });
    }
  });
}

export function useDeleteTradeMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionId = useSession(s => s.sessionId);

  return useMutation({
    mutationFn: (tradeId: number) => deleteSavedTrade(tradeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedTrades', sessionId] });
      toast({
        title: "Trade Deleted",
        description: "The saved trade was removed.",
      });
    }
  });
}
