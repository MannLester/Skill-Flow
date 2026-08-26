import Ionicons from '@expo/vector-icons/Ionicons';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { useFonts } from 'expo-font';
import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MAX_PHONE_WIDTH } from '@/constants/theme';
import { SessionProvider, useNavigationSession } from '@/context/session';
import { primaryNavActiveForPath, PrimaryBottomNav } from '@/navigation/primary-navigation';
import { blurActiveWebElement } from '@/utils/web-focus';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <NavigationShell />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function NavigationShell() {
  const pathname = usePathname();
  const { saved } = useGlobalSearchParams<{ saved?: string | string[] }>();
  const { currentAccount, messageUnread, role } = useNavigationSession();
  const active = currentAccount ? primaryNavActiveForPath(pathname, role, saved) : null;
  return <View style={styles.shell}>
    <View style={styles.stack}>
      <AppStack />
    </View>
    {active === null ? null : <View style={styles.navOuter}><View style={styles.navPhone}><PrimaryBottomNav active={active} role={role} messageUnread={messageUnread} /></View></View>}
  </View>;
}

const stackListeners = { transitionStart: blurActiveWebElement };
const stackOptions = { headerShown: false, animation: 'slide_from_right' as const, freezeOnBlur: true };
const primaryScreenOptions = { animation: 'none' as const };

const AppStack = memo(function AppStack() {
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
  shell: { flex: 1 },
  stack: { flex: 1 },
  navOuter: { alignItems: 'center', backgroundColor: '#fff' },
  navPhone: { width: '100%', maxWidth: MAX_PHONE_WIDTH },
});
