import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';

export default function TermsScreen() {
  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Terms & Conditions" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText weight="bold" style={styles.title}>SkillFlow Demonstration Terms</AppText>
        <AppText style={styles.updated}>Academic demonstration copy</AppText>
        <Section title="Purpose">SkillFlow is a functional academic demonstration for connecting student designers and clients. It is not a production marketplace.</Section>
        <Section title="Demo accounts and cloud data">Authenticated application records are stored in Convex Cloud. Clerk processes registration, authentication, email verification, OAuth when chosen, session data, and password-recovery email delivery. Use sample information; do not enter real student IDs, financial credentials, confidential project files, private client information, or other sensitive personal or school data.</Section>
        <Section title="Projects and payments">Projects, balances, payment holds, releases, ratings, verification, and notifications are simulations. No real contract, payment, escrow, or transfer is created.</Section>
        <Section title="AI Mentor">When configured, the mentor may send prompts to a temporary OpenCode Zen model, which may retain prompts or use them for improvement. SkillFlow uses deterministic simulated guidance when Zen is unavailable. Mentor conversation history is stored in Convex Cloud. Do not share personal, confidential, or client information. The guidance is not professional, academic, or employment advice.</Section>
        <Section title="Appropriate use">Do not upload unlawful, confidential, harmful, or copyrighted material that you do not have permission to use.</Section>
        <Section title="Deletion and reset">Settings does not provide a general account-data deletion or demo-reset action. Cloud-development seed resets are operator-only and limited to the designated demonstration seed namespace.</Section>
      </ScrollView>
    </MobilePage>
  );
}

function Section({ title, children }: { title: string; children: string }) { return <><AppText weight="semibold" style={styles.heading}>{title}</AppText><AppText style={styles.copy}>{children}</AppText></>; }

const styles = StyleSheet.create({ content: { padding: contentPadding, paddingBottom: 36 }, title: { fontSize: 22 }, updated: { color: colors.muted, fontSize: 11, marginTop: 4, marginBottom: 13 }, heading: { fontSize: 16, marginTop: 18 }, copy: { color: colors.muted, fontSize: 13, lineHeight: 22, marginTop: 5 } });
