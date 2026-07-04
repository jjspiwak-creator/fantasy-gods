import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSession } from "@/context/SessionContext";
import { getLeagues, type League } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";

export default function TradeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessionId } = useSession();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const { data: leagues, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["leagues", sessionId],
    queryFn: () => getLeagues({ sessionId: sessionId! }),
    enabled: !!sessionId,
  });

  const styles = makeStyles(colors);

  if (!sessionId) {
    return (
      <View style={[styles.container, { paddingTop: topPad + 20, paddingBottom: bottomPad }]}>
        <View style={styles.heroSection}>
          <View style={styles.logoBadge}>
            <Feather name="repeat" size={32} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>TradeSim</Text>
          <Text style={styles.heroSubtitle}>Multi-Team Fantasy Trade Analyzer</Text>
          <Text style={styles.heroDesc}>
            The only tool that simulates 3+ team trades simultaneously. See who wins before you deal.
          </Text>
          <TouchableOpacity
            style={styles.connectBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/connect");
            }}
            activeOpacity={0.8}
          >
            <Feather name="zap" size={18} color={colors.primaryForeground} />
            <Text style={styles.connectBtnText}>Connect ESPN Account</Text>
          </TouchableOpacity>
          <View style={styles.featureRow}>
            {[
              { icon: "users", label: "3+ Team Trades" },
              { icon: "bar-chart-2", label: "Live Grades" },
              { icon: "refresh-cw", label: "Real-Time Scores" },
            ].map((f) => (
              <View key={f.label} style={styles.featureItem}>
                <Feather name={f.icon as any} size={16} color={colors.primary} />
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Your Leagues</Text>
          <Text style={styles.headerSub}>Tap a league to build a trade</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your leagues...</Text>
        </View>
      ) : !leagues || leagues.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="inbox" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No leagues found</Text>
          <Text style={styles.emptyDesc}>Make sure you're connected to an active ESPN fantasy season.</Text>
        </View>
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }: { item: League }) => (
            <TouchableOpacity
              style={styles.leagueCard}
              activeOpacity={0.75}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/league/${item.id}/trade`);
              }}
            >
              <View style={styles.leagueIconWrap}>
                <Feather name="shield" size={22} color={colors.primary} />
              </View>
              <View style={styles.leagueInfo}>
                <Text style={styles.leagueName}>{item.name}</Text>
                <Text style={styles.leagueMeta}>
                  {item.season} · Week {item.currentWeek} · {item.teamCount} teams
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    headerTitle: { fontSize: 28, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    headerSub: { fontSize: 13, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular" },
    list: { paddingHorizontal: 16, paddingTop: 8 },
    leagueCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 10,
    },
    leagueIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary + "20",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },
    leagueInfo: { flex: 1 },
    leagueName: { fontSize: 16, fontWeight: "600", color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    leagueMeta: { fontSize: 13, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular" },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
    loadingText: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
    emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    emptyDesc: { fontSize: 14, color: colors.mutedForeground, textAlign: "center", fontFamily: "Inter_400Regular" },
    heroSection: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
    logoBadge: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + "20",
      borderWidth: 2,
      borderColor: colors.primary + "60",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    heroTitle: {
      fontSize: 40,
      fontWeight: "700",
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      letterSpacing: 1,
    },
    heroSubtitle: {
      fontSize: 15,
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
      textAlign: "center",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    heroDesc: {
      fontSize: 15,
      color: colors.mutedForeground,
      textAlign: "center",
      fontFamily: "Inter_400Regular",
      lineHeight: 22,
    },
    connectBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 28,
      paddingVertical: 16,
      borderRadius: colors.radius,
      marginTop: 8,
    },
    connectBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primaryForeground,
      fontFamily: "Inter_700Bold",
    },
    featureRow: {
      flexDirection: "row",
      gap: 20,
      marginTop: 8,
    },
    featureItem: { alignItems: "center", gap: 6 },
    featureLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
  });
}
