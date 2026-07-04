import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSession } from "@/context/SessionContext";

type Mode = "welcome" | "login" | "register";

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setAuth, sessionId } = useSession();

  const [mode, setMode] = useState<Mode>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const styles = makeStyles(colors);

  const handleBack = () => {
    if (mode === "welcome") {
      router.back();
    } else {
      setMode("welcome");
      setError("");
    }
  };

  const handleContinueGuest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (sessionId) {
      router.replace("/(tabs)");
    } else {
      router.replace("/connect");
    }
  };

  const apiCall = async (endpoint: string, body: object) => {
    const base = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
    const res = await fetch(`${base}/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || "Request failed");
    }
    return data;
  };

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "register") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
    }

    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const data = await apiCall(mode === "register" ? "register" : "login", {
        email: email.trim().toLowerCase(),
        password,
      });
      setAuth(data.token, data.user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (sessionId) {
        router.replace("/(tabs)");
      } else {
        router.replace("/connect");
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {mode === "welcome" ? (
            <WelcomeView
              colors={colors}
              styles={styles}
              onLogin={() => { setError(""); setMode("login"); }}
              onRegister={() => { setError(""); setMode("register"); }}
              onGuest={handleContinueGuest}
            />
          ) : (
            <FormView
              colors={colors}
              styles={styles}
              mode={mode}
              email={email} setEmail={setEmail}
              password={password} setPassword={setPassword}
              confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
              showPass={showPass} setShowPass={setShowPass}
              loading={loading}
              error={error}
              onSubmit={handleSubmit}
              onSwitchMode={() => {
                setError("");
                setMode(mode === "login" ? "register" : "login");
              }}
            />
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function WelcomeView({ colors, styles, onLogin, onRegister, onGuest }: any) {
  return (
    <View style={styles.welcomeContent}>
      <View style={styles.logoWrap}>
        <View style={[styles.logoCircle, { backgroundColor: colors.primary + "18" }]}>
          <Feather name="shuffle" size={36} color={colors.primary} />
        </View>
        <Text style={styles.appName}>TradeSim</Text>
        <Text style={styles.tagline}>Fantasy football trade analyzer{"\n"}for serious managers</Text>
      </View>

      <View style={styles.featureList}>
        {[
          { icon: "users", label: "3+ team trades", desc: "Simulate blockbuster multi-team deals" },
          { icon: "bar-chart-2", label: "Live grades", desc: "A+–F grades with real ESPN values" },
          { icon: "save", label: "Save trades", desc: "Revisit and refresh past analyses" },
        ].map((f) => (
          <View key={f.label} style={[styles.featureRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.featureIcon, { backgroundColor: colors.primary + "15" }]}>
              <Feather name={f.icon as any} size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.ctas}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={onRegister} activeOpacity={0.85}>
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Create Free Account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={onLogin} activeOpacity={0.85}>
          <Text style={[styles.btnText, { color: colors.foreground }]}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onGuest} activeOpacity={0.7} style={styles.guestBtn}>
          <Text style={styles.guestText}>Continue as Guest</Text>
          <Feather name="arrow-right" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FormView({ colors, styles, mode, email, setEmail, password, setPassword, confirmPassword, setConfirmPassword, showPass, setShowPass, loading, error, onSubmit, onSwitchMode }: any) {
  const isRegister = mode === "register";
  return (
    <View style={styles.formContent}>
      <Text style={styles.formTitle}>{isRegister ? "Create Account" : "Welcome back"}</Text>
      <Text style={styles.formSubtitle}>{isRegister ? "Save trades across devices and browsers." : "Sign in to access your saved trades."}</Text>

      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
        />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Password {isRegister && <Text style={styles.fieldHint}>(8+ characters)</Text>}</Text>
        <View style={[styles.passwordWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <TextInput
            style={[styles.passwordInput, { color: colors.foreground }]}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={!showPass}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
          <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
            <Feather name={showPass ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {isRegister && (
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>Confirm Password</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={!showPass}
            autoComplete="new-password"
          />
        </View>
      )}

      {!!error && (
        <View style={[styles.errorBanner, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "40" }]}>
          <Feather name="alert-circle" size={14} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1, marginTop: 8 }]}
        onPress={onSubmit}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={colors.primaryForeground} size="small" />
          : <Text style={[styles.btnText, { color: colors.primaryForeground }]}>{isRegister ? "Create Account" : "Sign In"}</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={onSwitchMode} style={styles.switchBtn} activeOpacity={0.7}>
        <Text style={styles.switchText}>
          {isRegister ? "Already have an account? " : "Don't have an account? "}
          <Text style={{ color: colors.primary }}>
            {isRegister ? "Sign in" : "Create one"}
          </Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: { paddingHorizontal: 16, paddingBottom: 4 },
    backBtn: { padding: 6, alignSelf: "flex-start" },
    scroll: { paddingHorizontal: 24, paddingTop: 8 },
    welcomeContent: { gap: 32 },
    logoWrap: { alignItems: "center", gap: 12, paddingTop: 16 },
    logoCircle: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
    appName: { fontSize: 30, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    tagline: { fontSize: 15, color: colors.mutedForeground, textAlign: "center", fontFamily: "Inter_400Regular", lineHeight: 22 },
    featureList: { gap: 10 },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: colors.radius, borderWidth: 1 },
    featureIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    featureLabel: { fontSize: 14, fontWeight: "600", color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    featureDesc: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1 },
    ctas: { gap: 12 },
    btn: { height: 52, borderRadius: colors.radius, alignItems: "center", justifyContent: "center" },
    btnText: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
    guestBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 4 },
    guestText: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    formContent: { gap: 20, paddingTop: 8 },
    formTitle: { fontSize: 26, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
    formSubtitle: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: -8 },
    fieldWrap: { gap: 6 },
    fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    fieldHint: { fontSize: 12, fontWeight: "400", color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    input: { height: 48, borderRadius: colors.radius, borderWidth: 1, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
    passwordWrap: { flexDirection: "row", alignItems: "center", borderRadius: colors.radius, borderWidth: 1, paddingHorizontal: 14 },
    passwordInput: { flex: 1, height: 48, fontSize: 15, fontFamily: "Inter_400Regular" },
    eyeBtn: { padding: 6 },
    errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: colors.radius, borderWidth: 1 },
    errorText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
    switchBtn: { alignItems: "center", paddingVertical: 4 },
    switchText: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
  });
}
