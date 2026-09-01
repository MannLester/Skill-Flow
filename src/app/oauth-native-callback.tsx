import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';

export default function OAuthNativeCallbackScreen() {
  return (
    <MobilePage>
      <View style={styles.center}>
        <ActivityIndicator color={colors.red} size="large" />
        <AppText weight="semibold" style={styles.title}>Completing sign-in</AppText>
        <AppText style={styles.copy}>Securely returning you to SkillFlow…</AppText>
      </View>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: contentPadding },
  title: { fontSize: 18, textAlign: 'center' },
  copy: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
