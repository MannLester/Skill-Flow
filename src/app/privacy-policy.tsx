import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';

export default function PrivacyPolicyScreen() {
  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Privacy Policy" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText weight="bold" style={styles.title}>SkillFlow Demo Privacy Notice</AppText>
        <AppText style={styles.updated}>Academic demonstration copy</AppText>
        <Section title="Local storage">Account profiles, bookings, saved services, and other demonstration records are stored locally on the device.</Section>
        <Section title="No payment collection">SkillFlow does not collect card numbers, bank information, or real payments. All balances and transactions are simulated.</Section>
        <Section title="No recovery email">Password recovery is simulated. The application does not send account information to an email provider.</Section>
        <Section title="Local mentor history">AI Mentor prompts and deterministic responses are stored locally and are not sent to an external AI service.</Section>
        <Section title="Demo reset">Users can remove locally created demonstration data from Settings by selecting Reset Demo Data.</Section>
        <Section title="Safe demonstration data">Use fictional or non-sensitive information. Do not enter real student IDs, financial credentials, confidential project files, or private client information.</Section>
      </ScrollView>
    </MobilePage>
  );
}

function Section({ title, children }: { title: string; children: string }) { return <><AppText weight="semibold" style={styles.heading}>{title}</AppText><AppText style={styles.copy}>{children}</AppText></>; }

const styles = StyleSheet.create({ content: { padding: contentPadding, paddingBottom: 36 }, title: { fontSize: 22 }, updated: { color: colors.muted, fontSize: 11, marginTop: 4, marginBottom: 13 }, heading: { fontSize: 16, marginTop: 18 }, copy: { color: colors.muted, fontSize: 13, lineHeight: 22, marginTop: 5 } });
