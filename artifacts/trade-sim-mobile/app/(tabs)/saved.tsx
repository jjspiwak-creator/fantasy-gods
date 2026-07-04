import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSession } from "@/context/SessionContext";
import {
  useGetSavedTrades,
  useDeleteSavedTrade,
  useRefreshSavedTrade,
  type SavedTrade,
  type TeamTradeResult,
  getGetSavedTradesQueryKey,
} from "@workspace/api-client-react";
import { formatTradeValue, getGradeColor, getGradeBgColor, getGradeBorderColor, timeAgo, isStale } from "@/lib/utils";

export default function SavedTradesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessionId } = useSession();
  const queryClient = useQueryClient();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const { data: trades, isLoading, refetch, isRefetching } = useGetSavedTrades(
    { sessionId: sessionId ?? "" },
    { query: { enabled: !!sessionId } }
  );

  const deleteMutation = useDeleteSavedTrade({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSavedTradesQueryKey() });
      },
    },
  });

  const refreshMutation = useRefreshSavedTrade({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSavedTradesQueryKey() });
      },
    },
  });

  const styles = makeStyles(colors);

  const handleDelete = (trade: SavedTrade) => {
    Alert.alert(
      "Delete Trade",
      `Remove "${trade.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            deleteMutation.mutate({ tradeId: trade.id });
          },
        },
      ]
    );
  };

  if (!sessionId) {
    return (
      <View style={[styles.container, { paddingTop: topPad + 20 }]}>
        <View style={styles.emptyContainer}>
          <Feather name="lock" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>Not connected</Text>
          <Text style={styles.emptyDesc}>Connect your ESPN account to view saved trades.</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/connect")} activeOpacity={0.8}>
            <Text style={styles.actionBtnText}>Connect ESPN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Saved Trades</Text>
          <Text style={styles.headerSub}>Scores update live from ESPN</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading saved trades...</Text>
        </View>
      ) : !trades || trades.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="bookmark" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No saved trades</Text>
          <Text style={styles.emptyDesc}>Build and save a trade simulation to track it here.</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/")} activeOpacity={0.8}>
            <Text style={styles.actionBtnText}>Go to Leagues</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trades}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 100 }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item }: { item: SavedTrade }) => {
            const stale = isStale(item.lastRefreshedAt);
            const isRefreshing = refreshMutation.isPending && refreshMutation.variables?.tradeId === item.id;
            return (
              <TradeCard
                trade={item}
                stale={stale}
                isRefreshing={isRefreshing}
                onRefresh={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  refreshMutation.mutate({ tradeId: item.id, params: { sessionId: sessionId! } });
                }}
                onDelete={() => handleDelete(item)}
                colors={colors}
                styles={styles}
              />
            );
          }}
        />
      )}
    </View>
  );
}

function TradeCard({
  trade,
  stale,
  isRefreshing,
  onRefresh,
  onDelete,
  colors,
  styles,
}: {
  trade: SavedTrade;
  stale: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onDelete: () => void;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.tradeCard}>
      {/* Header */}
      <View style={styles.tradeCardHeader}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.tradeName} numberOfLines={1}>{trade.name}</Text>
          <View style={styles.tradeMeta}>
            <Feather name="calendar" size={11} color={colors.mutedForeground} />
            <Text style={styles.tradeMetaText}>
              {new Date(trade.createdAt).toLocaleDateString()}
            </Text>
            <Feather name="clock" size={11} color={stale ? "#f59e0b" : colors.mutedForeground} style={{ marginLeft: 6 }} />
            <Text style={[styles.tradeMetaText, stale && { color: "#f59e0b" }]}>
              {timeAgo(trade.lastRefreshedAt)}{stale ? " · outdated" : ""}
            </Text>
          </View>
        </View>
        <View style={styles.tradeActions}>
          <TouchableOpacity
            style={[styles.refreshBtn, stale && styles.refreshBtnStale]}
            onPress={onRefresh}
            disabled={isRefreshing}
            activeOpacity={0.7}
          >
            <Feather
              name="refresh-cw"
              size={13}
              color={stale ? "#f59e0b" : colors.mutedForeground}
              style={isRefreshing ? { opacity: 0.5 } : undefined}
            />
            <Text style={[styles.refreshBtnText, stale && { color: "#f59e0b" }]}>
              {isRefreshing ? "..." : "Refresh"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
            <Feather name="trash-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Team results */}
      <View style={styles.teamResultsRow}>
        {trade.result.teamResults.map((tr: TeamTradeResult) => (
          <TeamResultChip key={tr.teamId} result={tr} colors={colors} styles={styles} />
        ))}
      </View>
    </View>
  );
}

function TeamResultChip({
  result,
  colors,
  styles,
}: {
  result: TeamTradeResult;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const gradeColor = getGradeColor(result.grade);
  const gradeBg = getGradeBgColor(result.grade);
  const gradeBorder = getGradeBorderColor(result.grade);

  return (
    <View style={styles.teamChip}>
      <View style={styles.teamChipTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.teamChipName} numberOfLines={1}>{result.teamName}</Text>
          <Text style={styles.teamChipOwner} numberOfLines={1}>{result.ownerName}</Text>
        </View>
        <View style={[styles.gradeBadge, { backgroundColor: gradeBg, borderColor: gradeBorder }]}>
          <Text style={[styles.gradeText, { color: gradeColor }]}>{result.grade}</Text>
          <Text style={[styles.scoreText, { color: gradeColor }]}>{result.score}/100</Text>
        </View>
      </View>

      <Text style={styles.rationaleText} numberOfLines={2}>{result.gradeRationale}</Text>

      <Text style={[
        styles.valueChangeText,
        {
          color: result.tradeValueChange > 0
            ? colors.success
            : result.tradeValueChange < 0
            ? colors.destructive
            : colors.mutedForeground
        }
      ]}>
        {formatTradeValue(result.tradeValueChange)} pts
      </Text>

      <View style={styles.playerTags}>
        {result.playersReceived.slice(0, 2).map((p) => (
          <View key={p.id} style={[styles.playerTag, { backgroundColor: colors.success + "15", borderColor: colors.success + "30" }]}>
            <Text style={[styles.playerTagText, { color: colors.success }]} numberOfLines={1}>{p.name}</Text>
          </View>
        ))}
        {result.playersGiven.slice(0, 2).map((p) => (
          <View key={p.id} style={[styles.playerTag, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "30" }]}>
            <Text style={[styles.playerTagText, { color: colors.destructive }]} numberOfLines={1}>{p.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    headerTitle: { fontSize: 28, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    headerSub: { fontSize: 13, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular" },
    list: { paddingHorizontal: 16, paddingTop: 8 },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
    loadingText: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
    emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    emptyDesc: { fontSize: 14, color: colors.mutedForeground, textAlign: "center", fontFamily: "Inter_400Regular" },
    actionBtn: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: colors.radius,
      backgroundColor: colors.primary,
      marginTop: 4,
    },
    actionBtnText: { fontSize: 14, fontWeight: "700", color: colors.primaryForeground, fontFamily: "Inter_700Bold" },
    tradeCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: "hidden",
    },
    tradeCardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background + "80",
    },
    tradeName: { fontSize: 15, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    tradeMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    tradeMetaText: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    tradeActions: { flexDirection: "row", alignItems: "center", gap: 6 },
    refreshBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    refreshBtnStale: { borderColor: "#f59e0b40", backgroundColor: "#f59e0b10" },
    refreshBtnText: { fontSize: 11, fontWeight: "700", color: colors.mutedForeground, fontFamily: "Inter_700Bold" },
    deleteBtn: { padding: 5 },
    teamResultsRow: { padding: 12, gap: 10 },
    teamChip: {
      backgroundColor: colors.background + "60",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 6,
    },
    teamChipTop: { flexDirection: "row", alignItems: "flex-start" },
    teamChipName: { fontSize: 14, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    teamChipOwner: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    gradeBadge: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginLeft: 8,
    },
    gradeText: { fontSize: 22, fontWeight: "900", fontFamily: "Inter_700Bold", lineHeight: 26 },
    scoreText: { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold" },
    rationaleText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontStyle: "italic" },
    valueChangeText: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
    playerTags: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
    playerTag: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 4,
      borderWidth: 1,
      maxWidth: 130,
    },
    playerTagText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  });
}
