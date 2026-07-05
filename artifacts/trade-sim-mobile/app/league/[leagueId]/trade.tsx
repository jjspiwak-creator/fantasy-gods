import React, { useState, useMemo } from "react";
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
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSession } from "@/context/SessionContext";
import { useVibeText } from "@/hooks/useVibeText";
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
  const {
    sessionId,
    authToken,
    showLeagueWarnings,
    setShowLeagueWarnings,
    vibePreference,
  } = useSession();
  const queryClient = useQueryClient();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // ── All vibe text at top level ────────────────────────────────────────────
  const dismissBannerText = useVibeText(
    "Suppress Rule Warnings",
    "Tired of seeing this? Click to hide.",
  );
  const step1Title = useVibeText("Pick Participating Teams", "Who's in on this deal?");
  const step1Desc = useVibeText("Choose 2–12 teams for this trade", "Pick your players in this heist");
  const step2Title = useVibeText("Assign Players to Destinations", "Who's going where?");
  const step2Desc = useVibeText(
    "Tap a player, then choose where they go",
    "Tap to move 'em, pick their new home",
  );
  const step3Title = useVibeText("Simulation Complete", "Here's the Breakdown");
  const simulateLabel = useVibeText("Simulate", "Run It");
  const valueSectionLabel = useVibeText("Value Change", "Net Haul");
  const liveDeltaLabel = useVibeText("Live Net Delta", "Running Tab");
  const bannerTitleText = useVibeText("League Rule Notice", "Hold Up — Check the Roster");

  const { data: teams, isLoading } = useGetLeagueTeams(
    leagueId ?? "",
    { sessionId: sessionId ?? "" },
    { query: { enabled: !!sessionId && !!leagueId } },
  );

  const simulateMutation = useSimulateTrade();
  const saveMutation = useSaveTrade();

  const [step, setStep] = useState<Step>(1);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [transfers, setTransfers] = useState<PlayerTransfer[]>([]);
  const [simulationResult, setSimulationResult] = useState<TradeSimulationResult | null>(null);
  const [lastTransfers, setLastTransfers] = useState<PlayerTransfer[]>([]);
  const [dropsPerTeam, setDropsPerTeam] = useState<Record<string, string[]>>({});

  const styles = makeStyles(colors);

  const selectedTeamsData = teams?.filter((t) => selectedTeamIds.includes(t.id)) ?? [];
  const hasTransfers = transfers.length > 0;

  // ── Live delta computation for Step 2 ─────────────────────────────────────
  // Computes net value change per team as the user assembles transfers, before
  // hitting Simulate. Updated every time a player is toggled or redirected.
  const liveDeltas = useMemo(() => {
    const deltas: Record<string, number> = {};
    for (const id of selectedTeamIds) deltas[id] = 0;
    for (const t of transfers) {
      const fromTeamData = selectedTeamsData.find((tm) => tm.id === t.fromTeamId);
      const player = fromTeamData?.roster.find((p) => p.id === t.playerId);
      if (!player) continue;
      deltas[t.fromTeamId] = (deltas[t.fromTeamId] ?? 0) - player.tradeValue;
      deltas[t.toTeamId] = (deltas[t.toTeamId] ?? 0) + player.tradeValue;
    }
    return deltas;
  }, [transfers, selectedTeamsData, selectedTeamIds]);

  const overflowResolved =
    !simulationResult?.hasRosterOverflow ||
    (simulationResult?.teamResults ?? []).every((r) => {
      if (!r.rosterOverflow) return true;
      return (dropsPerTeam[r.teamId]?.length ?? 0) >= r.rosterOverflow.excess;
    });

  const toggleTeam = (teamId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  };

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

  const changeDestination = (playerId: string, toTeamId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTransfers((prev) =>
      prev.map((t) => (t.playerId === playerId ? { ...t, toTeamId } : t)),
    );
  };

  const toggleDrop = (teamId: string, playerId: string, excess: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDropsPerTeam((prev) => {
      const current = prev[teamId] ?? [];
      if (current.includes(playerId)) {
        return { ...prev, [teamId]: current.filter((id) => id !== playerId) };
      }
      if (current.length >= excess) return prev;
      return { ...prev, [teamId]: [...current, playerId] };
    });
  };

  const handleSimulate = () => {
    if (!sessionId || !leagueId || !teams) return;
    setLastTransfers(transfers);
    setDropsPerTeam({});
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
      },
    );
  };

  const handleSave = () => {
    if (!sessionId || !leagueId || !simulationResult || !overflowResolved) return;
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
      },
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading teams…</Text>
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
      {/* ── Header ── */}
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
                style={[
                  styles.stepDot,
                  s === step && styles.stepDotActive,
                  s < step && styles.stepDotDone,
                ]}
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
              <Text style={styles.stepBannerTitle}>{step1Title}</Text>
              <Text style={styles.stepBannerDesc}>{step1Desc}</Text>
            </View>
            <TouchableOpacity
              style={[styles.nextBtn, selectedTeamIds.length < 2 && styles.nextBtnDisabled]}
              disabled={selectedTeamIds.length < 2}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setStep(2);
              }}
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
                      {item.wins}–{item.losses}
                      {item.ties > 0 ? `–${item.ties}` : ""} · {item.pointsFor.toFixed(0)} pts
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

      {/* ── STEP 2: Assign Players ── */}
      {step === 2 && (
        <View style={{ flex: 1 }}>
          <View style={styles.stepBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepBannerTitle}>{step2Title}</Text>
              <Text style={styles.stepBannerDesc}>{step2Desc}</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.nextBtn,
                (!hasTransfers || simulateMutation.isPending) && styles.nextBtnDisabled,
              ]}
              disabled={!hasTransfers || simulateMutation.isPending}
              onPress={handleSimulate}
              activeOpacity={0.8}
            >
              {simulateMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>{simulateLabel}</Text>
                  <Feather name="zap" size={15} color={colors.primaryForeground} />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Live Delta Bar ── */}
          {hasTransfers && (
            <LiveDeltaBar
              selectedTeams={selectedTeamsData}
              deltas={liveDeltas}
              label={liveDeltaLabel}
              colors={colors}
              styles={styles}
            />
          )}

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
                            <Feather
                              name="check-circle"
                              size={18}
                              color={colors.primary}
                              style={{ marginLeft: 6 }}
                            />
                          )}
                        </TouchableOpacity>

                        {isSelected && otherTeams.length > 0 && (
                          <View style={styles.destRow}>
                            <Feather name="arrow-right" size={12} color={colors.primary} />
                            <Text style={styles.destLabel}>Send to</Text>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              style={{ flex: 1 }}
                            >
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
                                      <Text
                                        style={[
                                          styles.destChipText,
                                          isActive && styles.destChipTextActive,
                                        ]}
                                        numberOfLines={1}
                                      >
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
              <Text style={styles.stepBannerTitle}>{step3Title}</Text>
              <Text
                style={[
                  styles.stepBannerDesc,
                  {
                    color:
                      simulationResult.overallBalance >= 0
                        ? colors.success
                        : colors.destructive,
                  },
                ]}
              >
                Balance: {formatTradeValue(simulationResult.overallBalance)} pts
              </Text>
            </View>
            <View style={{ gap: 8, flexDirection: "row" }}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setStep(2)}
                activeOpacity={0.8}
              >
                <Feather name="edit-2" size={14} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.nextBtn,
                  (saveMutation.isPending || !overflowResolved) && styles.nextBtnDisabled,
                ]}
                onPress={handleSave}
                disabled={saveMutation.isPending || !overflowResolved}
                activeOpacity={0.8}
              >
                <Feather name="bookmark" size={14} color={colors.primaryForeground} />
                <Text style={styles.nextBtnText}>
                  {saveMutation.isPending ? "Saving…" : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
            showsVerticalScrollIndicator={false}
          >
            {simulationResult.hasRosterOverflow && (
              <OverflowSection
                teamResults={simulationResult.teamResults}
                dropsPerTeam={dropsPerTeam}
                onToggleDrop={toggleDrop}
                resolved={overflowResolved}
                colors={colors}
                styles={styles}
              />
            )}

            {showLeagueWarnings && (simulationResult.leagueWarnings?.length ?? 0) > 0 && (
              <View
                style={{
                  marginBottom: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "#f59e0b50",
                  backgroundColor: "#f59e0b0f",
                  padding: 14,
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <Feather
                  name="alert-triangle"
                  size={16}
                  color="#f59e0b"
                  style={{ marginTop: 1 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#f59e0b",
                      fontFamily: "Inter_700Bold",
                      marginBottom: 4,
                    }}
                  >
                    {bannerTitleText}
                  </Text>
                  {simulationResult.leagueWarnings.map((w: string, i: number) => (
                    <Text
                      key={i}
                      style={{
                        fontSize: 12,
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        lineHeight: 17,
                      }}
                    >
                      {w}
                    </Text>
                  ))}
                </View>
                <TouchableOpacity
                  onPress={() => setShowLeagueWarnings(false)}
                  style={{ padding: 4, flexDirection: "row", alignItems: "center", gap: 4 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="bell-off" size={14} color={colors.mutedForeground} />
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    {dismissBannerText}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {simulationResult.teamResults.map((result: TeamTradeResult) => (
              <ResultCard
                key={result.teamId}
                result={result}
                droppedIds={dropsPerTeam[result.teamId] ?? []}
                valueLabel={valueSectionLabel}
                colors={colors}
                styles={styles}
              />
            ))}

            {vibePreference === "the_boys" && (
              <View
                style={{
                  marginTop: 8,
                  marginBottom: 16,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "#08d4f020",
                  backgroundColor: "#08d4f00d",
                  padding: 16,
                  flexDirection: "row",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <Text style={{ fontSize: 22 }}>🏈</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: colors.foreground,
                      fontFamily: "Inter_700Bold",
                      marginBottom: 3,
                    }}
                  >
                    Thank you for being part of the movement.
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                      lineHeight: 18,
                    }}
                  >
                    If this app saved your season, tell your friends — we need more numbers!
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      Share.share({
                        message:
                          "I've been using TradeSim to analyze multi-team fantasy trades. Stop getting fleeced — know before you deal. 🏈",
                        title: "TradeSim — Fantasy Trade Analyzer",
                      })
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      marginTop: 8,
                      alignSelf: "flex-start",
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather name="share-2" size={13} color={colors.primary} />
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.primary,
                        fontFamily: "Inter_600SemiBold",
                        fontWeight: "600",
                      }}
                    >
                      Share TradeSim
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────
   Live Delta Bar — shown in Step 2 when at least one player is selected.
   Displays each participating team's current net value change in real time.
───────────────────────────────────────────── */
function LiveDeltaBar({
  selectedTeams,
  deltas,
  label,
  colors,
  styles,
}: {
  selectedTeams: Team[];
  deltas: Record<string, number>;
  label: string;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.deltaBanner}>
      <Text style={styles.deltaLabel}>{label}</Text>
      <View style={styles.deltaChips}>
        {selectedTeams.map((team) => {
          const delta = deltas[team.id] ?? 0;
          const isPos = delta > 0.5;
          const isNeg = delta < -0.5;
          const deltaColor = isPos
            ? colors.success
            : isNeg
              ? colors.destructive
              : colors.mutedForeground;
          const deltaBg = isPos
            ? colors.success + "15"
            : isNeg
              ? colors.destructive + "15"
              : colors.secondary;
          const deltaBorder = isPos
            ? colors.success + "40"
            : isNeg
              ? colors.destructive + "40"
              : colors.border;

          return (
            <View
              key={team.id}
              style={[styles.deltaChip, { backgroundColor: deltaBg, borderColor: deltaBorder }]}
            >
              <Text style={styles.deltaTeamName} numberOfLines={1}>
                {team.name}
              </Text>
              <Text style={[styles.deltaValue, { color: deltaColor }]}>
                {delta > 0 ? "+" : ""}
                {delta.toFixed(0)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────
   Overflow resolution section
───────────────────────────────────────────── */
function OverflowSection({
  teamResults,
  dropsPerTeam,
  onToggleDrop,
  resolved,
  colors,
  styles,
}: {
  teamResults: TeamTradeResult[];
  dropsPerTeam: Record<string, string[]>;
  onToggleDrop: (teamId: string, playerId: string, excess: number) => void;
  resolved: boolean;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const overflowing = teamResults.filter((r) => r.rosterOverflow);
  if (overflowing.length === 0) return null;

  const totalExcess = overflowing.reduce((s, r) => s + (r.rosterOverflow?.excess ?? 0), 0);
  const totalDropped = overflowing.reduce(
    (s, r) => s + (dropsPerTeam[r.teamId]?.length ?? 0),
    0,
  );
  const amber = "#f59e0b";
  const bannerBg = resolved ? colors.success + "18" : amber + "18";
  const bannerBorder = resolved ? colors.success + "50" : amber + "50";

  return (
    <View style={[styles.overflowCard, { borderColor: bannerBorder, backgroundColor: bannerBg }]}>
      <View style={[styles.overflowBanner, { borderBottomColor: bannerBorder }]}>
        <Feather
          name={resolved ? "check-circle" : "alert-triangle"}
          size={18}
          color={resolved ? colors.success : amber}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.overflowTitle, { color: resolved ? colors.success : amber }]}>
            {resolved ? "Drops Resolved" : "Roster Overflow — Action Required"}
          </Text>
          <Text style={styles.overflowDesc}>
            {resolved
              ? "All drops selected. You can now save this trade."
              : `${overflowing.length} team${overflowing.length > 1 ? "s" : ""} will exceed their roster limit.`}
          </Text>
        </View>
        <Text style={[styles.overflowCounter, { color: resolved ? colors.success : amber }]}>
          {totalDropped}/{totalExcess}
        </Text>
      </View>

      {!resolved &&
        overflowing.map((result) => {
          const excess = result.rosterOverflow!.excess;
          const picked = dropsPerTeam[result.teamId] ?? [];
          const remaining = excess - picked.length;

          return (
            <View key={result.teamId} style={styles.overflowTeamSection}>
              <View style={styles.overflowTeamHeader}>
                <View>
                  <Text style={styles.overflowTeamName}>{result.teamName}</Text>
                  <Text style={styles.overflowTeamMeta}>
                    +{excess} over limit · drop {remaining > 0 ? remaining : "✓"} more
                  </Text>
                </View>
                <View
                  style={[
                    styles.overflowBadge,
                    {
                      borderColor: remaining > 0 ? amber + "50" : colors.success + "50",
                      backgroundColor: remaining > 0 ? amber + "15" : colors.success + "15",
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: remaining > 0 ? amber : colors.success,
                      fontFamily: "Inter_700Bold",
                    }}
                  >
                    {remaining > 0 ? `Drop ${remaining}` : "✓ Done"}
                  </Text>
                </View>
              </View>

              <Text style={styles.overflowPickHint}>
                Choose {excess} player{excess > 1 ? "s" : ""} to release from post-trade roster:
              </Text>

              {result.rosterAfter.map((player) => {
                const isDropped = picked.includes(player.id);
                const isNewlyReceived = result.playersReceived.some((p) => p.id === player.id);
                const isDisabled = isNewlyReceived || (!isDropped && picked.length >= excess);

                return (
                  <TouchableOpacity
                    key={player.id}
                    style={[
                      styles.overflowPlayerRow,
                      isDropped && styles.overflowPlayerRowDropped,
                      isDisabled && styles.overflowPlayerRowDisabled,
                    ]}
                    onPress={() => !isDisabled && onToggleDrop(result.teamId, player.id, excess)}
                    activeOpacity={isDisabled ? 1 : 0.75}
                    disabled={isDisabled}
                  >
                    <View style={styles.playerPos}>
                      <Text style={styles.playerPosText}>{player.position}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.playerName} numberOfLines={1}>
                          {player.name}
                        </Text>
                        {isNewlyReceived && (
                          <View
                            style={[
                              styles.newBadge,
                              {
                                backgroundColor: colors.primary + "25",
                                borderColor: colors.primary + "40",
                              },
                            ]}
                          >
                            <Text style={[styles.newBadgeText, { color: colors.primary }]}>
                              New
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.playerMeta}>
                        {player.nflTeam} · {player.tradeValue.toFixed(1)} val
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.dropCircle,
                        isDropped && {
                          backgroundColor: colors.destructive,
                          borderColor: colors.destructive,
                        },
                      ]}
                    >
                      {isDropped && <Feather name="x" size={12} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
    </View>
  );
}

/* ─────────────────────────────────────────────
   Result card
───────────────────────────────────────────── */
function ResultCard({
  result,
  droppedIds,
  valueLabel,
  colors,
  styles,
}: {
  result: TeamTradeResult;
  droppedIds: string[];
  valueLabel: string;
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
        {result.rosterOverflow && (
          <View style={styles.overflowPill}>
            <Text style={styles.overflowPillText}>+{result.rosterOverflow.excess} overflow</Text>
          </View>
        )}
        <View style={[styles.gradeBadge, { backgroundColor: gradeBg, borderColor: gradeBorder }]}>
          <Text style={[styles.gradeText, { color: gradeColor }]}>{result.grade}</Text>
          <Text style={[styles.scoreText, { color: gradeColor }]}>{result.score}/100</Text>
        </View>
      </View>

      <View style={styles.rationaleRow}>
        <Text style={[styles.rationaleText, { color: gradeColor }]}>{result.gradeRationale}</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.valueLabel}>{valueLabel}</Text>
        <Text
          style={[
            styles.valueAmount,
            {
              color:
                result.tradeValueChange > 0
                  ? colors.success
                  : result.tradeValueChange < 0
                    ? colors.destructive
                    : colors.mutedForeground,
            },
          ]}
        >
          {formatTradeValue(result.tradeValueChange)}
        </Text>
        <Text style={styles.valueMeta}>
          {result.tradeValueBefore.toFixed(1)} → {result.tradeValueAfter.toFixed(1)}
        </Text>
      </View>

      <View style={styles.playerSplit}>
        <View style={styles.playerSplitCol}>
          <Text style={[styles.playerSplitLabel, { color: colors.destructive }]}>↑ Giving</Text>
          {result.playersGiven.length > 0 ? (
            result.playersGiven.map((p) => (
              <View
                key={p.id}
                style={[
                  styles.playerMiniCard,
                  {
                    borderColor: colors.destructive + "30",
                    backgroundColor: colors.destructive + "08",
                  },
                ]}
              >
                <Text style={styles.playerMiniPos}>{p.position}</Text>
                <Text style={styles.playerMiniName} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.playerMiniVal}>{p.tradeValue.toFixed(0)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noneText}>None</Text>
          )}
        </View>
        <View style={[styles.playerSplitDivider, { backgroundColor: colors.border }]} />
        <View style={styles.playerSplitCol}>
          <Text style={[styles.playerSplitLabel, { color: colors.success }]}>↓ Receiving</Text>
          {result.playersReceived.length > 0 ? (
            result.playersReceived.map((p) => (
              <View
                key={p.id}
                style={[
                  styles.playerMiniCard,
                  {
                    borderColor: colors.success + "30",
                    backgroundColor: colors.success + "08",
                  },
                ]}
              >
                <Text style={styles.playerMiniPos}>{p.position}</Text>
                <Text style={styles.playerMiniName} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.playerMiniVal}>{p.tradeValue.toFixed(0)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noneText}>None</Text>
          )}

          {droppedIds.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text
                style={[
                  styles.playerSplitLabel,
                  { color: colors.destructive, marginBottom: 4 },
                ]}
              >
                ✂ Dropping
              </Text>
              {result.rosterAfter
                .filter((p) => droppedIds.includes(p.id))
                .map((p) => (
                  <View
                    key={p.id}
                    style={[
                      styles.playerMiniCard,
                      {
                        borderColor: colors.destructive + "30",
                        backgroundColor: colors.destructive + "08",
                      },
                    ]}
                  >
                    <Text style={styles.playerMiniPos}>{p.position}</Text>
                    <Text style={styles.playerMiniName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={[styles.playerMiniVal, { color: colors.destructive }]}>
                      {p.tradeValue.toFixed(0)}
                    </Text>
                  </View>
                ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────
   Styles
───────────────────────────────────────────── */
function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { alignItems: "center", justifyContent: "center", gap: 12 },
    loadingText: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    backBtn: {
      marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
      borderRadius: colors.radius, backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
    },
    backBtnText: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    header: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingHorizontal: 16, paddingBottom: 10,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backIconBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center",
    },
    headerTitle: {
      fontSize: 20, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold",
    },
    stepIndicator: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    stepDotActive: { backgroundColor: colors.primary, width: 16 },
    stepDotDone: { backgroundColor: colors.primary + "60" },
    stepLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    stepBanner: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      padding: 14, backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    stepBannerTitle: {
      fontSize: 15, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold",
    },
    stepBannerDesc: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    nextBtn: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
      backgroundColor: colors.primary,
    },
    nextBtnDisabled: { backgroundColor: colors.primary + "40" },
    nextBtnText: {
      fontSize: 13, fontWeight: "700", color: colors.primaryForeground, fontFamily: "Inter_700Bold",
    },
    editBtn: {
      width: 36, height: 36, borderRadius: 8,
      backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border,
    },
    listContent: { padding: 12, gap: 10 },

    // Live delta bar
    deltaBanner: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.background + "f0",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    deltaLabel: {
      fontSize: 9,
      fontWeight: "700",
      color: colors.mutedForeground,
      fontFamily: "Inter_700Bold",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    deltaChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    deltaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
    },
    deltaTeamName: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
      maxWidth: 90,
    },
    deltaValue: {
      fontSize: 14,
      fontWeight: "900",
      fontFamily: "Inter_700Bold",
    },

    teamCard: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, padding: 14,
    },
    teamCardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + "08" },
    teamCardInfo: { flex: 1 },
    teamCardName: { fontSize: 15, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    teamCardOwner: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    teamCardRecord: {
      fontSize: 11, color: colors.mutedForeground,
      fontFamily: "Inter_400Regular", marginTop: 2,
    },
    teamSelectCircle: {
      width: 24, height: 24, borderRadius: 12,
      borderWidth: 2, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
    },
    teamSelectCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    rosterCard: {
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    rosterCardHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      padding: 12, backgroundColor: colors.background + "80",
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    rosterTeamName: { fontSize: 14, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    rosterCardSub: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    playerRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 12, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: colors.border + "60",
    },
    playerRowSelected: { backgroundColor: colors.primary + "10" },
    playerPos: {
      width: 32, height: 32, borderRadius: 6,
      backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", marginRight: 10,
    },
    playerPosText: { fontSize: 10, fontWeight: "700", color: colors.mutedForeground, fontFamily: "Inter_700Bold" },
    playerName: { fontSize: 13, fontWeight: "600", color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    playerMeta: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    playerValue: { fontSize: 12, fontWeight: "700", color: colors.primary, fontFamily: "Inter_700Bold" },
    destRow: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 7,
      backgroundColor: colors.primary + "08",
      borderBottomWidth: 1, borderBottomColor: colors.border + "60",
    },
    destLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium", flexShrink: 0 },
    destChip: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary,
    },
    destChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "20" },
    destChipText: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    destChipTextActive: { color: colors.primary, fontFamily: "Inter_700Bold" },

    overflowCard: { borderRadius: colors.radius, borderWidth: 1.5, overflow: "hidden" },
    overflowBanner: {
      flexDirection: "row", alignItems: "center", gap: 10,
      padding: 14, borderBottomWidth: 1,
    },
    overflowTitle: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
    overflowDesc: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1 },
    overflowCounter: { fontSize: 20, fontWeight: "900", fontFamily: "Inter_700Bold" },
    overflowTeamSection: { padding: 12, borderTopWidth: 1, borderTopColor: colors.border + "40" },
    overflowTeamHeader: {
      flexDirection: "row", alignItems: "flex-start",
      justifyContent: "space-between", marginBottom: 6,
    },
    overflowTeamName: { fontSize: 13, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    overflowTeamMeta: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    overflowBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
    overflowPickHint: {
      fontSize: 11, color: colors.mutedForeground,
      fontFamily: "Inter_400Regular", marginBottom: 8,
    },
    overflowPlayerRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 10, paddingVertical: 9,
      borderRadius: 8, borderWidth: 1,
      borderColor: colors.border + "60", backgroundColor: colors.secondary + "60", marginBottom: 4,
    },
    overflowPlayerRowDropped: {
      borderColor: colors.destructive + "50", backgroundColor: colors.destructive + "10",
    },
    overflowPlayerRowDisabled: { opacity: 0.4 },
    dropCircle: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 2, borderColor: colors.border,
      alignItems: "center", justifyContent: "center", marginLeft: 8,
    },
    newBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
    newBadgeText: { fontSize: 9, fontWeight: "700", fontFamily: "Inter_700Bold" },
    overflowPill: {
      paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
      backgroundColor: "#f59e0b18", borderWidth: 1,
      borderColor: "#f59e0b40", marginRight: 8,
    },
    overflowPillText: { fontSize: 10, fontWeight: "700", color: "#f59e0b", fontFamily: "Inter_700Bold" },

    resultCard: {
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    resultHeader: {
      flexDirection: "row", alignItems: "flex-start",
      padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.background + "60",
    },
    resultTeamName: { fontSize: 16, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    resultOwner: {
      fontSize: 12, color: colors.mutedForeground,
      fontFamily: "Inter_400Regular", marginTop: 1,
    },
    gradeBadge: {
      alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 5, marginLeft: 12,
    },
    gradeText: { fontSize: 28, fontWeight: "900" },
    scoreText: { fontSize: 11, fontWeight: "700" },
    rationaleRow: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderBottomWidth: 1, borderBottomColor: colors.border + "40",
      backgroundColor: colors.background + "30",
    },
    rationaleText: { fontSize: 12, fontFamily: "Inter_500Medium" },
    valueRow: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 14, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: colors.border + "40",
    },
    valueLabel: {
      fontSize: 11, color: colors.mutedForeground,
      fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5,
    },
    valueAmount: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
    valueMeta: {
      fontSize: 11, color: colors.mutedForeground,
      fontFamily: "Inter_400Regular", marginLeft: "auto" as any,
    },
    playerSplit: { flexDirection: "row" },
    playerSplitCol: { flex: 1, padding: 12, gap: 6 },
    playerSplitDivider: { width: 1 },
    playerSplitLabel: {
      fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold",
      textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4,
    },
    playerMiniCard: {
      flexDirection: "row", alignItems: "center",
      gap: 6, padding: 6, borderRadius: 6, borderWidth: 1,
    },
    playerMiniPos: {
      fontSize: 9, fontWeight: "700", color: colors.mutedForeground,
      fontFamily: "Inter_700Bold", width: 22, textAlign: "center",
    },
    playerMiniName: { flex: 1, fontSize: 11, color: colors.foreground, fontFamily: "Inter_500Medium" },
    playerMiniVal: { fontSize: 11, fontWeight: "700", color: colors.primary, fontFamily: "Inter_700Bold" },
    noneText: {
      fontSize: 12, color: colors.mutedForeground,
      fontFamily: "Inter_400Regular", fontStyle: "italic",
    },
  });
}
