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
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSession } from "@/context/SessionContext";
import {
  useGetLeagueTeams,
  useSimulateTrade,
  useSaveTrade,
  getGetSavedTradesQueryKey,
  type Team,
  type Player,
  type TeamTradeResult,
  type TradeSimulationResult,
  type PlayerTransfer,
} from "@workspace/api-client-react";
import { formatTradeValue, getGradeColor, getGradeBgColor, getGradeBorderColor } from "@/lib/utils";

type Step = 1 | 2 | 3;

export default function TradeBuilderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { sessionId } = useSession();
  const queryClient = useQueryClient();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: teams, isLoading } = useGetLeagueTeams(
    leagueId ?? "",
    { sessionId: sessionId ?? "" },
    { query: { enabled: !!sessionId && !!leagueId } }
  );

  const simulateMutation = useSimulateTrade();
  const saveMutation = useSaveTrade();

  const [step, setStep] = useState<Step>(1);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  /** Origin-to-destination matrix: each entry is one explicit player movement */
  const [transfers, setTransfers] = useState<PlayerTransfer[]>([]);
  const [simulationResult, setSimulationResult] = useState<TradeSimulationResult | null>(null);
  const [lastTransfers, setLastTransfers] = useState<PlayerTransfer[]>([]);

  const styles = makeStyles(colors);

  const toggleTeam = (teamId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  /** Toggle a player in/out of the transfer matrix.
   *  Default destination: next team in the selected list (convenient default,
   *  can be changed by tapping a destination chip). */
  const togglePlayer = (playerId: string, fromTeamId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTransfers((prev) => {
      if (prev.some((t) => t.playerId === playerId)) {
        return prev.filter((t) => t.playerId !== playerId);
      }
      const fromIdx = selectedTeamIds.indexOf(fromTeamId);
      const toTeamId = selectedTeamIds[(fromIdx + 1) % selectedTeamIds.length];
      return [...prev, { playerId, fromTeamId, toTeamId }];
    });
  };

  /** Change the destination of an already-selected player */
  const changeDestination = (playerId: string, toTeamId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTransfers((prev) =>
      prev.map((t) => (t.playerId === playerId ? { ...t, toTeamId } : t))
    );
  };

  const handleSimulate = () => {
    if (!sessionId || !leagueId || !teams) return;
    setLastTransfers(transfers);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    simulateMutation.mutate(
      { data: { sessionId, leagueId, transfers, teams } },
      {
        onSuccess: (result) => {
          setSimulationResult(result);
          setStep(3);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: () => {
          Alert.alert("Simulation Failed", "Could not simulate the trade. Please try again.");
        },
      }
    );
  };

  const handleSave = () => {
    if (!sessionId || !leagueId || !simulationResult) return;
    const names = simulationResult.teamResults.map((t) => t.teamName).join(" & ");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveMutation.mutate(
      {
        data: {
          sessionId,
          leagueId,
          name: `Trade: ${names}`,
          result: simulationResult,
          transfers: lastTransfers,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSavedTradesQueryKey() });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.push("/(tabs)/saved");
        },
      }
    );
  };

  const selectedTeamsData = teams?.filter((t) => selectedTeamIds.includes(t.id)) ?? [];
  const hasTransfers = transfers.length > 0;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading teams...</Text>
      </View>
    );
  }

  if (!teams) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topPad }]}>
        <Feather name="alert-circle" size={40} color={colors.destructive} />
        <Text style={styles.loadingText}>Failed to load teams.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep((step - 1) as Step) : router.back())}
          style={styles.backIconBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Trade Builder</Text>
          <View style={styles.stepIndicator}>
            {([1, 2, 3] as Step[]).map((s) => (
              <View
                key={s}
                style={[styles.stepDot, s === step && styles.stepDotActive, s < step && styles.stepDotDone]}
              />
            ))}
            <Text style={styles.stepLabel}>
              {step === 1 ? "Select Teams" : step === 2 ? "Assign Players" : "Results"}
            </Text>
          </View>
        </View>
      </View>

      {/* ── STEP 1: Select Teams ── */}
      {step === 1 && (
        <View style={{ flex: 1 }}>
          <View style={styles.stepBanner}>
            <View>
              <Text style={styles.stepBannerTitle}>Pick Participating Teams</Text>
              <Text style={styles.stepBannerDesc}>Choose 2–12 teams for this trade</Text>
            </View>
            <TouchableOpacity
              style={[styles.nextBtn, selectedTeamIds.length < 2 && styles.nextBtnDisabled]}
              disabled={selectedTeamIds.length < 2}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep(2); }}
              activeOpacity={0.8}
            >
              <Text style={styles.nextBtnText}>Next</Text>
              <Feather name="arrow-right" size={15} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={teams}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }: { item: Team }) => {
              const selected = selectedTeamIds.includes(item.id);
              return (
                <TouchableOpacity
                  style={[styles.teamCard, selected && styles.teamCardSelected]}
                  onPress={() => toggleTeam(item.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.teamCardInfo}>
                    <Text style={[styles.teamCardName, selected && { color: colors.primary }]}>
                      {item.name}
                    </Text>
                    <Text style={styles.teamCardOwner}>{item.ownerName}</Text>
                    <Text style={styles.teamCardRecord}>
                      {item.wins}–{item.losses}{item.ties > 0 ? `–${item.ties}` : ""} · {item.pointsFor.toFixed(0)} pts
                    </Text>
                  </View>
                  <View style={[styles.teamSelectCircle, selected && styles.teamSelectCircleActive]}>
                    {selected && <Feather name="check" size={14} color={colors.primaryForeground} />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* ── STEP 2: Assign Players with Destinations ── */}
      {step === 2 && (
        <View style={{ flex: 1 }}>
          <View style={styles.stepBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepBannerTitle}>Assign Players to Destinations</Text>
              <Text style={styles.stepBannerDesc}>Tap a player, then choose where they go</Text>
            </View>
            <TouchableOpacity
              style={[styles.nextBtn, (!hasTransfers || simulateMutation.isPending) && styles.nextBtnDisabled]}
              disabled={!hasTransfers || simulateMutation.isPending}
              onPress={handleSimulate}
              activeOpacity={0.8}
            >
              {simulateMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>Simulate</Text>
                  <Feather name="zap" size={15} color={colors.primaryForeground} />
                </>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
            showsVerticalScrollIndicator={false}
          >
            {selectedTeamsData.map((team) => {
              const otherTeams = selectedTeamsData.filter((t) => t.id !== team.id);
              return (
                <View key={team.id} style={styles.rosterCard}>
                  <View style={styles.rosterCardHeader}>
                    <Text style={styles.rosterTeamName}>{team.name}</Text>
                    <Text style={styles.rosterCardSub}>Tap player → pick destination</Text>
                  </View>
                  {team.roster.map((player: Player) => {
                    const transfer = transfers.find((t) => t.playerId === player.id);
                    const isSelected = !!transfer;
                    return (
                      <View key={player.id}>
                        <TouchableOpacity
                          style={[styles.playerRow, isSelected && styles.playerRowSelected]}
                          onPress={() => togglePlayer(player.id, team.id)}
                          activeOpacity={0.75}
                        >
                          <View style={styles.playerPos}>
                            <Text style={styles.playerPosText}>{player.position}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.playerName}>{player.name}</Text>
                            <Text style={styles.playerMeta}>
                              {player.nflTeam} · {player.points.toFixed(0)} pts
                              {player.injuryStatus ? ` · ⚠ ${player.injuryStatus}` : ""}
                            </Text>
                          </View>
                          <Text style={styles.playerValue}>{player.tradeValue.toFixed(0)}</Text>
                          {isSelected && (
                            <Feather name="check-circle" size={18} color={colors.primary} style={{ marginLeft: 6 }} />
                          )}
                        </TouchableOpacity>

                        {/* Destination picker: shown only when player is selected */}
                        {isSelected && otherTeams.length > 0 && (
                          <View style={styles.destRow}>
                            <Feather name="arrow-right" size={12} color={colors.primary} />
                            <Text style={styles.destLabel}>Send to</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                              <View style={{ flexDirection: "row", gap: 6 }}>
                                {otherTeams.map((destTeam) => {
                                  const isActive = transfer?.toTeamId === destTeam.id;
                                  return (
                                    <TouchableOpacity
                                      key={destTeam.id}
                                      style={[styles.destChip, isActive && styles.destChipActive]}
                                      onPress={() => changeDestination(player.id, destTeam.id)}
                                      activeOpacity={0.75}
                                    >
                                      <Text style={[styles.destChipText, isActive && styles.destChipTextActive]} numberOfLines={1}>
                                        {destTeam.name}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── STEP 3: Results ── */}
      {step === 3 && simulationResult && (
        <View style={{ flex: 1 }}>
          <View style={styles.stepBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepBannerTitle}>Simulation Complete</Text>
              <Text style={[
                styles.stepBannerDesc,
                { color: simulationResult.overallBalance >= 0 ? colors.success : colors.destructive }
              ]}>
                Balance: {formatTradeValue(simulationResult.overallBalance)} pts
              </Text>
            </View>
            <View style={{ gap: 8, flexDirection: "row" }}>
              <TouchableOpacity style={styles.editBtn} onPress={() => setStep(2)} activeOpacity={0.8}>
                <Feather name="edit-2" size={14} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextBtn, saveMutation.isPending && styles.nextBtnDisabled]}
                onPress={handleSave}
                disabled={saveMutation.isPending}
                activeOpacity={0.8}
              >
                <Feather name="bookmark" size={14} color={colors.primaryForeground} />
                <Text style={styles.nextBtnText}>{saveMutation.isPending ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
            showsVerticalScrollIndicator={false}
          >
            {simulationResult.teamResults.map((result: TeamTradeResult) => (
              <ResultCard key={result.teamId} result={result} colors={colors} styles={styles} />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function ResultCard({
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
    <View style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultTeamName}>{result.teamName}</Text>
          <Text style={styles.resultOwner}>{result.ownerName}</Text>
        </View>
        <View style={[styles.gradeBadge, { backgroundColor: gradeBg, borderColor: gradeBorder }]}>
          <Text style={[styles.gradeText, { color: gradeColor }]}>{result.grade}</Text>
          <Text style={[styles.scoreText, { color: gradeColor }]}>{result.score}/100</Text>
        </View>
      </View>

      <View style={styles.rationaleRow}>
        <Text style={[styles.rationaleText, { color: gradeColor }]}>{result.gradeRationale}</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.valueLabel}>Value Change</Text>
        <Text style={[
          styles.valueAmount,
          {
            color: result.tradeValueChange > 0
              ? colors.success
              : result.tradeValueChange < 0
              ? colors.destructive
              : colors.mutedForeground
          }
        ]}>
          {formatTradeValue(result.tradeValueChange)}
        </Text>
        <Text style={styles.valueMeta}>
          {result.tradeValueBefore.toFixed(1)} → {result.tradeValueAfter.toFixed(1)}
        </Text>
      </View>

      <View style={styles.playerSplit}>
        <View style={styles.playerSplitCol}>
          <Text style={[styles.playerSplitLabel, { color: colors.destructive }]}>↑ Giving</Text>
          {result.playersGiven.length > 0 ? result.playersGiven.map((p) => (
            <View key={p.id} style={[styles.playerMiniCard, { borderColor: colors.destructive + "30", backgroundColor: colors.destructive + "08" }]}>
              <Text style={styles.playerMiniPos}>{p.position}</Text>
              <Text style={styles.playerMiniName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.playerMiniVal}>{p.tradeValue.toFixed(0)}</Text>
            </View>
          )) : <Text style={styles.noneText}>None</Text>}
        </View>
        <View style={[styles.playerSplitDivider, { backgroundColor: colors.border }]} />
        <View style={styles.playerSplitCol}>
          <Text style={[styles.playerSplitLabel, { color: colors.success }]}>↓ Receiving</Text>
          {result.playersReceived.length > 0 ? result.playersReceived.map((p) => (
            <View key={p.id} style={[styles.playerMiniCard, { borderColor: colors.success + "30", backgroundColor: colors.success + "08" }]}>
              <Text style={styles.playerMiniPos}>{p.position}</Text>
              <Text style={styles.playerMiniName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.playerMiniVal}>{p.tradeValue.toFixed(0)}</Text>
            </View>
          )) : <Text style={styles.noneText}>None</Text>}
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { alignItems: "center", justifyContent: "center", gap: 12 },
    loadingText: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    backBtn: {
      marginTop: 8,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: colors.radius,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backBtnText: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 20, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    stepIndicator: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    stepDotActive: { backgroundColor: colors.primary, width: 16 },
    stepDotDone: { backgroundColor: colors.primary + "60" },
    stepLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    stepBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 14,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    stepBannerTitle: { fontSize: 15, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    stepBannerDesc: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    nextBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    nextBtnDisabled: { backgroundColor: colors.primary + "40" },
    nextBtnText: { fontSize: 13, fontWeight: "700", color: colors.primaryForeground, fontFamily: "Inter_700Bold" },
    editBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    listContent: { padding: 12, gap: 10 },
    teamCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    teamCardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + "08" },
    teamCardInfo: { flex: 1 },
    teamCardName: { fontSize: 15, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    teamCardOwner: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    teamCardRecord: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    teamSelectCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    teamSelectCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    rosterCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    rosterCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 12,
      backgroundColor: colors.background + "80",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rosterTeamName: { fontSize: 14, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    rosterCardSub: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    playerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "60",
    },
    playerRowSelected: { backgroundColor: colors.primary + "10" },
    playerPos: {
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    playerPosText: { fontSize: 10, fontWeight: "700", color: colors.mutedForeground, fontFamily: "Inter_700Bold" },
    playerName: { fontSize: 13, fontWeight: "600", color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    playerMeta: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    playerValue: { fontSize: 12, fontWeight: "700", color: colors.primary, fontFamily: "Inter_700Bold" },

    /* Destination selector row */
    destRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.primary + "08",
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "60",
    },
    destLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium", flexShrink: 0 },
    destChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.secondary,
    },
    destChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "20" },
    destChipText: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    destChipTextActive: { color: colors.primary, fontFamily: "Inter_700Bold" },

    resultCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    resultHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background + "60",
    },
    resultTeamName: { fontSize: 16, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    resultOwner: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1 },
    gradeBadge: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 5,
      marginLeft: 12,
    },
    gradeText: { fontSize: 28, fontWeight: "900" },
    scoreText: { fontSize: 11, fontWeight: "700" },
    rationaleRow: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "40",
      backgroundColor: colors.background + "30",
    },
    rationaleText: { fontSize: 12, fontFamily: "Inter_500Medium" },
    valueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "40",
    },
    valueLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
    valueAmount: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
    valueMeta: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginLeft: "auto" },
    playerSplit: { flexDirection: "row" },
    playerSplitCol: { flex: 1, padding: 12, gap: 6 },
    playerSplitDivider: { width: 1 },
    playerSplitLabel: { fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
    playerMiniCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      padding: 6,
      borderRadius: 6,
      borderWidth: 1,
    },
    playerMiniPos: { fontSize: 9, fontWeight: "700", color: colors.mutedForeground, fontFamily: "Inter_700Bold", width: 22, textAlign: "center" },
    playerMiniName: { flex: 1, fontSize: 11, color: colors.foreground, fontFamily: "Inter_500Medium" },
    playerMiniVal: { fontSize: 11, fontWeight: "700", color: colors.primary, fontFamily: "Inter_700Bold" },
    noneText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  });
}
