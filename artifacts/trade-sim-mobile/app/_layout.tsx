import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@workspace/api-client-react";
import { ErrorUtils } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionProvider } from "@/context/SessionContext";
import { log } from "@/lib/logger";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync();

// ── React Query client with global error logging ────────────────────────────
// Any query or mutation that throws without a local onError handler will
// bubble up here so it always appears in the Replit logs.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
    mutations: {
      onError(err: unknown) {
        log.error("React Query mutation failed", err instanceof Error ? err : new Error(String(err)));
      },
    },
  },
});

// ── Global JS crash handler ─────────────────────────────────────────────────
// Catches any JS exception that escapes React and would otherwise crash the
// app silently on device. In dev the default red-box still shows; in prod
// this guarantees the crash is recorded in Replit logs.
const previousHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((err: Error, isFatal?: boolean) => {
  log.error(`Global JS ${isFatal ? "FATAL" : "non-fatal"} crash`, err, {
    isFatal: Boolean(isFatal),
  });
  // Delegate to the original handler so dev red-box / default behavior still works
  previousHandler?.(err, isFatal);
});

// ── React render crash handler ──────────────────────────────────────────────
function handleBoundaryError(error: Error, componentStack: string) {
  log.error("React render error (ErrorBoundary caught)", error, {
    componentStack: componentStack.slice(0, 600), // trim for readability
  });
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="connect" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="league/[leagueId]/trade" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      if (fontError) {
        log.warn("Font loading failed — falling back to system font", { err: String(fontError) });
      }
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary onError={handleBoundaryError}>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <SessionProvider>
                <RootLayoutNav />
              </SessionProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
