import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Components & Pages
import { Layout } from "@/components/layout";
import { ConnectPage } from "@/pages/connect";
import { LeaguesPage } from "@/pages/leagues";
import { LeagueDetailsPage } from "@/pages/league-details";
import { TradeBuilderPage } from "@/pages/trade-builder";
import { SavedTradesPage } from "@/pages/saved-trades";
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
        <Route path="/" component={ConnectPage} />
        <Route path="/leagues" component={LeaguesPage} />
        <Route path="/leagues/:leagueId" component={LeagueDetailsPage} />
        <Route path="/leagues/:leagueId/trade-builder" component={TradeBuilderPage} />
        <Route path="/saved-trades" component={SavedTradesPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
