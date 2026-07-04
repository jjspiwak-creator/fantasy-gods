import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useColors } from "@/hooks/useColors";
import { useSession } from "@/context/SessionContext";
import { useConnectEspn } from "@workspace/api-client-react";

const JS_SNIPPET = `javascript:(function(){function getCookie(n){var m=document.cookie.match(new RegExp("(?:^|;\\s*)"+n+"=([^;]*)"));return m?decodeURIComponent(m[1]):'';}var s2=getCookie("espn_s2"),sw=getCookie("SWID");if(!s2||!sw){alert("Not found - make sure you're logged in.");return;}var d=JSON.stringify({espnS2:s2,swid:sw});prompt("Copy all of this:",d);})();`;

export default function ConnectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setSession } = useSession();

  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [pasteError, setPasteError] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<"phone" | "computer">("phone");
  const [snippetCopied, setSnippetCopied] = useState(false);

  const connectMutation = useConnectEspn();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handlePaste = async () => {
    setPasteError("");
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) {
        setPasteError("Clipboard is empty. Follow the steps below first.");
        return;
      }
      const data = JSON.parse(text);
      if (data.espnS2 && data.swid) {
        setEspnS2(data.espnS2);
        setSwid(data.swid);
        setPasteSuccess(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setPasteSuccess(false), 3000);
      } else {
        setPasteError("Clipboard doesn't contain ESPN credentials. Follow the steps below first.");
      }
    } catch {
      setPasteError("Couldn't read clipboard. Make sure you've completed the steps below.");
    }
  };

  const handleCopySnippet = async () => {
    await Clipboard.setStringAsync(JS_SNIPPET);
    setSnippetCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setSnippetCopied(false), 3000);
  };

  const canSubmit = espnS2.trim().length > 10 && swid.trim().length > 5;

  const handleConnect = () => {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    connectMutation.mutate(
      { data: { espnS2: espnS2.trim(), swid: swid.trim() } },
      {
        onSuccess: (res) => {
          setSession(res.sessionId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: (err: any) => {
          Alert.alert("Connection Failed", err?.data?.error ?? "Check your credentials and try again.");
        },
      }
    );
  };

  const styles = makeStyles(colors);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connect ESPN</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Feather name="zap" size={28} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Sync Your Leagues</Text>
          <Text style={styles.heroDesc}>
            ESPN doesn't support third-party sign-in, so you need to copy two cookie values from your browser.
          </Text>
        </View>

        {/* Paste button */}
        <TouchableOpacity
          style={[styles.pasteBtn, pasteSuccess && styles.pasteBtnSuccess]}
          onPress={handlePaste}
          activeOpacity={0.8}
        >
          <Feather
            name={pasteSuccess ? "check-circle" : "clipboard"}
            size={18}
            color={pasteSuccess ? colors.success : colors.primary}
          />
          <Text style={[styles.pasteBtnText, pasteSuccess && { color: colors.success }]}>
            {pasteSuccess ? "Credentials Pasted!" : "Paste Credentials"}
          </Text>
        </TouchableOpacity>

        {pasteError ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={13} color={colors.destructive} />
            <Text style={styles.errorText}>{pasteError}</Text>
          </View>
        ) : null}

        {/* Connect button */}
        <TouchableOpacity
          style={[styles.connectBtn, (!canSubmit || connectMutation.isPending) && styles.connectBtnDisabled]}
          onPress={handleConnect}
          disabled={!canSubmit || connectMutation.isPending}
          activeOpacity={0.8}
        >
          {connectMutation.isPending ? (
            <Text style={styles.connectBtnText}>Connecting...</Text>
          ) : (
            <>
              <Text style={styles.connectBtnText}>Sync My Leagues</Text>
              <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
            </>
          )}
        </TouchableOpacity>

        {/* Divider with manual toggle */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <TouchableOpacity onPress={() => setManualOpen(!manualOpen)} style={styles.dividerBtn}>
            <Feather name={manualOpen ? "chevron-up" : "chevron-down"} size={12} color={colors.mutedForeground} />
            <Text style={styles.dividerText}>enter manually instead</Text>
          </TouchableOpacity>
          <View style={styles.dividerLine} />
        </View>

        {/* Manual entry */}
        {manualOpen && (
          <View style={styles.manualSection}>
            <Text style={styles.inputLabel}>ESPN_S2 Cookie</Text>
            <TextInput
              style={styles.textArea}
              value={espnS2}
              onChangeText={setEspnS2}
              placeholder="AEBf1..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>SWID Cookie</Text>
            <TextInput
              style={styles.inputField}
              value={swid}
              onChangeText={setSwid}
              placeholder="{A1B2C3D4-E5F6...}"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {/* How to get credentials */}
        <View style={styles.helpCard}>
          <View style={styles.helpCardHeader}>
            <Text style={styles.helpCardTitle}>How to get your ESPN credentials</Text>
            <Text style={styles.helpCardDesc}>
              ESPN requires copying two cookie values from your browser session.
            </Text>
          </View>

          {/* Tab toggle */}
          <View style={styles.helpTabs}>
            <TouchableOpacity
              style={[styles.helpTab, helpTab === "phone" && styles.helpTabActive]}
              onPress={() => setHelpTab("phone")}
            >
              <Feather name="smartphone" size={13} color={helpTab === "phone" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.helpTabText, helpTab === "phone" && { color: colors.primary }]}>On Phone</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.helpTab, helpTab === "computer" && styles.helpTabActive]}
              onPress={() => setHelpTab("computer")}
            >
              <Feather name="monitor" size={13} color={helpTab === "computer" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.helpTabText, helpTab === "computer" && { color: colors.primary }]}>On Computer</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.helpSteps}>
            {helpTab === "phone" ? (
              <>
                {[
                  { n: "1", t: "Open ESPN.com in Chrome or Safari", d: "Make sure you're logged into your ESPN account." },
                  { n: "2", t: "Tap the address bar and paste this snippet", d: null, isSnippet: true },
                  { n: "3", t: "Press Go / Enter", d: "A popup appears with your credentials. Select all and copy." },
                  { n: "4", t: 'Come back here and tap "Paste Credentials"', d: "Both fields fill in automatically." },
                ].map((step) => (
                  <View key={step.n} style={styles.step}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{step.n}</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>{step.t}</Text>
                      {step.isSnippet ? (
                        <TouchableOpacity style={styles.snippetBox} onPress={handleCopySnippet} activeOpacity={0.8}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <Text style={styles.snippetText} numberOfLines={2}>{JS_SNIPPET}</Text>
                          </ScrollView>
                          <View style={styles.snippetCopyBtn}>
                            <Feather
                              name={snippetCopied ? "check" : "copy"}
                              size={13}
                              color={snippetCopied ? colors.success : colors.primary}
                            />
                            <Text style={[styles.snippetCopyText, snippetCopied && { color: colors.success }]}>
                              {snippetCopied ? "Copied!" : "Copy"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.stepDesc}>{step.d}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <>
                {[
                  { n: "1", t: "Open ESPN.com on your computer", d: "Make sure you're logged into your account." },
                  { n: "2", t: "Open the browser console", d: "Press F12 → Console tab (or Cmd+Option+J on Mac)." },
                  { n: "3", t: "Paste and run this snippet", d: null, isSnippet: true },
                  { n: "4", t: 'Copy the output and tap "Paste Credentials" here', d: "Done — both fields fill in instantly." },
                ].map((step) => (
                  <View key={step.n} style={styles.step}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{step.n}</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>{step.t}</Text>
                      {step.isSnippet ? (
                        <TouchableOpacity style={styles.snippetBox} onPress={handleCopySnippet} activeOpacity={0.8}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <Text style={styles.snippetText} numberOfLines={2}>{JS_SNIPPET}</Text>
                          </ScrollView>
                          <View style={styles.snippetCopyBtn}>
                            <Feather
                              name={snippetCopied ? "check" : "copy"}
                              size={13}
                              color={snippetCopied ? colors.success : colors.primary}
                            />
                            <Text style={[styles.snippetCopyText, snippetCopied && { color: colors.success }]}>
                              {snippetCopied ? "Copied!" : "Copy"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.stepDesc}>{step.d}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>

        {/* Security note */}
        <View style={styles.securityNote}>
          <Feather name="lock" size={12} color={colors.primary} />
          <Text style={styles.securityText}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>Private & secure. </Text>
            Your credentials are only used to fetch data from ESPN's API and are never shared.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    scroll: { paddingHorizontal: 16, paddingTop: 20 },
    hero: { alignItems: "center", gap: 10, marginBottom: 24 },
    heroBadge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary + "20",
      borderWidth: 2,
      borderColor: colors.primary + "50",
      alignItems: "center",
      justifyContent: "center",
    },
    heroTitle: { fontSize: 24, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    heroDesc: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
      fontFamily: "Inter_400Regular",
      lineHeight: 20,
    },
    pasteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: colors.radius,
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.primary + "10",
      marginBottom: 10,
    },
    pasteBtnSuccess: {
      borderColor: colors.success,
      backgroundColor: colors.success + "10",
    },
    pasteBtnText: { fontSize: 15, fontWeight: "700", color: colors.primary, fontFamily: "Inter_700Bold" },
    errorBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      backgroundColor: colors.destructive + "10",
      borderWidth: 1,
      borderColor: colors.destructive + "30",
      borderRadius: 8,
      padding: 10,
      marginBottom: 10,
    },
    errorText: { flex: 1, fontSize: 12, color: colors.destructive, fontFamily: "Inter_400Regular" },
    connectBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 15,
      borderRadius: colors.radius,
      backgroundColor: colors.primary,
      marginBottom: 18,
    },
    connectBtnDisabled: { backgroundColor: colors.primary + "40" },
    connectBtnText: { fontSize: 15, fontWeight: "700", color: colors.primaryForeground, fontFamily: "Inter_700Bold" },
    dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    dividerText: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    manualSection: { marginBottom: 20 },
    inputLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.foreground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 6,
      fontFamily: "Inter_700Bold",
    },
    textArea: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 12,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      minHeight: 72,
      textAlignVertical: "top",
    },
    inputField: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 12,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
    helpCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      marginBottom: 12,
    },
    helpCardHeader: { padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    helpCardTitle: { fontSize: 14, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    helpCardDesc: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
      fontFamily: "Inter_400Regular",
    },
    helpTabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
    helpTab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 10,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    helpTabActive: { borderBottomColor: colors.primary, backgroundColor: colors.primary + "08" },
    helpTabText: { fontSize: 11, fontWeight: "700", color: colors.mutedForeground, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
    helpSteps: { padding: 14, gap: 14 },
    step: { flexDirection: "row", gap: 10 },
    stepNum: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary + "20",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
      flexShrink: 0,
    },
    stepNumText: { fontSize: 11, fontWeight: "700", color: colors.primary, fontFamily: "Inter_700Bold" },
    stepContent: { flex: 1 },
    stepTitle: { fontSize: 13, fontWeight: "600", color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    stepDesc: { fontSize: 12, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular" },
    snippetBox: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 8,
      marginTop: 6,
      gap: 6,
    },
    snippetText: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    snippetCopyBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" },
    snippetCopyText: { fontSize: 11, fontWeight: "600", color: colors.primary, fontFamily: "Inter_600SemiBold" },
    securityNote: {
      flexDirection: "row",
      gap: 6,
      alignItems: "flex-start",
      padding: 12,
      backgroundColor: colors.secondary,
      borderRadius: 8,
      marginBottom: 8,
    },
    securityText: { flex: 1, fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 16 },
  });
}
