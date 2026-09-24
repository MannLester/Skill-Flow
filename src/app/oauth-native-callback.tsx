import { useAuth } from '@clerk/expo';
import { useSignIn, useSignUp } from '@clerk/expo/legacy';
import { useLinkingURL } from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, MobilePage, PrimaryButton } from '@/components/ui';
import { authColors, colors, contentPadding } from '@/constants/theme';

const callbackWaitMs = 8000;

export default function OAuthNativeCallbackScreen() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoaded: isSignInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp } = useSignUp();
  const { rotating_token_nonce: nonceParam } = useLocalSearchParams<{ rotating_token_nonce?: string | string[] }>();
  const rawCallbackUrl = useLinkingURL();
  const nonce = (Array.isArray(nonceParam) ? nonceParam[0] : nonceParam) ?? tokenFromCallbackUrl(rawCallbackUrl);
  const attempted = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isSignedIn) {
      router.replace('/');
      return;
    }
    if (!isAuthLoaded || !isSignInLoaded || !isSignUpLoaded || attempted.current) return;
    const timer = setTimeout(() => {
      attempted.current = true;
      if (!nonce) {
        setError('Clerk returned without a sign-in token. Check the mobile redirect URL in your development Clerk instance.');
        return;
      }
      void finishSignIn(nonce, signIn, signUp, setActive).then(
        () => router.replace('/'),
        (reason: unknown) => {
          console.error('Google sign-in callback failed', reason);
          setError(reason instanceof Error ? reason.message : 'Google sign-in could not be completed.');
        },
      );
    }, callbackWaitMs);
    return () => clearTimeout(timer);
  }, [isAuthLoaded, isSignInLoaded, isSignUpLoaded, isSignedIn, nonce, setActive, signIn, signUp]);

  return <MobilePage backgroundColor={authColors.background}><View style={styles.center}>
    {error ? <>
      <AppText weight="semibold" style={styles.title}>Sign-in needs another try</AppText>
      <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText>
      <PrimaryButton title="Back to sign-in" onPress={() => router.replace('/')} />
    </> : <>
      <ActivityIndicator color={colors.red} size="large" />
      <AppText weight="semibold" style={styles.title}>Completing sign-in</AppText>
      <AppText style={styles.copy}>Securely returning you to SkillFlow…</AppText>
    </>}
  </View></MobilePage>;
}

function tokenFromCallbackUrl(url: string | null) {
  if (!url) return undefined;
  try {
    const callback = new URL(url);
    if (callback.protocol !== 'skillflow:' || callback.hostname !== 'oauth-native-callback') return undefined;
    return callback.searchParams.get('rotating_token_nonce') ?? undefined;
  } catch {
    return undefined;
  }
}

type ClerkSignIn = NonNullable<ReturnType<typeof useSignIn>['signIn']>;
type ClerkSignUp = NonNullable<ReturnType<typeof useSignUp>['signUp']>;
type ActivateSession = NonNullable<ReturnType<typeof useSignIn>['setActive']>;

async function finishSignIn(nonce: string, signIn: ClerkSignIn, signUp: ClerkSignUp, setActive: ActivateSession) {
  if (!signIn.createdSessionId) await signIn.reload({ rotatingTokenNonce: nonce });
  if (signIn.firstFactorVerification.status === 'transferable') await signUp.create({ transfer: true });
  const sessionId = signUp.createdSessionId ?? signIn.createdSessionId;
  if (!sessionId) throw new Error('Google did not complete sign-in. Please try again.');
  await setActive({ session: sessionId });
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: contentPadding, backgroundColor: authColors.background },
  title: { color: authColors.text, fontSize: 20, textAlign: 'center' },
  copy: { color: authColors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  error: { color: authColors.accent, fontSize: 16, lineHeight: 24, textAlign: 'center' },
});
