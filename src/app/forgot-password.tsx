import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setSubmitted(true);
  };

  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Reset Password" onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {submitted ? (
          <View style={styles.content}>
            <View style={styles.icon}><Ionicons name="mail-open-outline" size={42} color={colors.red} /></View>
            <AppText weight="bold" style={styles.title}>Recovery simulated</AppText>
            <AppText style={styles.copy}>A demonstration recovery message was generated for {email.trim()}. No email was sent and no external service was contacted.</AppText>
            <PrimaryButton title="Return to Log In" onPress={() => router.replace('/')} style={styles.button} />
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.icon}><Ionicons name="lock-open-outline" size={42} color={colors.red} /></View>
            <AppText weight="bold" style={styles.title}>Forgot your password?</AppText>
            <AppText style={styles.copy}>Enter your account email to demonstrate the password-recovery flow.</AppText>
            <FormField icon="mail-outline" placeholder="Email Address" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} keyboardType="email-address" autoCapitalize="none" style={styles.field} />
            {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
            <PrimaryButton title="Send Recovery Instructions" onPress={submit} style={styles.button} />
            <AppText style={styles.note}>Demo only — this screen never sends email or changes an external account.</AppText>
          </View>
        )}
      </KeyboardAvoidingView>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 }, content: { flex: 1, padding: contentPadding, justifyContent: 'center', alignItems: 'center' }, icon: { width: 86, height: 86, borderRadius: 43, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 23, textAlign: 'center', marginTop: 22 }, copy: { color: colors.muted, fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 9 }, field: { width: '100%', marginTop: 28 }, button: { width: '100%', marginTop: 18 }, error: { color: colors.red, fontSize: 11, marginTop: 9 }, note: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 13 },
});
