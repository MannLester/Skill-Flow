import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';
import { useSession } from '@/context/session.remote';
import { useTranslation } from '@/localization';

type Row = { label: string; icon: keyof typeof Ionicons.glyphMap; value?: string; toggle?: boolean; enabled?: boolean; onPress: () => void };

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { logout, preferences, updatePreferences } = useSession();
  const { t } = useTranslation();
  const dark = preferences.darkMode;
  const sections: { title: string; rows: Row[] }[] = [
    { title: 'Account', rows: [
      { label: 'Edit Profile', icon: 'person-outline', onPress: () => router.push('/profile/edit') },
      { label: 'Change Password', icon: 'lock-closed-outline', onPress: () => router.push('/change-password') },
      { label: 'Demo Wallet', icon: 'wallet-outline', onPress: () => router.push('/demo-wallet') },
    ] },
    { title: 'Preferences', rows: [
      { label: 'Notification Badges', icon: 'notifications-outline', toggle: true, enabled: preferences.notificationsEnabled, onPress: () => updatePreferences({ notificationsEnabled: !preferences.notificationsEnabled }) },
      { label: 'Language', icon: 'globe-outline', value: preferences.language, onPress: () => Alert.alert(t('Language'), t('Choose the language used throughout SkillFlow.'), [
        { text: t('English'), onPress: () => updatePreferences({ language: 'English' }) },
        { text: t('Filipino'), onPress: () => updatePreferences({ language: 'Filipino' }) },
        { text: t('Cancel'), style: 'cancel' },
      ]) },
      { label: 'Dark Mode', icon: 'contrast-outline', toggle: true, enabled: dark, onPress: () => updatePreferences({ darkMode: !dark }) },
    ] },
    { title: 'Support', rows: [
      { label: 'Connected Services', icon: 'server-outline', onPress: () => router.push('/runtime-configuration') },
      { label: 'Help Center', icon: 'help-circle-outline', onPress: () => router.push('/help') },
      { label: 'Terms & Conditions', icon: 'document-text-outline', onPress: () => router.push('/terms') },
      { label: 'Privacy Policy', icon: 'information-circle-outline', onPress: () => router.push('/privacy-policy') },
    ] },
  ];
  const logOut = async () => { await logout(); router.replace('/'); };
  return <MobilePage><StatusBar style="light" /><AppHeader title="Settings" onBack={() => router.back()} /><ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 30) }]}>
    {dark ? <View style={styles.themeNotice}><Ionicons name="moon" size={18} color={colors.ink} /><AppText style={styles.themeCopy}>Dark mode is active outside sign-in and account access screens. This preference is stored in Convex Cloud and restored when you sign in again.</AppText></View> : null}
    {sections.map((section) => <View key={section.title} style={styles.section}><AppText weight="semibold" style={styles.sectionTitle}>{section.title}</AppText>{section.rows.map((row) => <SettingsRow key={row.label} {...row} />)}</View>)}
    <AppText style={styles.resetText}>Development demo resets are operator-only and never run from the mobile app.</AppText><Pressable onPress={logOut} style={styles.logout}><AppText weight="semibold" style={styles.logoutText}>Log Out</AppText></Pressable>
  </ScrollView></MobilePage>;
}

function SettingsRow({ label, icon, value, toggle, enabled, onPress }: Row) { return <Pressable accessibilityRole={toggle ? 'switch' : 'button'} accessibilityState={toggle ? { checked: enabled } : undefined} onPress={onPress} style={styles.row}><Ionicons name={icon} size={23} color={colors.muted} /><AppText weight="medium" style={styles.label}>{label}</AppText>{value ? <AppText style={styles.value}>{value}</AppText> : null}{toggle ? <View style={[styles.switch, enabled && styles.switchOn]}><View style={[styles.knob, enabled && styles.knobOn]} /></View> : <Ionicons name="chevron-forward" size={22} color={colors.muted} />}</Pressable>; }

const styles = StyleSheet.create({ content: { flexGrow: 1, paddingHorizontal: contentPadding, paddingTop: 10 }, themeNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 10, padding: 11, marginTop: 14 }, themeCopy: { color: colors.muted, fontSize: 10, flex: 1 }, section: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 20 }, sectionTitle: { fontSize: 16, marginTop: 4, marginBottom: 10 }, row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 14 }, label: { flex: 1, fontSize: 14 }, value: { color: colors.muted, fontSize: 13 }, switch: { width: 47, height: 27, borderRadius: 14, backgroundColor: colors.graySwitch, justifyContent: 'center', paddingHorizontal: 3 }, switchOn: { backgroundColor: colors.green }, knob: { width: 21, height: 21, borderRadius: 11, backgroundColor: colors.white }, knobOn: { alignSelf: 'flex-end' }, resetText: { color: colors.muted, fontSize: 13, marginBottom: 16 }, logout: { minHeight: 57, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24 }, logoutText: { color: colors.red, fontSize: 17 } });
