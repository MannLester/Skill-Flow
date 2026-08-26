import { useSignUp } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo, AppText, FormField, MobilePage, PrimaryButton, RoleSelector } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';
import type { UserRole } from '@/context/session';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { signUp, fetchStatus } = useSignUp();
  const [role, setRole] = useState<UserRole>('student');
  const [accepted, setAccepted] = useState(false);
  const [verification, setVerification] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const update = (key: keyof typeof form) => (value: string) => { setError(''); setForm((current) => ({ ...current, [key]: value })); };
  const start = async () => {
    const issue = validate(form, accepted); if (issue) return setError(issue);
    setError('');
    const created = await signUp.create({ emailAddress: form.email.trim().toLowerCase(), password: form.password, legalAccepted: true, unsafeMetadata: { skillflowName: form.name.trim(), skillflowRole: role } });
    if (created.error) return setError(created.error.message || 'Account creation could not be started.');
    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) return setError(sent.error.message || 'The verification code could not be sent.');
    setVerification(true);
  };
  const verify = async () => {
    if (!code.trim()) return setError('Enter the verification code from your email.');
    setError('');
    const checked = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (checked.error) return setError(checked.error.message || 'The verification code is invalid or expired.');
    if (signUp.status !== 'complete') return setError('Complete the remaining Clerk verification requirements before continuing.');
    const finalized = await signUp.finalize();
    if (finalized.error) return setError(finalized.error.message || 'Account activation could not be completed.');
    router.replace('/');
  };
  return <MobilePage><StatusBar style="dark" /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.header, { paddingTop: insets.top, height: 54 + insets.top }]}><Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.burgundy} /></Pressable><AppText weight="semibold" style={styles.headerTitle}>{verification ? 'Verify Email' : 'Create Account'}</AppText><View style={{ width: 24 }} /></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 66, 86) }]}><AppLogo compact />{verification ? <VerificationForm email={form.email} code={code} setCode={(value) => { setCode(value); setError(''); }} onVerify={verify} busy={fetchStatus === 'fetching'} /> : <><View style={{ marginTop: 22 }}><RoleSelector value={role} onChange={setRole} /></View><View style={styles.form}><FormField icon="person-outline" placeholder="Full Name" value={form.name} onChangeText={update('name')} /><FormField icon="mail-outline" placeholder="Email Address" value={form.email} onChangeText={update('email')} keyboardType="email-address" autoCapitalize="none" /><FormField icon="lock-closed-outline" placeholder="Password" value={form.password} onChangeText={update('password')} secureTextEntry /><FormField icon="lock-closed-outline" placeholder="Confirm Password" value={form.confirm} onChangeText={update('confirm')} secureTextEntry /></View><Terms accepted={accepted} toggle={() => { setAccepted((value) => !value); setError(''); }} /><PrimaryButton title={fetchStatus === 'fetching' ? 'Creating account…' : 'Sign Up'} disabled={fetchStatus === 'fetching'} onPress={start} style={{ marginTop: 18 }} /></>}{error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}</ScrollView></KeyboardAvoidingView></MobilePage>;
}

function VerificationForm({ email, code, setCode, onVerify, busy }: { email: string; code: string; setCode: (value: string) => void; onVerify: () => void; busy: boolean }) { return <View style={styles.verify}><AppText style={styles.verifyCopy}>Enter the email verification code sent to {email}.</AppText><FormField icon="key-outline" placeholder="Verification Code" value={code} onChangeText={setCode} keyboardType="number-pad" /><PrimaryButton title={busy ? 'Verifying…' : 'Verify and Continue'} disabled={busy} onPress={onVerify} /></View>; }
function Terms({ accepted, toggle }: { accepted: boolean; toggle: () => void }) { return <View style={styles.terms}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} accessibilityLabel="Accept Terms and Privacy Policy" onPress={toggle}><View style={[styles.checkbox, accepted && styles.checkboxActive]}>{accepted ? <Ionicons name="checkmark" size={13} color={colors.white} /> : null}</View></Pressable><View style={styles.termsCopy}><AppText style={styles.termsText}>I agree to the</AppText><Pressable onPress={() => router.push('/terms')}><AppText style={styles.termsLink}>Terms & Conditions</AppText></Pressable><AppText style={styles.termsText}>and</AppText><Pressable onPress={() => router.push('/privacy-policy')}><AppText style={styles.termsLink}>Privacy Policy</AppText></Pressable></View></View>; }
function validate(form: { name: string; email: string; password: string; confirm: string }, accepted: boolean) { if (!form.name.trim() || !form.email.trim() || !form.password || !form.confirm) return 'Complete all account fields.'; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email address.'; if (form.password.length < 8) return 'Password must contain at least 8 characters.'; if (form.password !== form.confirm) return 'Passwords do not match.'; if (!accepted) return 'Accept the Terms and Privacy Policy to continue.'; return ''; }
const styles = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: contentPadding }, headerTitle: { flex: 1, textAlign: 'center', fontSize: 15 }, content: { flexGrow: 1, paddingHorizontal: contentPadding, paddingTop: 12 }, form: { gap: 11, marginTop: 16 }, verify: { gap: 16, marginTop: 30 }, verifyCopy: { color: colors.muted, textAlign: 'center', fontSize: 11 }, terms: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16 }, termsCopy: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 3 }, checkbox: { width: 16, height: 16, borderWidth: 1.5, borderColor: '#c87379', borderRadius: 3, alignItems: 'center', justifyContent: 'center' }, checkboxActive: { backgroundColor: colors.red, borderColor: colors.red }, termsText: { fontSize: 9 }, termsLink: { color: colors.red, fontSize: 9 }, error: { color: colors.red, fontSize: 10, textAlign: 'center', marginTop: 12 } });
