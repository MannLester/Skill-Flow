import { useSignIn } from '@clerk/expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';

type Step = 'email' | 'code' | 'password';
const recoveryCopy: Record<Step, string> = { email: 'Enter your account email. The response remains account-neutral.', code: 'Enter the email code from Clerk.', password: 'Choose a new password.' };
const recoveryButton: Record<Step, string> = { email: 'Send Recovery Code', code: 'Verify Code', password: 'Set New Password' };

export default function ForgotPasswordScreen() {
  const { signIn, fetchStatus } = useSignIn();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState('');
  const begin = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.');
    setError(''); const started = await signIn.create({ identifier: email.trim().toLowerCase() });
    if (started.error) return setError('If the account can be recovered, Clerk will allow the next step. Please try again later.');
    const sent = await signIn.resetPasswordEmailCode.sendCode();
    if (sent.error) return setError('Recovery instructions could not be sent. Please wait and try again.');
    setStep('code');
  };
  const verify = async () => { if (!code.trim()) return setError('Enter the recovery code.'); setError(''); const result = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() }); if (result.error) return setError(result.error.message || 'The code is invalid or expired.'); setStep('password'); };
  const finish = async () => { if (password.length < 8) return setError('Password must contain at least 8 characters.'); if (password !== confirm) return setError('Passwords do not match.'); setError(''); const result = await signIn.resetPasswordEmailCode.submitPassword({ password, signOutOfOtherSessions: true }); if (result.error) return setError(result.error.message || 'The password could not be updated.'); if (signIn.status !== 'complete') return setError('An additional authentication step is required.'); const final = await signIn.finalize(); if (final.error) return setError(final.error.message || 'The recovered session could not be activated.'); router.replace('/'); };
  const submit = { email: begin, code: verify, password: finish }[step];
  return <MobilePage><StatusBar style="light" /><AppHeader title="Reset Password" onBack={() => router.back()} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><AppText style={styles.copy}>{recoveryCopy[step]}</AppText><RecoveryFields step={step} values={{ email, code, password, confirm }} setters={{ setEmail, setCode, setPassword, setConfirm }} clearError={() => setError('')} />{error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}<PrimaryButton title={fetchStatus === 'fetching' ? 'Please wait…' : recoveryButton[step]} disabled={fetchStatus === 'fetching'} onPress={submit} /></ScrollView></KeyboardAvoidingView></MobilePage>;
}

type RecoveryFieldsProps = { step: Step; values: { email: string; code: string; password: string; confirm: string }; setters: { setEmail: (value: string) => void; setCode: (value: string) => void; setPassword: (value: string) => void; setConfirm: (value: string) => void }; clearError: () => void };
function RecoveryFields({ step, values, setters, clearError }: RecoveryFieldsProps) {
  if (step === 'email') return <FormField icon="mail-outline" placeholder="Email Address" value={values.email} onChangeText={(value) => { setters.setEmail(value); clearError(); }} keyboardType="email-address" autoCapitalize="none" />;
  if (step === 'code') return <FormField icon="key-outline" placeholder="Recovery Code" value={values.code} onChangeText={(value) => { setters.setCode(value); clearError(); }} keyboardType="number-pad" />;
  return <><FormField icon="lock-closed-outline" placeholder="New Password" value={values.password} onChangeText={(value) => { setters.setPassword(value); clearError(); }} secureTextEntry /><FormField icon="checkmark-circle-outline" placeholder="Confirm Password" value={values.confirm} onChangeText={(value) => { setters.setConfirm(value); clearError(); }} secureTextEntry /></>;
}

const styles = StyleSheet.create({ content: { flexGrow: 1, justifyContent: 'center', gap: 14, paddingHorizontal: contentPadding, paddingBottom: 40 }, copy: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 8 }, error: { color: colors.red, fontSize: 10, textAlign: 'center' } });
