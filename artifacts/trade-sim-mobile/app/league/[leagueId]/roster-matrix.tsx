import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useSession } from "@/context/SessionContext";
import { useVibeText } from "@/hooks/useVibeText";
import { useLeagueSummary, type TeamMetrics, type PositionalGrade } from "@/hooks/useLeagueSummary";
import { getGradeColor, getGradeBgColor, getGradeBorderColor } from "@/lib/utils";

const POSITIONS = ["QB", "RB", "WR", "TE"] as const;
type Pos = (typeof POSITIONS)[number];

const CELL_W = 56;
const TEAM_COL_W = 118;

export default function RosterMatrixScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { sessionId } = useSession();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // ── All vibe text at top level ──────────────────────────────────────────────
  const headerTitle = useVibeText("Position Grades", "Grade Book");
  const headerSub = useVibeText(
    "A+ to F letter grade per position group vs league average VORP",
    "See who's stacked and who's cooked at every spot",
  );
  const legendDesc = useVibeText(
    "Grades reflect percentage deviation from league-average VORP at each position.",
    "A+ means loaded, F means you need to make some calls.",
  );
  const loadingText = useVibeText("Loading grade matrix…", "Grading everyone's rosters…");

  const { data: summary, isLoading, error } = useLeagueSummary(
    sessionId,
    leagueId ?? null,
  );

  const styles = makeStyles(colors);

  // weeklyRankings and rosRankings share identical positionalGrades data —
  // use weeklyRankings (rank order) for the matrix rows.
  const teams = summary?.weeklyRankings ?? [];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSub} numberOfLines={2}>{headerSub}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.mutedText}>{loadingText}</Text>
        </View>
      ) : error || teams.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={36} color={colors.destructive} />
          <Text style={styles.mutedText}>Could not load grade data.</Text>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.backLinkText}>← Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tableWrap}>
              {/* ── Column headers ── */}
              <View style={styles.colHeaderRow}>
                <View style={[styles.teamColPlaceholder, { width: TEAM_COL_W }]} />
                {POSITIONS.map((pos) => (
                  <View key={pos} style={[styles.colHeaderCell, { width: CELL_W }]}>
                    <Text style={styles.colHeaderText}>{pos}</Text>
                  </View>
                ))}
              </View>

              {/* ── Team rows ── */}
              {teams.map((team, idx) => (
                <TeamRow
                  key={team.teamId}
                  team={team}
                  isEven={idx % 2 === 0}
                  colors={colors}
                  styles={styles}
                />
              ))}

              {/* ── Grade legend ── */}
              <View style={styles.legend}>
                <Text style={styles.legendTitle}>Grade Scale</Text>
                <View style={styles.legendRow}>
                  {["A+", "A-", "B+", "B", "B-", "C", "D", "F"].map((g) => (
                    <View
                      key={g}
                      style={[
                        styles.legendCell,
                        {
                          backgroundColor: getGradeBgColor(g),
                          borderColor: getGradeBorderColor(g),
                        },
                      ]}
                    >
                      <Text style={[styles.legendGrade, { color: getGradeColor(g) }]}>
                        {g}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.legendDesc}>{legendDesc}</Text>
              </View>
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Team row ─────────────────────────────────────────────────────────────────

function TeamRow({
  team,
  isEven,
  colors,
  styles,
}: {
  team: TeamMetrics;
  isEven: boolean;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={[styles.teamRow, isEven && styles.teamRowEven]}>
      {/* Team name column */}
      <View style={[styles.teamNameCol, { width: TEAM_COL_W }]}>
        <Text style={styles.teamName} numberOfLines={1}>
          {team.teamName}
        </Text>
        <Text style={styles.teamRecord}>{team.record}</Text>
      </View>

      {/* Grade cells */}
      {POSITIONS.map((pos) => {
        const pg: PositionalGrade = team.positionalGrades[pos];
        const color = getGradeColor(pg.grade);
        const bg = getGradeBgColor(pg.grade);
        const border = getGradeBorderColor(pg.grade);

        return (
          <View key={pos} style={[styles.gradeCell, { width: CELL_W }]}>
            <View style={[styles.gradeBadge, { backgroundColor: bg, borderColor: border }]}>
              <Text style={[styles.gradeText, { color }]}>{pg.grade}</Text>
              <Text style={[styles.gradeVorp, { color: color + "aa" }]}>
                {pg.vsLeagueAvgPct >= 0 ? "+" : ""}
                {pg.vsLeagueAvgPct.toFixed(0)}%
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
      flexShrink: 0,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    headerSub: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
      lineHeight: 17,
    },

    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingHorizontal: 32,
    },
    mutedText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
    },
    backLink: { marginTop: 4 },
    backLinkText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
      fontFamily: "Inter_700Bold",
    },

    tableWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },

    colHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    teamColPlaceholder: {},
    colHeaderCell: { alignItems: "center", justifyContent: "center" },
    colHeaderText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.mutedForeground,
      fontFamily: "Inter_700Bold",
      textTransform: "uppercase",
      letterSpacing: 1,
    },

    teamRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "50",
    },
    teamRowEven: { backgroundColor: colors.secondary + "35" },
    teamNameCol: { paddingRight: 10 },
    teamName: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    teamRecord: {
      fontSize: 10,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 1,
    },

    gradeCell: { alignItems: "center", justifyContent: "center" },
    gradeBadge: {
      width: 44,
      height: 42,
      borderRadius: 8,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    gradeText: {
      fontSize: 13,
      fontWeight: "900",
      fontFamily: "Inter_700Bold",
      lineHeight: 16,
    },
    gradeVorp: {
      fontSize: 8,
      fontWeight: "700",
      fontFamily: "Inter_700Bold",
    },

    legend: {
      marginTop: 20,
      padding: 14,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    legendTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.mutedForeground,
      fontFamily: "Inter_700Bold",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    legendCell: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      minWidth: 34,
      alignItems: "center",
    },
    legendGrade: {
      fontSize: 12,
      fontWeight: "900",
      fontFamily: "Inter_700Bold",
    },
    legendDesc: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      lineHeight: 17,
    },
  });
}
