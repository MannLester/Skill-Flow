import { useSignIn } from '@clerk/expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo, AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, fetchStatus } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const logIn = async () => {
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setError('');
    const result = await signIn.password({ emailAddress: email.trim().toLowerCase(), password });
    if (result.error) return setError(result.error.message || 'Email or password is incorrect.');
    if (signIn.status !== 'complete') return setError('This account requires an additional authentication step that is not enabled in this demonstration.');
    const finalized = await signIn.finalize();
    if (finalized.error) return setError(finalized.error.message || 'Sign-in could not be completed.');
    router.replace('/');
  };

  return <MobilePage><StatusBar style="dark" /><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 32, 54), paddingBottom: Math.max(insets.bottom + 72, 90) }]}><View style={styles.decorTop} /><AppLogo /><View style={styles.welcome}><AppText weight="bold" style={styles.welcomeTitle}>Welcome back!</AppText><AppText style={styles.subtitle}>Sign in to continue</AppText></View><View style={styles.form}><FormField icon="mail-outline" placeholder="Email" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} keyboardType="email-address" autoCapitalize="none" /><FormField icon="lock-closed-outline" placeholder="Password" value={password} onChangeText={(value) => { setPassword(value); setError(''); }} secureTextEntry /><Pressable accessibilityRole="button" onPress={() => router.push('/forgot-password')} style={styles.forgot}><AppText weight="medium" style={styles.forgotText}>Forgot Password?</AppText></Pressable></View>{error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}<PrimaryButton title={fetchStatus === 'fetching' ? 'Signing in…' : 'Log In'} disabled={fetchStatus === 'fetching'} onPress={logIn} style={{ marginTop: 18 }} /><AppText style={styles.roleNote}>Your Student Designer or Client role is loaded securely after sign-in.</AppText><View style={styles.signupRow}><AppText style={styles.signupText}>Don&apos;t have an account? </AppText><Pressable onPress={() => router.push('/register')}><AppText weight="semibold" style={styles.signupLink}>Sign Up</AppText></Pressable></View><View style={styles.waveLight} /><View style={styles.waveRed} /></ScrollView></KeyboardAvoidingView></MobilePage>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: contentPadding, justifyContent: 'center', overflow: 'hidden' }, decorTop: { position: 'absolute', width: 190, height: 90, borderWidth: 1, borderColor: '#ffe9ea', borderRadius: 100, right: -85, top: -45, transform: [{ rotate: '18deg' }] }, welcome: { alignItems: 'center', marginTop: 40, marginBottom: 18 }, welcomeTitle: { fontSize: 18 }, subtitle: { color: colors.muted, fontSize: 11, marginTop: 2 }, form: { gap: 10 }, forgot: { alignSelf: 'flex-end' }, forgotText: { color: colors.burgundy, fontSize: 10 }, error: { color: colors.red, fontSize: 10, marginTop: 10, textAlign: 'center' }, roleNote: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 12 }, signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 }, signupText: { fontSize: 10 }, signupLink: { fontSize: 10, color: colors.red }, waveLight: { position: 'absolute', bottom: -58, left: -45, width: '90%', height: 100, borderRadius: 100, backgroundColor: '#ffdfe2', transform: [{ rotate: '8deg' }] }, waveRed: { position: 'absolute', bottom: -76, right: -45, width: '115%', height: 120, borderRadius: 100, backgroundColor: colors.red, transform: [{ rotate: '-7deg' }] } });
