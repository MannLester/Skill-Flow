import { ClerkLoaded, ClerkLoading, ClerkProvider, useAuth, useUser } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { router, Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import { memo, PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { api } from '../../convex/_generated/api';
import { AppText, FormField, MobilePage, PrimaryButton, RoleSelector } from '@/components/ui';
import { readRuntimeConfiguration, RuntimeConfiguration } from '@/config/runtime';
import { colors, contentPadding, MAX_PHONE_WIDTH } from '@/constants/theme';
import { SessionProvider, useSession } from '@/context/session.remote';
import type { UserRole } from '@/context/session';
import { primaryNavActiveForPath, PrimaryBottomNav } from '@/navigation/primary-navigation';
import { blurActiveWebElement } from '@/utils/web-focus';

const publicPaths = new Set(['/', '/register', '/forgot-password', '/terms', '/privacy-policy']);
const legacyDemoStorageKeys = ['skillflow.demo-state', 'skillflow.demo-state.v1'];

export function AppProviders({ children }: PropsWithChildren) {
  const result = readRuntimeConfiguration();
  if (!result.ready) return <SetupState issues={result.issues} />;
  return <ConfiguredProviders configuration={result.configuration}>{children}</ConfiguredProviders>;
}

function ConfiguredProviders({ children, configuration }: PropsWithChildren<{ configuration: RuntimeConfiguration }>) {
  const convex = useMemo(() => new ConvexReactClient(configuration.convexUrl, { unsavedChangesWarning: false }), [configuration.convexUrl]);
  return (
    <ClerkProvider publishableKey={configuration.clerkPublishableKey} tokenCache={tokenCache} __experimental_disableNativeClientSync>
      <ClerkLoading><LoadingState message="Restoring your secure session…" /></ClerkLoading>
      <ClerkLoaded>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <SessionProvider><AuthProfileGate>{children}</AuthProfileGate></SessionProvider>
        </ConvexProviderWithClerk>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

function AuthProfileGate({ children }: PropsWithChildren) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useQuery(api.profiles.current, isAuthenticated ? {} : 'skip');
  const pathname = usePathname();
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !publicPaths.has(pathname)) router.replace('/');
    if (isAuthenticated && profile && publicPaths.has(pathname)) router.replace(profile.role === 'student' ? '/student-home' : '/client-home');
  }, [isAuthenticated, isLoading, pathname, profile]);
  useEffect(() => {
    if (isAuthenticated && profile) void AsyncStorage.multiRemove(legacyDemoStorageKeys);
  }, [isAuthenticated, profile]);
  if (isLoading || (isAuthenticated && profile === undefined)) return <LoadingState message="Connecting securely to SkillFlow…" />;
  if (isAuthenticated && profile === null) return <ProfileOnboarding />;
  if (!isAuthenticated) return children;
  return <AuthenticatedNavigationShell>{children}</AuthenticatedNavigationShell>;
}

function AuthenticatedNavigationShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { saved } = useGlobalSearchParams<{ saved?: string | string[] }>();
  const { currentAccount, messages, role } = useSession();
  const messageUnread = Boolean(currentAccount && messages.some((message) => message.senderId !== currentAccount.id && !message.readBy.includes(currentAccount.id)));
  const active = currentAccount ? primaryNavActiveForPath(pathname, role, saved) : null;
  return <View style={styles.shell}>
    <View style={styles.stack}>{children}</View>
    {active === null ? null : <View style={styles.navOuter}><View style={styles.navPhone}><PrimaryBottomNav active={active} role={role} messageUnread={messageUnread} /></View></View>}
  </View>;
}

function ProfileOnboarding() {
  const { user } = useUser();
  const complete = useMutation(api.profiles.completeOnboarding);
  const metadata = user?.unsafeMetadata as { skillflowName?: string; skillflowRole?: UserRole } | undefined;
  const [name, setName] = useState(metadata?.skillflowName ?? user?.fullName ?? '');
  const [role, setRole] = useState<UserRole>(metadata?.skillflowRole === 'client' ? 'client' : 'student');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const finish = async () => {
    if (!name.trim()) return setError('Enter the name you want shown in SkillFlow.');
    setSubmitting(true); setError('');
    try { await complete({ name, role }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Profile setup could not be completed.'); }
    finally { setSubmitting(false); }
  };
  return <MobilePage><View style={styles.onboarding}><AppText weight="bold" style={styles.title}>Finish account setup</AppText><AppText style={styles.copy}>Choose your permanent SkillFlow role. This controls server-side access and cannot be switched from the login screen.</AppText><FormField icon="person-outline" placeholder="Display name" value={name} onChangeText={(value) => { setName(value); setError(''); }} /><RoleSelector value={role} onChange={setRole} />{error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}<PrimaryButton title={submitting ? 'Creating profile…' : 'Continue'} onPress={finish} disabled={submitting} /></View></MobilePage>;
}

function LoadingState({ message }: { message: string }) {
  return <MobilePage><View style={styles.center}><ActivityIndicator color={colors.red} size="large" /><AppText style={styles.copy}>{message}</AppText></View></MobilePage>;
}

function SetupState({ issues }: { issues: string[] }) {
  return <MobilePage><View style={styles.center}><AppText weight="bold" style={styles.title}>Connected services need attention</AppText>{issues.map((issue) => <AppText key={issue} style={styles.copy}>• {issue}</AppText>)}</View></MobilePage>;
}

const stackListeners = { transitionStart: blurActiveWebElement };
const stackOptions = { headerShown: false, animation: 'slide_from_right' as const, freezeOnBlur: true };
const primaryScreenOptions = { animation: 'none' as const };

export const AppStack = memo(function AppStack() {
  return <Stack screenListeners={stackListeners} screenOptions={stackOptions}>
    <Stack.Screen name="student-home" options={primaryScreenOptions} />
    <Stack.Screen name="client-home" options={primaryScreenOptions} />
    <Stack.Screen name="projects/index" options={primaryScreenOptions} />
    <Stack.Screen name="portfolio/index" options={primaryScreenOptions} />
    <Stack.Screen name="messages/index" options={primaryScreenOptions} />
    <Stack.Screen name="profile/index" options={primaryScreenOptions} />
    <Stack.Screen name="marketplace" options={primaryScreenOptions} />
  </Stack>;
});

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: contentPadding },
  onboarding: { flex: 1, justifyContent: 'center', gap: 16, paddingHorizontal: contentPadding },
  title: { fontSize: 20, textAlign: 'center' }, copy: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' }, error: { color: colors.red, fontSize: 11, textAlign: 'center' },
  shell: { flex: 1 }, stack: { flex: 1, overflow: 'hidden' },   navOuter: { alignItems: 'center', backgroundColor: '#fff', flexShrink: 0 }, navPhone: { width: '100%', maxWidth: MAX_PHONE_WIDTH },
});
