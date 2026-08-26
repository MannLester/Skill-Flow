import { useUser } from '@clerk/expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';

export default function ChangePasswordScreen() {
  const { user } = useUser();
  const [current, setCurrent] = useState(''); const [next, setNext] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!user) return setError('Your Clerk session is no longer available.');
    if (next !== confirm) return setError('Passwords do not match.');
    if (next.length < 8) return setError('Password must contain at least 8 characters.');
    setBusy(true); setError('');
    try { await user.updatePassword({ currentPassword: current, newPassword: next, signOutOfOtherSessions: true }); Alert.alert('Password updated', 'Your Clerk password has been changed and other sessions were signed out.'); router.back(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The password could not be updated.'); }
    finally { setBusy(false); }
  };
  return <MobilePage><StatusBar style="light" /><AppHeader title="Change Password" onBack={() => router.back()} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content}><AppText style={styles.note}>Clerk securely manages your password. SkillFlow never stores it locally.</AppText><FormField icon="lock-closed-outline" value={current} onChangeText={(value) => { setCurrent(value); setError(''); }} placeholder="Current password" secureTextEntry /><FormField icon="key-outline" value={next} onChangeText={(value) => { setNext(value); setError(''); }} placeholder="New password" secureTextEntry /><FormField icon="checkmark-circle-outline" value={confirm} onChangeText={(value) => { setConfirm(value); setError(''); }} placeholder="Confirm new password" secureTextEntry />{error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}<PrimaryButton title={busy ? 'Updating…' : 'Update Password'} disabled={busy} onPress={save} /></ScrollView></KeyboardAvoidingView></MobilePage>;
}
const styles = StyleSheet.create({ content: { flexGrow: 1, gap: 12, padding: contentPadding, justifyContent: 'center' }, note: { color: colors.muted, fontSize: 11, textAlign: 'center', marginBottom: 8 }, error: { color: colors.red, fontSize: 10, textAlign: 'center' } });
