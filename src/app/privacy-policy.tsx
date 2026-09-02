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
        <Section title="Cloud application records">When you are signed in, account profiles, projects, bookings, messages, saved services, mentor history, and other demonstration records are stored in Convex Cloud.</Section>
        <Section title="Authentication provider">Clerk processes account registration and sign-in, email verification, OAuth when you choose it, session data, and delivery of password-recovery email codes.</Section>
        <Section title="No payment collection">SkillFlow does not collect card numbers, bank information, or real payments. All balances and transactions are simulated.</Section>
        <Section title="Simulated verification">Student Verification and its review outcomes are simulations for this academic demonstration. SkillFlow does not perform real identity verification.</Section>
        <Section title="AI Mentor">When configured, the AI Mentor sends prompts to a temporary OpenCode Zen model, which may retain prompts or use them for improvement. SkillFlow uses deterministic simulated guidance when Zen is unavailable. Prompts and conversation history are stored in Convex Cloud. Do not share personal, confidential, or client information.</Section>
        <Section title="Deletion and reset controls">You can clear mentor conversation history from the AI Mentor screen. Settings does not provide a general account-data deletion or demo-reset action. Cloud-development seed resets are operator-only and limited to the designated demonstration seed namespace.</Section>
        <Section title="Safe demonstration data">Use fictional or non-sensitive information. Do not enter real student IDs, financial credentials, confidential project files, or private client information.</Section>
      </ScrollView>
    </MobilePage>
  );
}

function Section({ title, children }: { title: string; children: string }) { return <><AppText weight="semibold" style={styles.heading}>{title}</AppText><AppText style={styles.copy}>{children}</AppText></>; }

const styles = StyleSheet.create({ content: { padding: contentPadding, paddingBottom: 36 }, title: { fontSize: 22 }, updated: { color: colors.muted, fontSize: 11, marginTop: 4, marginBottom: 13 }, heading: { fontSize: 16, marginTop: 18 }, copy: { color: colors.muted, fontSize: 13, lineHeight: 22, marginTop: 5 } });
