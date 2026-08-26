import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { RuntimeConfigurationState } from '@/components/runtime-configuration-state';
import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { readRuntimeConfiguration } from '@/config/runtime';

export default function RuntimeConfigurationScreen() {
  return (
    <MobilePage>
      <StatusBar style="dark" />
      <AppHeader title="Connected Services" red={false} onBack={() => router.back()} />
      <RuntimeConfigurationState result={readRuntimeConfiguration()}>
        <View style={styles.ready}>
          <AppText weight="bold" style={styles.readyTitle}>Configuration looks valid</AppText>
          <AppText style={styles.readyBody}>Provider wiring is intentionally deferred until the administrator supplies the approved Clerk and Convex integration settings. The seeded demo remains the current source of truth.</AppText>
        </View>
      </RuntimeConfigurationState>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  ready: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.white },
  readyTitle: { fontSize: 22, color: colors.burgundy },
  readyBody: { marginTop: 12, fontSize: 13, lineHeight: 20, color: colors.ink },
});
