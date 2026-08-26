import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { RuntimeConfigurationResult } from '@/config/runtime';
import { colors, contentPadding } from '@/constants/theme';

export function RuntimeConfigurationState({ result, children }: { result: RuntimeConfigurationResult; children: ReactNode }) {
  if (result.ready) return children;

  return (
    <View accessible accessibilityRole="alert" style={styles.page}>
      <AppText weight="bold" style={styles.title}>App setup required</AppText>
      <AppText style={styles.body}>Add the following matching public values to an ignored .env.local file, then restart Expo to connect Clerk and Convex Cloud:</AppText>
      <View style={styles.issues}>
        {result.issues.map((issue) => <AppText key={issue} style={styles.issue}>• {issue}</AppText>)}
      </View>
      <AppText style={styles.note}>Never place Convex admin keys, Clerk secret keys, or deployment credentials in EXPO_PUBLIC_* variables.</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: contentPadding, backgroundColor: colors.white },
  title: { fontSize: 22, color: colors.burgundy },
  body: { marginTop: 12, fontSize: 13, lineHeight: 20 },
  issues: { marginTop: 16, gap: 8 },
  issue: { fontSize: 12, lineHeight: 18 },
  note: { marginTop: 20, color: colors.muted, fontSize: 11, lineHeight: 17 },
});
