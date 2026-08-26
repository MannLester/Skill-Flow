import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';
import { useSession } from '@/context/session';

type Row = { label: string; icon: keyof typeof Ionicons.glyphMap; value?: string; toggle?: boolean; enabled?: boolean; onPress: () => void };

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { logout, preferences, resetDemoData, updatePreferences } = useSession();
  const dark = preferences.darkMode;
  const sections: { title: string; rows: Row[] }[] = [
    { title: 'Account', rows: [
      { label: 'Edit Profile', icon: 'person-outline', onPress: () => router.push('/profile/edit') },
      { label: 'Change Password', icon: 'lock-closed-outline', onPress: () => router.push('/change-password') },
      { label: 'Demo Wallet', icon: 'wallet-outline', onPress: () => router.push('/demo-wallet') },
    ] },
    { title: 'Preferences', rows: [
      { label: 'Notification Badges', icon: 'notifications-outline', toggle: true, enabled: preferences.notificationsEnabled, onPress: () => updatePreferences({ notificationsEnabled: !preferences.notificationsEnabled }) },
      { label: 'Language', icon: 'globe-outline', value: preferences.language, onPress: () => Alert.alert('Language', 'English is the only language included in this academic demonstration.') },
      { label: 'Dark Mode', icon: 'contrast-outline', toggle: true, enabled: dark, onPress: () => updatePreferences({ darkMode: !dark }) },
    ] },
    { title: 'Support', rows: [
      { label: 'Connected Services', icon: 'server-outline', onPress: () => router.push('/runtime-configuration') },
      { label: 'Help Center', icon: 'help-circle-outline', onPress: () => router.push('/help') },
      { label: 'Terms & Conditions', icon: 'document-text-outline', onPress: () => router.push('/terms') },
      { label: 'Privacy Policy', icon: 'information-circle-outline', onPress: () => router.push('/privacy-policy') },
    ] },
  ];
  const logOut = () => { logout(); router.replace('/'); };
  const reset = () => Alert.alert('Reset demo data?', 'This removes locally created records and restores the seeded demo.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: () => { resetDemoData().then(() => router.replace('/')); } }]);
  return <MobilePage backgroundColor={dark ? '#171717' : colors.white}><StatusBar style="light" /><AppHeader title="Settings" onBack={() => router.back()} /><ScrollView showsVerticalScrollIndicator={false} style={dark ? styles.darkPage : undefined} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 30) }]}>
    {dark ? <View style={styles.themeNotice}><Ionicons name="moon" size={18} color={colors.white} /><AppText style={styles.darkCopy}>Dark styling is active for Settings. This local preference is preserved when the app restarts.</AppText></View> : null}
    {sections.map((section) => <View key={section.title} style={[styles.section, dark && styles.darkSection]}><AppText weight="semibold" style={[styles.sectionTitle, dark && styles.darkText]}>{section.title}</AppText>{section.rows.map((row) => <SettingsRow key={row.label} {...row} dark={dark} />)}</View>)}
    <Pressable onPress={reset} style={styles.reset}><AppText weight="medium" style={[styles.resetText, dark && styles.darkCopy]}>Reset Demo Data</AppText></Pressable><Pressable onPress={logOut} style={[styles.logout, dark && styles.darkBorder]}><AppText weight="semibold" style={[styles.logoutText, dark && { color: '#ff9999' }]}>Log Out</AppText></Pressable>
  </ScrollView></MobilePage>;
}

function SettingsRow({ label, icon, value, toggle, enabled, onPress, dark }: Row & { dark: boolean }) { return <Pressable accessibilityRole={toggle ? 'switch' : 'button'} accessibilityState={toggle ? { checked: enabled } : undefined} onPress={onPress} style={styles.row}><Ionicons name={icon} size={23} color={dark ? '#dddddd' : '#555'} /><AppText weight="medium" style={[styles.label, dark && styles.darkText]}>{label}</AppText>{value ? <AppText style={[styles.value, dark && styles.darkCopy]}>{value}</AppText> : null}{toggle ? <View style={[styles.switch, enabled && styles.switchOn]}><View style={[styles.knob, enabled && styles.knobOn]} /></View> : <Ionicons name="chevron-forward" size={22} color={dark ? '#dddddd' : '#555'} />}</Pressable>; }

const styles = StyleSheet.create({ content: { flexGrow: 1, paddingHorizontal: contentPadding }, darkPage: { backgroundColor: '#171717' }, themeNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#333', borderRadius: 10, padding: 11, marginTop: 14 }, section: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 17 }, darkSection: { borderBottomColor: '#444' }, sectionTitle: { fontSize: 16, marginBottom: 6 }, row: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 14 }, label: { flex: 1, fontSize: 14 }, value: { fontSize: 13 }, switch: { width: 47, height: 27, borderRadius: 14, backgroundColor: colors.graySwitch, justifyContent: 'center', paddingHorizontal: 3 }, switchOn: { backgroundColor: colors.green }, knob: { width: 21, height: 21, borderRadius: 11, backgroundColor: colors.white }, knobOn: { alignSelf: 'flex-end' }, reset: { marginTop: 18, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, resetText: { color: colors.muted, fontSize: 13 }, logout: { minHeight: 57, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, logoutText: { color: colors.burgundy, fontSize: 17 }, darkText: { color: colors.white }, darkCopy: { color: '#c9c9c9', fontSize: 10, flex: 1 }, darkBorder: { borderColor: '#555' } });
