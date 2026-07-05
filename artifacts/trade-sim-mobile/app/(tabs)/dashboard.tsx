import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSession } from "@/context/SessionContext";
import { useVibeText } from "@/hooks/useVibeText";
import {
  useLeagueSummary,
  type TeamMetrics,
  type LeagueSummary,
} from "@/hooks/useLeagueSummary";
import { getLeagues, type League } from "@workspace/api-client-react";

type RankView = "weekly" | "ros";

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessionId } = useSession();

  const [view, setView] = useState<RankView>("weekly");
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);

  // ── All vibe text at top level (unconditional hooks) ─────────────────────
  const headerTitle = useVibeText("League Intelligence", "Your Boys' Report Card");
  const connectDescText = useVibeText(
    "Connect your ESPN account to see live power rankings and positional grades.",
    "Hook up your ESPN and we'll tell you exactly who's winning your league.",
  );
  const weeklyLabel = useVibeText("This Week", "Matchup View");
  const rosLabel = useVibeText("Rest of Season", "Long Haul");
  const weeklySubtitle = useVibeText(
    "Projected score from each team's optimal starting lineup",
    "Who's got the best squad on the field this week",
  );
  const rosSubtitle = useVibeText(
    "Cumulative roster VORP — full team depth, starters + bench",
    "Who's built to win the rest of the way",
  );
  const loadingText = useVibeText(
    "Calculating power rankings…",
    "Figuring out who's cooked…",
  );
  const errorText = useVibeText(
    "Could not load league data.",
    "ESPN's being weird. Give it a second.",
  );
  const gradesLabel = useVibeText("Position Grades", "Grade Book");
  const avgLabel = useVibeText("League avg", "Avg manager");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;
  const styles = makeStyles(colors);

  // ── Queries (always called) ───────────────────────────────────────────────
  const { data: leagues, isLoading: leaguesLoading } = useQuery<League[]>({
    queryKey: ["leagues", sessionId],
    queryFn: () => getLeagues({ sessionId: sessionId! }),
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (!selectedLeagueId && leagues && leagues.length > 0) {
      setSelectedLeagueId(leagues[0].id);
    }
  }, [leagues]);

  const activeLeagueId = selectedLeagueId ?? leagues?.[0]?.id ?? null;

  const {
    data: summary,
    isLoading: summaryLoading,
    error,
    refetch,
    isRefetching,
  } = useLeagueSummary(sessionId, activeLeagueId);

  // ── No session state ──────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <View style={[styles.container, { paddingTop: topPad + 20 }]}>
        <View style={styles.centered}>
          <View style={styles.logoBadge}>
            <Feather name="bar-chart-2" size={32} color={colors.primary} />
          </View>
          <Text style={styles.noSessionTitle}>{headerTitle}</Text>
          <Text style={styles.noSessionDesc}>{connectDescText}</Text>
          <TouchableOpacity
            style={styles.connectBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/connect");
            }}
            activeOpacity={0.8}
          >
            <Feather name="zap" size={16} color={colors.primaryForeground} />
            <Text style={styles.connectBtnText}>Connect ESPN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isLoading = leaguesLoading || summaryLoading;
  const rankings = view === "weekly" ? summary?.weeklyRankings : summary?.rosRankings;

  let minScore = 0;
  let scoreRange = 1;
  if (rankings && rankings.length > 0) {
    const scores = rankings.map((t) =>
      view === "weekly" ? t.weeklyProjectedScore : t.rosRosterVorp,
    );
    minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    scoreRange = maxScore - minScore || 1;
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSub}>
            {view === "weekly" ? weeklySubtitle : rosSubtitle}
          </Text>
        </View>
        {activeLeagueId && summary && (
          <TouchableOpacity
            style={styles.gradesBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/league/${activeLeagueId}/roster-matrix`);
            }}
            activeOpacity={0.8}
          >
            <Feather name="grid" size={13} color={colors.primary} />
            <Text style={styles.gradesBtnText}>{gradesLabel}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── League chips (only when 2+ leagues) ── */}
      {(leagues?.length ?? 0) > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.leagueChips}
        >
          {leagues!.map((league) => {
            const isActive = league.id === activeLeagueId;
            return (
              <TouchableOpacity
                key={league.id}
                style={[styles.leagueChip, isActive && styles.leagueChipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedLeagueId(league.id);
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={[styles.leagueChipText, isActive && styles.leagueChipTextActive]}
                  numberOfLines={1}
                >
                  {league.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── View toggle ── */}
      <View style={styles.toggleRow}>
        <View style={styles.toggle}>
          {(["weekly", "ros"] as RankView[]).map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.toggleOpt, view === v && styles.toggleOptActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setView(v);
              }}
              activeOpacity={0.8}
            >
              <Feather
                name={v === "weekly" ? "calendar" : "trending-up"}
                size={12}
                color={view === v ? colors.primaryForeground : colors.mutedForeground}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
                {v === "weekly" ? weeklyLabel : rosLabel}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.mutedText}>{loadingText}</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={36} color={colors.destructive} />
          <Text style={styles.mutedText}>{errorText}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : !rankings || rankings.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="inbox" size={36} color={colors.mutedForeground} />
          <Text style={styles.mutedText}>No data for this league yet.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
        >
          {/* League context row */}
          <View style={styles.ctxRow}>
            <Feather name="activity" size={12} color={colors.mutedForeground} />
            <Text style={styles.ctxText}>
              {summary!.teamCount} teams · {avgLabel}:{" "}
              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>
                {view === "weekly"
                  ? `${summary!.leagueAvgWeeklyScore.toFixed(1)} pts`
                  : `${summary!.leagueAvgRosVorp.toFixed(0)} VORP`}
              </Text>
            </Text>
          </View>

          {rankings.map((team) => {
            const score =
              view === "weekly" ? team.weeklyProjectedScore : team.rosRosterVorp;
            const barPct = ((score - minScore) / scoreRange) * 100;
            return (
              <RankCard
                key={team.teamId}
                team={team}
                view={view}
                barPct={barPct}
                colors={colors}
                styles={styles}
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RankCard({
  team,
  view,
  barPct,
  colors,
  styles,
}: {
  team: TeamMetrics;
  view: RankView;
  barPct: number;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const rank = view === "weekly" ? team.weeklyRank : team.rosRank;
  const score = view === "weekly" ? team.weeklyProjectedScore : team.rosRosterVorp;

  const scoreLabel =
    view === "weekly"
      ? `${score.toFixed(1)} pts`
      : `${score >= 0 ? "+" : ""}${score.toFixed(0)}`;

  const rankMeta =
    rank === 1
      ? { bg: "#fbbf2420", border: "#fbbf2450", text: "#fbbf24" }
      : rank === 2
        ? { bg: "#94a3b820", border: "#94a3b850", text: "#94a3b8" }
        : rank === 3
          ? { bg: "#cd7c2a20", border: "#cd7c2a50", text: "#cd7c2a" }
          : { bg: colors.secondary, border: colors.border, text: colors.mutedForeground };

  const scoreColor = view === "ros" && score < 0 ? colors.destructive : colors.primary;

  // Top-4 positional grade chips
  const grades = team.positionalGrades;
  const gradePairs: Array<{ pos: string; grade: string }> = [
    { pos: "QB", grade: grades.QB.grade },
    { pos: "RB", grade: grades.RB.grade },
    { pos: "WR", grade: grades.WR.grade },
    { pos: "TE", grade: grades.TE.grade },
  ];

  return (
    <View style={styles.rankCard}>
      {/* Rank badge */}
      <View
        style={[
          styles.rankBadge,
          { backgroundColor: rankMeta.bg, borderColor: rankMeta.border },
        ]}
      >
        <Text style={[styles.rankNum, { color: rankMeta.text }]}>#{rank}</Text>
      </View>

      <View style={{ flex: 1 }}>
        {/* Top row: name + score */}
        <View style={styles.rankTopRow}>
          <Text style={styles.rankTeamName} numberOfLines={1}>
            {team.teamName}
          </Text>
          <Text style={[styles.rankScore, { color: scoreColor }]}>{scoreLabel}</Text>
        </View>

        {/* Meta row: owner + record */}
        <View style={styles.rankMetaRow}>
          <Text style={styles.rankOwner} numberOfLines={1}>
            {team.ownerName}
          </Text>
          <Text style={styles.rankRecord}>{team.record}</Text>
        </View>

        {/* Positional grade chips */}
        <View style={styles.gradeChips}>
          {gradePairs.map(({ pos, grade }) => {
            const gradeColor = getGradeColor(grade);
            return (
              <View
                key={pos}
                style={[
                  styles.gradeChip,
                  { backgroundColor: gradeColor + "18", borderColor: gradeColor + "40" },
                ]}
              >
                <Text style={[styles.gradeChipPos, { color: colors.mutedForeground }]}>
                  {pos}
                </Text>
                <Text style={[styles.gradeChipVal, { color: gradeColor }]}>{grade}</Text>
              </View>
            );
          })}
        </View>

        {/* Strength bar */}
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.max(3, Math.min(100, barPct))}%` as any },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function getGradeColor(grade: string): string {
  if (grade.startsWith("A")) return "#22ba5a";
  if (grade === "B+" || grade === "B") return "#08d4f0";
  if (grade === "B-" || grade === "C+") return "#7c5cbf";
  if (grade === "C" || grade === "C-") return "#f59e0b";
  return "#d9243a";
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    headerSub: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    gradesBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary + "50",
      backgroundColor: colors.primary + "10",
      marginTop: 4,
      flexShrink: 0,
    },
    gradesBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
      fontFamily: "Inter_700Bold",
    },

    leagueChips: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
    leagueChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.secondary,
      maxWidth: 180,
    },
    leagueChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "15",
    },
    leagueChipText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
    },
    leagueChipTextActive: {
      color: colors.primary,
      fontFamily: "Inter_700Bold",
    },

    toggleRow: { paddingHorizontal: 16, paddingBottom: 10 },
    toggle: {
      flexDirection: "row",
      backgroundColor: colors.secondary,
      borderRadius: 10,
      padding: 3,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: colors.border,
    },
    toggleOpt: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
    },
    toggleOptActive: { backgroundColor: colors.primary },
    toggleText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.mutedForeground,
      fontFamily: "Inter_600SemiBold",
    },
    toggleTextActive: {
      color: colors.primaryForeground,
      fontFamily: "Inter_700Bold",
    },

    ctxRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 4,
      paddingBottom: 10,
    },
    ctxText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },

    listContent: { paddingHorizontal: 16, paddingTop: 4 },

    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      paddingHorizontal: 32,
    },
    logoBadge: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary + "20",
      borderWidth: 2,
      borderColor: colors.primary + "40",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    noSessionTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      textAlign: "center",
    },
    noSessionDesc: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 20,
    },
    connectBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: colors.radius,
      backgroundColor: colors.primary,
    },
    connectBtnText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.primaryForeground,
      fontFamily: "Inter_700Bold",
    },

    mutedText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
    },
    retryBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    retryBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },

    rankCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 8,
    },
    rankBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      flexShrink: 0,
    },
    rankNum: { fontSize: 14, fontWeight: "900", fontFamily: "Inter_700Bold" },
    rankTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    rankTeamName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      flex: 1,
      marginRight: 8,
    },
    rankScore: {
      fontSize: 15,
      fontWeight: "700",
      fontFamily: "Inter_700Bold",
      flexShrink: 0,
    },
    rankMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 2,
    },
    rankOwner: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      flex: 1,
    },
    rankRecord: {
      fontSize: 11,
      color: colors.mutedForeground + "90",
      fontFamily: "Inter_400Regular",
      flexShrink: 0,
    },

    gradeChips: {
      flexDirection: "row",
      gap: 5,
      marginTop: 7,
    },
    gradeChip: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    gradeChipPos: {
      fontSize: 9,
      fontWeight: "700",
      fontFamily: "Inter_700Bold",
      textTransform: "uppercase",
    },
    gradeChipVal: {
      fontSize: 11,
      fontWeight: "900",
      fontFamily: "Inter_700Bold",
    },

    barTrack: {
      height: 3,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginTop: 8,
      overflow: "hidden",
    },
    barFill: {
      height: 3,
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
  });
}
