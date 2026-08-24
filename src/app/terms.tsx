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
        <Section title="Demo accounts and data">Information entered in the application is stored locally on the device. Users should use sample information and must not enter sensitive personal, school, payment, or banking data.</Section>
        <Section title="Projects and payments">Projects, balances, payment holds, releases, ratings, verification, and notifications are simulations. No real contract, payment, escrow, or transfer is created.</Section>
        <Section title="AI Mentor">Mentor responses are deterministic simulated guidance generated locally. They are not professional, academic, or employment advice.</Section>
        <Section title="Appropriate use">Do not upload unlawful, confidential, harmful, or copyrighted material that you do not have permission to use.</Section>
        <Section title="Reset">The Reset Demo Data action removes locally created demonstration records and restores the seeded application state.</Section>
      </ScrollView>
    </MobilePage>
  );
}

function Section({ title, children }: { title: string; children: string }) { return <><AppText weight="semibold" style={styles.heading}>{title}</AppText><AppText style={styles.copy}>{children}</AppText></>; }

const styles = StyleSheet.create({ content: { padding: contentPadding, paddingBottom: 36 }, title: { fontSize: 22 }, updated: { color: colors.muted, fontSize: 11, marginTop: 4, marginBottom: 13 }, heading: { fontSize: 16, marginTop: 18 }, copy: { color: colors.muted, fontSize: 13, lineHeight: 22, marginTop: 5 } });
