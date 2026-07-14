import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LeagueStateProvider } from "@/context/LeagueStateContext";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

// Wire the JWT into all generated API hooks (manual league routes require Bearer auth)
setAuthTokenGetter(() => useAuth.getState().token);

// Components & Pages
import { Layout } from "@/components/layout";
import { AuthPage } from "@/pages/auth";
import { ConnectPage } from "@/pages/connect";
import { LeaguesPage } from "@/pages/leagues";
import { LeagueDetailsPage } from "@/pages/league-details";
import { TradeBuilderPage, ManualTradeBuilderPage } from "@/pages/trade-builder";
import { SavedTradesPage } from "@/pages/saved-trades";
import { SettingsPage } from "@/pages/settings";
import { ManualLeaguePage } from "@/pages/manual-league";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function Router() {
  return (
    <Layout>
      <Switch>
        {/* Auth welcome / sign-in / register / continue as guest */}
        <Route path="/" component={AuthPage} />
        {/* ESPN credential entry (post-auth or guest track) */}
        <Route path="/connect" component={ConnectPage} />
        <Route path="/leagues" component={LeaguesPage} />
        <Route path="/leagues/:leagueId" component={LeagueDetailsPage} />
        <Route path="/leagues/:leagueId/trade-builder" component={TradeBuilderPage} />
        {/* Manual league routes */}
        <Route path="/manual-leagues/:leagueId" component={ManualLeaguePage} />
        <Route path="/manual-leagues/:leagueId/trade-builder" component={ManualTradeBuilderPage} />
        <Route path="/saved-trades" component={SavedTradesPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LeagueStateProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </LeagueStateProvider>
    </QueryClientProvider>
  );
}

export default App;
