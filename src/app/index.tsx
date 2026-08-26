import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo, AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';
import { UserRole, useSession } from '@/context/session';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, loginAsRole } = useSession();
  const [role, setSelectedRole] = useState<UserRole>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const logIn = () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    const result = login(email, password, role);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace(role === 'student' ? '/student-home' : '/client-home');
  };

  const continueAsDemoAccount = (demoRole: UserRole) => {
    setSelectedRole(demoRole);
    loginAsRole(demoRole);
    router.replace(demoRole === 'student' ? '/student-home' : '/client-home');
  };

  return (
    <MobilePage>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 32, 54), paddingBottom: Math.max(insets.bottom + 72, 90) }]}
        >
          <View style={styles.decorTop} />
          <AppLogo />
          <View style={styles.welcome}>
            <AppText weight="bold" style={styles.welcomeTitle}>Welcome back!</AppText>
            <AppText style={styles.subtitle}>Login to continue</AppText>
          </View>
          <View style={styles.form}>
            <FormField icon="mail-outline" placeholder="Email" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} keyboardType="email-address" autoCapitalize="none" />
            <FormField icon="lock-closed-outline" placeholder="Password" value={password} onChangeText={(value) => { setPassword(value); setError(''); }} secureTextEntry />
            <Pressable accessibilityRole="button" onPress={() => router.push('/forgot-password')} style={styles.forgot}><AppText weight="medium" style={styles.forgotText}>Forgot Password?</AppText></Pressable>
          </View>
          <AppText weight="medium" style={styles.loginAs}>Login as:</AppText>
          <View style={styles.roleCards}>
            <RoleCard active={role === 'student'} icon="school" title="Student Designer" detail="I want to offer my skills and find projects." onPress={() => setSelectedRole('student')} />
            <RoleCard active={role === 'client'} icon="people" title="Client" detail="I want to hire student designers." onPress={() => setSelectedRole('client')} />
          </View>
          {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
          <PrimaryButton title="Log In" onPress={logIn} style={{ marginTop: 15 }} />
          <View style={styles.demoSection}>
            <AppText weight="medium" style={styles.demoTitle}>Quick demo access</AppText>
            <View style={styles.demoRow}>
              <Pressable accessibilityRole="button" onPress={() => continueAsDemoAccount('student')} style={styles.demoButton}><Ionicons name="school-outline" size={17} color={colors.burgundy} /><AppText weight="medium" style={styles.demoButtonText}>Continue as Alex</AppText></Pressable>
              <Pressable accessibilityRole="button" onPress={() => continueAsDemoAccount('client')} style={styles.demoButton}><Ionicons name="people-outline" size={17} color={colors.burgundy} /><AppText weight="medium" style={styles.demoButtonText}>Continue as Mark</AppText></Pressable>
            </View>
          </View>
          <View style={styles.signupRow}>
            <AppText style={styles.signupText}>Don&apos;t have an account? </AppText>
            <Pressable onPress={() => router.push('/register')}><AppText weight="semibold" style={styles.signupLink}>Sign Up</AppText></Pressable>
          </View>
          <View style={styles.waveLight} /><View style={styles.waveRed} />
        </ScrollView>
      </KeyboardAvoidingView>
    </MobilePage>
  );
}

function RoleCard({ active, icon, title, detail, onPress }: { active: boolean; icon: 'school' | 'people'; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.roleCard, active && styles.roleCardActive]}>
      <View style={styles.roleIcon}><Ionicons name={icon} size={25} color={colors.red} /></View>
      <View style={{ flex: 1 }}><AppText weight="semibold" style={{ fontSize: 12 }}>{title}</AppText><AppText style={styles.roleDetail}>{detail}</AppText></View>
      <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: '100%', paddingHorizontal: contentPadding, justifyContent: 'center', overflow: 'hidden' },
  decorTop: { position: 'absolute', width: 190, height: 90, borderWidth: 1, borderColor: '#ffe9ea', borderRadius: 100, right: -85, top: -45, transform: [{ rotate: '18deg' }] },
  welcome: { alignItems: 'center', marginTop: 31, marginBottom: 18 },
  welcomeTitle: { fontSize: 18 }, subtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
  form: { gap: 10 }, forgot: { alignSelf: 'flex-end', marginTop: -2 }, forgotText: { color: colors.burgundy, fontSize: 10 },
  loginAs: { fontSize: 11, marginTop: 8, marginBottom: 8 }, roleCards: { gap: 9 },
  roleCard: { minHeight: 66, borderWidth: 1, borderColor: colors.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10, backgroundColor: colors.white },
  roleCardActive: { borderColor: '#dca2a7', backgroundColor: colors.blush },
  roleIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fee9eb', alignItems: 'center', justifyContent: 'center' },
  roleDetail: { fontSize: 9, color: colors.muted, lineHeight: 13, marginTop: 2 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#aaa', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.red }, radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 13 }, signupText: { fontSize: 10 }, signupLink: { fontSize: 10, color: colors.red },
  error: { color: colors.red, fontSize: 10, marginTop: 8, textAlign: 'center' }, demoSection: { marginTop: 13 }, demoTitle: { color: colors.muted, fontSize: 10, textAlign: 'center', marginBottom: 7 }, demoRow: { flexDirection: 'row', gap: 8 }, demoButton: { flex: 1, minHeight: 40, borderWidth: 1, borderColor: '#e3a9ae', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.blush }, demoButtonText: { color: colors.burgundy, fontSize: 9 },
  waveLight: { position: 'absolute', bottom: -58, left: -45, width: '90%', height: 100, borderRadius: 100, backgroundColor: '#ffdfe2', transform: [{ rotate: '8deg' }] },
  waveRed: { position: 'absolute', bottom: -76, right: -45, width: '115%', height: 120, borderRadius: 100, backgroundColor: colors.red, transform: [{ rotate: '-7deg' }] },
});
