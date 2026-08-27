import { useOAuth, useSignIn } from "@clerk/expo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppLogo,
  AppText,
  FormField,
  MobilePage,
  PrimaryButton,
} from "@/components/ui";
import { colors, contentPadding } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

type OAuthProvider = "google" | "facebook";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, fetchStatus } = useSignIn();
  const googleOAuth = useOAuth({ strategy: "oauth_google" });
  const facebookOAuth = useOAuth({ strategy: "oauth_facebook" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  const busy = fetchStatus === "fetching" || oauthBusy !== null;

  const logIn = async () => {
    if (!email.trim() || !password)
      return setError("Enter your email and password.");
    setError("");
    const result = await signIn.password({
      emailAddress: email.trim().toLowerCase(),
      password,
    });
    if (result.error)
      return setError(
        result.error.message || "Email or password is incorrect.",
      );
    if (signIn.status !== "complete")
      return setError(
        "This account requires an additional authentication step that is not enabled in this demonstration.",
      );
    const finalized = await signIn.finalize();
    if (finalized.error)
      return setError(
        finalized.error.message || "Sign-in could not be completed.",
      );
    router.replace("/");
  };

  const continueWithOAuth = async (provider: OAuthProvider) => {
    setOauthBusy(provider);
    setError("");
    try {
      const flow = provider === "google" ? googleOAuth : facebookOAuth;
      const { createdSessionId, setActive } = await flow.startOAuthFlow();
      if (!createdSessionId || !setActive)
        return setError(
          `${labelFor(provider)} sign-in was canceled or could not be completed.`,
        );
      await setActive({ session: createdSessionId });
      router.replace("/");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : `${labelFor(provider)} sign-in could not be completed.`,
      );
    } finally {
      setOauthBusy(null);
    }
  };

  return (
    <MobilePage>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: Math.max(insets.top + 32, 54),
              paddingBottom: Math.max(insets.bottom + 140, 156),
            },
          ]}
        >
          <View style={styles.decorTop} />
          <AppLogo />
          <View style={styles.welcome}>
            <AppText weight="bold" style={styles.welcomeTitle}>
              Welcome back!
            </AppText>
            <AppText style={styles.subtitle}>Sign in to continue</AppText>
          </View>
          <View style={styles.form}>
            <FormField
              icon="mail-outline"
              placeholder="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <FormField
              icon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError("");
              }}
              secureTextEntry
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/forgot-password")}
              style={styles.forgot}
            >
              <AppText weight="medium" style={styles.forgotText}>
                Forgot Password?
              </AppText>
            </Pressable>
          </View>
          {error ? (
            <AppText accessibilityRole="alert" style={styles.error}>
              {error}
            </AppText>
          ) : null}
          <PrimaryButton
            title={fetchStatus === "fetching" ? "Signing in..." : "Log In"}
            disabled={busy}
            onPress={logIn}
            style={{ marginTop: 18 }}
          />
          <SocialAuthButtons
            busy={oauthBusy}
            disabled={busy}
            onSelect={continueWithOAuth}
          />
          <View style={styles.signupRow}>
            <AppText style={styles.signupText}>
              Don&apos;t have an account?{" "}
            </AppText>
            <Pressable onPress={() => router.push("/register")}>
              <AppText weight="semibold" style={styles.signupLink}>
                Sign Up
              </AppText>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </MobilePage>
  );
}

function SocialAuthButtons({
  busy,
  disabled,
  onSelect,
}: {
  busy: OAuthProvider | null;
  disabled: boolean;
  onSelect: (provider: OAuthProvider) => void;
}) {
  return (
    <View style={styles.socialBlock}>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <AppText style={styles.dividerText}>or</AppText>
        <View style={styles.divider} />
      </View>
      <SocialButton
        provider="google"
        title={
          busy === "google" ? "Connecting to Google..." : "Continue with Google"
        }
        disabled={disabled}
        onPress={() => onSelect("google")}
      />
      <SocialButton
        provider="facebook"
        title={
          busy === "facebook"
            ? "Connecting to Facebook..."
            : "Continue with Facebook"
        }
        disabled={disabled}
        onPress={() => onSelect("facebook")}
      />
    </View>
  );
}

function SocialButton({
  disabled,
  onPress,
  provider,
  title,
}: {
  disabled: boolean;
  onPress: () => void;
  provider: OAuthProvider;
  title: string;
}) {
  const color = provider === "google" ? "#db4437" : "#1877f2";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.socialButton,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Ionicons name={`logo-${provider}`} size={20} color={color} />
      <AppText weight="semibold" style={styles.socialText}>
        {title}
      </AppText>
    </Pressable>
  );
}

function labelFor(provider: OAuthProvider) {
  return provider === "google" ? "Google" : "Facebook";
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: contentPadding,
    justifyContent: "center",
    overflow: "hidden",
  },
  decorTop: {
    position: "absolute",
    width: 190,
    height: 90,
    borderWidth: 1,
    borderColor: "#ffe9ea",
    borderRadius: 100,
    right: -85,
    top: -45,
    transform: [{ rotate: "18deg" }],
  },
  welcome: { alignItems: "center", marginTop: 31, marginBottom: 18 },
  welcomeTitle: { fontSize: 18 },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
  form: { gap: 10 },
  forgot: { alignSelf: "flex-end" },
  forgotText: { color: colors.burgundy, fontSize: 10 },
  error: {
    color: colors.red,
    fontSize: 10,
    marginTop: 10,
    textAlign: "center",
  },
  socialBlock: { gap: 10, marginTop: 16 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontSize: 10 },
  socialButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  socialText: { fontSize: 13 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  signupRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  signupText: { fontSize: 10 },
  signupLink: { fontSize: 10, color: colors.red },
});
