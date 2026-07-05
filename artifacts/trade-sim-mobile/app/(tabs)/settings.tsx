import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSession } from "@/context/SessionContext";

const SETTINGS_VIBE_OPTIONS = [
  { key: "corporate" as const, label: "Corporate" },
  { key: "the_boys" as const, label: "The Boys" },
  { key: "coach_speak" as const, label: "Coach Talk" },
  { key: "vegas_degenerate" as const, label: "Vegas" },
];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    sessionId, clearSession,
    user, clearAuth,
    showLeagueWarnings, setShowLeagueWarnings,
    vibePreference, setVibePreference,
  } = useSession();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const styles = makeStyles(colors);

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect ESPN",
      "This will remove your session and you'll need to reconnect to access your leagues.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            clearSession();
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "You'll return to the welcome screen. Your saved trades and preferences will be cleared from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            clearSession();
            clearAuth();
          },
        },
      ]
    );
  };

  const handleToggleWarnings = (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowLeagueWarnings(val);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Account Section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your Account</Text>
          <View style={styles.statusCard}>
            <View style={[styles.accountIcon, { backgroundColor: user ? colors.primary + "18" : colors.secondary }]}>
              <Feather name="user" size={18} color={user ? colors.primary : colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>
                {user ? user.email : "Guest"}
              </Text>
              <Text style={styles.statusDesc}>
                {user
                  ? `Member since ${new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
                  : "Create an account to save trades across devices."}
              </Text>
            </View>
          </View>

          {user ? (
            <TouchableOpacity style={styles.dangerBtn} onPress={handleSignOut} activeOpacity={0.8}>
              <Feather name="log-out" size={16} color={colors.destructive} />
              <Text style={styles.dangerBtnText}>Sign Out</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/auth")} activeOpacity={0.8}>
              <Feather name="user-plus" size={16} color={colors.primaryForeground} />
              <Text style={styles.primaryBtnText}>Create Account or Sign In</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── ESPN Connection ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ESPN Connection</Text>
          <View style={styles.statusCard}>
            <View style={[styles.statusDot, { backgroundColor: sessionId ? colors.success : colors.destructive }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>
                {sessionId ? "Connected" : "Not Connected"}
              </Text>
              <Text style={styles.statusDesc}>
                {sessionId
                  ? "Your ESPN session is active. Leagues and player data are syncing live."
                  : "Connect your ESPN account to build and analyze trades."}
              </Text>
            </View>
          </View>

          {sessionId ? (
            <TouchableOpacity style={styles.dangerBtn} onPress={handleDisconnect} activeOpacity={0.8}>
              <Feather name="wifi-off" size={16} color={colors.destructive} />
              <Text style={styles.dangerBtnText}>Disconnect ESPN Account</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/connect")} activeOpacity={0.8}>
              <Feather name="zap" size={16} color={colors.primaryForeground} />
              <Text style={styles.primaryBtnText}>Connect ESPN Account</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Trade Preferences ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Trade Preferences</Text>

          {/* Vibe Mode 4-way selector */}
          <View style={[styles.statusCard, styles.vibeCard]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <View style={[styles.accountIcon, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="zap" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>Vibe Mode</Text>
                <Text style={styles.statusDesc} numberOfLines={2}>
                  {vibePreference === "corporate" && "Analytics-focused, data-driven copy"}
                  {vibePreference === "the_boys" && "Casual fantasy banter for the group chat"}
                  {vibePreference === "coach_speak" && "Intense football clichés and press-conference energy"}
                  {vibePreference === "vegas_degenerate" && "Sports betting jargon — units, spreads, parlays"}
                </Text>
              </View>
            </View>
            <View style={styles.vibeChipRow}>
              {SETTINGS_VIBE_OPTIONS.map((opt) => {
                const isActive = vibePreference === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.vibeChip, isActive && styles.vibeChipActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setVibePreference(opt.key);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.vibeChipText, isActive && styles.vibeChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* League Rule Warnings toggle */}
          <View style={[styles.statusCard, { alignItems: "center" }]}>
            <View style={[styles.accountIcon, { backgroundColor: showLeagueWarnings ? "#f59e0b18" : colors.secondary }]}>
              <Feather name={showLeagueWarnings ? "bell" : "bell-off"} size={16} color={showLeagueWarnings ? "#f59e0b" : colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>League Rule Warnings</Text>
              <Text style={styles.statusDesc}>Show a banner when a trade violates roster limits.</Text>
            </View>
            <Switch
              value={showLeagueWarnings}
              onValueChange={handleToggleWarnings}
              trackColor={{ false: colors.secondary, true: colors.primary + "80" }}
              thumbColor={showLeagueWarnings ? colors.primary : colors.mutedForeground}
              ios_backgroundColor={colors.secondary}
            />
          </View>
        </View>

        {/* ── About ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About TradeSim</Text>
          <View style={styles.infoCard}>
            {[
              { icon: "users", label: "3+ Team Trades", desc: "Simulate blockbuster trades with any number of teams simultaneously." },
              { icon: "bar-chart-2", label: "Live Grades", desc: "Trades are graded A+–F using real-time ESPN player values." },
              { icon: "refresh-cw", label: "Score Refresh", desc: "Saved trades can be refreshed to reflect current player performance." },
              { icon: "shield", label: "Private & Secure", desc: "Your ESPN credentials are only used to fetch your own league data." },
            ].map((item) => (
              <View key={item.label} style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Feather name={item.icon as any} size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── How grading works ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>How Trade Grading Works</Text>
          <View style={styles.infoCard}>
            <Text style={styles.gradeDesc}>
              Each trade is graded using the value change of players exchanged, weighted by their season scoring and roster position importance.
            </Text>
            <View style={styles.gradeRows}>
              {[
                { grade: "A+/A", label: "Steal — significant value gain" },
                { grade: "B", label: "Win — clear positive return" },
                { grade: "C", label: "Even — roughly balanced deal" },
                { grade: "D", label: "Loss — value given up" },
                { grade: "F", label: "Lopsided — severe overpay" },
              ].map((g) => (
                <View key={g.grade} style={styles.gradeRow}>
                  <View style={[styles.gradeChip, { backgroundColor: getGradeChipBg(g.grade) }]}>
                    <Text style={[styles.gradeChipText, { color: getGradeChipColor(g.grade) }]}>{g.grade}</Text>
                  </View>
                  <Text style={styles.gradeRowLabel}>{g.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function getGradeChipColor(grade: string): string {
  if (grade.startsWith("A")) return "#22ba5a";
  if (grade.startsWith("B")) return "#08d4f0";
  if (grade.startsWith("C")) return "#f59e0b";
  if (grade.startsWith("D")) return "#f97316";
  return "#d9243a";
}
function getGradeChipBg(grade: string): string {
  return getGradeChipColor(grade) + "18";
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingBottom: 12 },
    headerTitle: { fontSize: 28, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    scroll: { paddingHorizontal: 16, paddingTop: 4 },
    section: { marginBottom: 24 },
    sectionLabel: {
      fontSize: 11, fontWeight: "700", color: colors.mutedForeground,
      textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
      fontFamily: "Inter_700Bold",
    },
    statusCard: {
      flexDirection: "row", alignItems: "flex-start", gap: 12,
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 10,
    },
    accountIcon: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: "center", justifyContent: "center",
    },
    statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
    statusTitle: { fontSize: 15, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    statusDesc: { fontSize: 13, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular", lineHeight: 18 },
    primaryBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      paddingVertical: 13, borderRadius: colors.radius, backgroundColor: colors.primary,
    },
    primaryBtnText: { fontSize: 14, fontWeight: "700", color: colors.primaryForeground, fontFamily: "Inter_700Bold" },
    dangerBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      paddingVertical: 13, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.destructive + "50", backgroundColor: colors.destructive + "10",
    },
    dangerBtnText: { fontSize: 14, fontWeight: "700", color: colors.destructive, fontFamily: "Inter_700Bold" },
    infoCard: {
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, padding: 14, gap: 14,
    },
    infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    infoIcon: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center",
    },
    infoLabel: { fontSize: 14, fontWeight: "600", color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    infoDesc: { fontSize: 12, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular", lineHeight: 17 },
    gradeDesc: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 19 },
    gradeRows: { gap: 8 },
    gradeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    gradeChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, minWidth: 42, alignItems: "center" },
    gradeChipText: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold" },
    gradeRowLabel: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },

    vibeCard: { flexDirection: "column", alignItems: "stretch", marginBottom: 10 },
    vibeChipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    vibeChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.secondary,
    },
    vibeChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    vibeChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.mutedForeground,
      fontFamily: "Inter_700Bold",
    },
    vibeChipTextActive: { color: colors.primary },
  });
}
