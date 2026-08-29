import { useOAuth, useSignUp } from "@clerk/expo";
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
  BottomWaveDecor,
  FormField,
  MobilePage,
  PrimaryButton,
  RoleSelector,
} from "@/components/ui";
import { colors, contentPadding } from "@/constants/theme";
import type { UserRole } from "@/context/session";

WebBrowser.maybeCompleteAuthSession();

type OAuthProvider = "google" | "facebook";

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { signUp, fetchStatus } = useSignUp();
  const googleOAuth = useOAuth({ strategy: "oauth_google" });
  const facebookOAuth = useOAuth({ strategy: "oauth_facebook" });
  const [role, setRole] = useState<UserRole>("student");
  const [accepted, setAccepted] = useState(false);
  const [verification, setVerification] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const busy = fetchStatus === "fetching" || oauthBusy !== null;
  const update = (key: keyof typeof form) => (value: string) => {
    setError("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const start = async () => {
    const issue = validate(form, accepted);
    if (issue) return setError(issue);
    setError("");
    const created = await signUp.create({
      emailAddress: form.email.trim().toLowerCase(),
      password: form.password,
      legalAccepted: true,
      unsafeMetadata: accountMetadata(form.name, role),
    });
    if (created.error)
      return setError(
        created.error.message || "Account creation could not be started.",
      );
    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error)
      return setError(
        sent.error.message || "The verification code could not be sent.",
      );
    setVerification(true);
  };

  const verify = async () => {
    if (!code.trim())
      return setError("Enter the verification code from your email.");
    setError("");
    const checked = await signUp.verifications.verifyEmailCode({
      code: code.trim(),
    });
    if (checked.error)
      return setError(
        checked.error.message || "The verification code is invalid or expired.",
      );
    if (signUp.status !== "complete")
      return setError(
        "Complete the remaining Clerk verification requirements before continuing.",
      );
    const finalized = await signUp.finalize();
    if (finalized.error)
      return setError(
        finalized.error.message || "Account activation could not be completed.",
      );
    router.replace("/");
  };

  const continueWithOAuth = async (provider: OAuthProvider) => {
    if (!accepted)
      return setError("Accept the Terms and Privacy Policy to continue.");
    setOauthBusy(provider);
    setError("");
    try {
      const flow = provider === "google" ? googleOAuth : facebookOAuth;
      const { createdSessionId, setActive } = await flow.startOAuthFlow({
        unsafeMetadata: accountMetadata(form.name, role),
      });
      if (!createdSessionId || !setActive)
        return setError(
          `${labelFor(provider)} sign-up was canceled or could not be completed.`,
        );
      await setActive({ session: createdSessionId });
      router.replace("/");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : `${labelFor(provider)} sign-up could not be completed.`,
      );
    } finally {
      setOauthBusy(null);
    }
  };

  return (
    <MobilePage>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.header,
            { paddingTop: insets.top, height: 54 + insets.top },
          ]}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.burgundy} />
          </Pressable>
          <AppText weight="semibold" style={styles.headerTitle}>
            {verification ? "Verify Email" : "Create Account"}
          </AppText>
          <View style={{ width: 24 }} />
        </View>
        <View
          style={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 20, 40) },
          ]}
        >
          <BottomWaveDecor />
          <AppLogo compact />
          {verification ? (
            <VerificationForm
              email={form.email}
              code={code}
              setCode={(value) => {
                setCode(value);
                setError("");
              }}
              onVerify={verify}
              busy={busy}
            />
          ) : (
            <>
              <View style={{ marginTop: 22 }}>
                <RoleSelector value={role} onChange={setRole} />
              </View>
              <View style={styles.form}>
                <FormField
                  icon="person-outline"
                  placeholder="Full Name"
                  value={form.name}
                  onChangeText={update("name")}
                />
                <FormField
                  icon="mail-outline"
                  placeholder="Email Address"
                  value={form.email}
                  onChangeText={update("email")}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <FormField
                  icon="lock-closed-outline"
                  placeholder="Password"
                  value={form.password}
                  onChangeText={update("password")}
                  secureTextEntry
                />
                <FormField
                  icon="lock-closed-outline"
                  placeholder="Confirm Password"
                  value={form.confirm}
                  onChangeText={update("confirm")}
                  secureTextEntry
                />
              </View>
              <Terms
                accepted={accepted}
                toggle={() => {
                  setAccepted((value) => !value);
                  setError("");
                }}
              />
              <PrimaryButton
                title={
                  fetchStatus === "fetching" ? "Creating account..." : "Sign Up"
                }
                disabled={busy}
                onPress={start}
                style={{ marginTop: 18 }}
              />
              <SocialAuthButtons
                busy={oauthBusy}
                disabled={busy}
                onSelect={continueWithOAuth}
              />
            </>
          )}
          {error ? (
            <AppText accessibilityRole="alert" style={styles.error}>
              {error}
            </AppText>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </MobilePage>
  );
}

function VerificationForm({
  email,
  code,
  setCode,
  onVerify,
  busy,
}: {
  email: string;
  code: string;
  setCode: (value: string) => void;
  onVerify: () => void;
  busy: boolean;
}) {
  return (
    <View style={styles.verify}>
      <AppText style={styles.verifyCopy}>
        Enter the email verification code sent to {email}.
      </AppText>
      <FormField
        icon="key-outline"
        placeholder="Verification Code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
      />
      <PrimaryButton
        title={busy ? "Verifying..." : "Verify and Continue"}
        disabled={busy}
        onPress={onVerify}
      />
    </View>
  );
}
function Terms({
  accepted,
  toggle,
}: {
  accepted: boolean;
  toggle: () => void;
}) {
  return (
    <View style={styles.terms}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        accessibilityLabel="Accept Terms and Privacy Policy"
        onPress={toggle}
      >
        <View style={[styles.checkbox, accepted && styles.checkboxActive]}>
          {accepted ? (
            <Ionicons name="checkmark" size={13} color={colors.white} />
          ) : null}
        </View>
      </Pressable>
      <View style={styles.termsCopy}>
        <AppText style={styles.termsText}>I agree to the</AppText>
        <Pressable onPress={() => router.push("/terms")}>
          <AppText style={styles.termsLink}>Terms & Conditions</AppText>
        </Pressable>
        <AppText style={styles.termsText}>and</AppText>
        <Pressable onPress={() => router.push("/privacy-policy")}>
          <AppText style={styles.termsLink}>Privacy Policy</AppText>
        </Pressable>
      </View>
    </View>
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

function validate(
  form: { name: string; email: string; password: string; confirm: string },
  accepted: boolean,
) {
  if (
    !form.name.trim() ||
    !form.email.trim() ||
    !form.password ||
    !form.confirm
  )
    return "Complete all account fields.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    return "Enter a valid email address.";
  if (form.password.length < 8)
    return "Password must contain at least 8 characters.";
  if (form.password !== form.confirm) return "Passwords do not match.";
  if (!accepted) return "Accept the Terms and Privacy Policy to continue.";
  return "";
}
function accountMetadata(name: string, role: UserRole) {
  return { skillflowName: name.trim() || undefined, skillflowRole: role };
}
function labelFor(provider: OAuthProvider) {
  return provider === "google" ? "Google" : "Facebook";
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: contentPadding,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 15 },
  content: { flexGrow: 1, paddingHorizontal: contentPadding, paddingTop: 12, paddingBottom: 40, justifyContent: "center", overflow: "hidden" },
  form: { gap: 11, marginTop: 16 },
  verify: { gap: 16, marginTop: 30 },
  verifyCopy: { color: colors.muted, textAlign: "center", fontSize: 11 },
  terms: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 16,
  },
  termsCopy: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 3 },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: "#c87379",
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.red, borderColor: colors.red },
  termsText: { fontSize: 9 },
  termsLink: { color: colors.red, fontSize: 9 },
  error: {
    color: colors.red,
    fontSize: 10,
    textAlign: "center",
    marginTop: 12,
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
});
