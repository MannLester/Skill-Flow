import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppLogo, AppText, FormField, MobilePage, PrimaryButton, RoleSelector } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';
import { UserRole, useSession } from '@/context/session';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { registerAccount } = useSession();
  const [role, setSelectedRole] = useState<UserRole>('student');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const update = (key: keyof typeof form) => (value: string) => { setError(''); setForm((current) => ({ ...current, [key]: value })); };
  const signUp = () => {
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.confirm) return setError('Complete all account fields.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('Enter a valid email address.');
    if (form.password.length < 6) return setError('Password must contain at least 6 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (!accepted) return setError('Accept the Terms and Privacy Policy to continue.');
    const result = registerAccount({ name: form.name, email: form.email, password: form.password, role });
    if (!result.ok) return setError(result.message);
    router.replace(role === 'student' ? '/student-home' : '/client-home');
  };

  return (
    <MobilePage>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top, height: 54 + insets.top }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.burgundy} /></Pressable>
          <AppText weight="semibold" style={styles.headerTitle}>Create Account</AppText><View style={{ width: 24 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 66, 86) }]}> 
          <AppLogo compact />
          <View style={{ marginTop: 22 }}><RoleSelector value={role} onChange={setSelectedRole} /></View>
          <View style={styles.form}>
            <FormField icon="person-outline" placeholder="Full Name" value={form.name} onChangeText={update('name')} />
            <FormField icon="mail-outline" placeholder="Email Address" value={form.email} onChangeText={update('email')} keyboardType="email-address" autoCapitalize="none" />
            <FormField icon="lock-closed-outline" placeholder="Password" value={form.password} onChangeText={update('password')} secureTextEntry />
            <FormField icon="lock-closed-outline" placeholder="Confirm Password" value={form.confirm} onChangeText={update('confirm')} secureTextEntry />
          </View>
          <View style={styles.terms}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} accessibilityLabel="Accept Terms and Privacy Policy" onPress={() => { setAccepted((value) => !value); setError(''); }}><View style={[styles.checkbox, accepted && styles.checkboxActive]}>{accepted ? <Ionicons name="checkmark" size={13} color={colors.white} /> : null}</View></Pressable>
            <View style={styles.termsCopy}><AppText style={styles.termsText}>I agree to the</AppText><Pressable onPress={() => router.push('/terms')}><AppText weight="medium" style={styles.termsLink}>Terms & Conditions</AppText></Pressable><AppText style={styles.termsText}>and</AppText><Pressable onPress={() => router.push('/privacy-policy')}><AppText weight="medium" style={styles.termsLink}>Privacy Policy</AppText></Pressable></View>
          </View>
          {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
          <PrimaryButton title="Sign Up" onPress={signUp} style={{ marginTop: 18 }} />
          <View style={styles.loginRow}><AppText style={{ fontSize: 10 }}>Already have an account? </AppText><Pressable onPress={() => router.back()}><AppText weight="semibold" style={styles.termsLink}>Log In</AppText></Pressable></View>
          <View style={styles.waveLight} /><View style={styles.waveRed} />
        </ScrollView>
      </KeyboardAvoidingView>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: contentPadding },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 15 },
  content: { flexGrow: 1, width: '100%', maxWidth: '100%', paddingHorizontal: contentPadding, paddingTop: 12, overflow: 'hidden' },
  form: { gap: 11, marginTop: 16 },
  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16 }, termsCopy: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 3 },
  checkbox: { width: 16, height: 16, borderWidth: 1.5, borderColor: '#c87379', borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.red, borderColor: colors.red }, termsText: { fontSize: 9, lineHeight: 14 }, termsLink: { color: colors.red, fontSize: 9 }, error: { color: colors.red, fontSize: 10, textAlign: 'center', marginTop: 10 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 15 },
  waveLight: { position: 'absolute', bottom: -60, left: -40, width: '85%', height: 90, borderRadius: 90, backgroundColor: '#ffdfe2', transform: [{ rotate: '8deg' }] },
  waveRed: { position: 'absolute', bottom: -76, right: -40, width: '120%', height: 110, borderRadius: 100, backgroundColor: colors.red, transform: [{ rotate: '-7deg' }] },
});
