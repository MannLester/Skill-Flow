import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';

const items = [
  ['How do I test both roles?', 'Log out and use the Alex Student Designer or Mark Client demo login. Shared local project data remains available.'],
  ['Are payments real?', 'No. Holds, releases, balances, and earnings are clearly labeled simulations. Never enter card or banking information.'],
  ['How does verification work?', 'The student completes a sample form and selects a placeholder ID. A deterministic approve or reject control simulates review locally.'],
  ['Does the AI Mentor use an external AI?', 'No. It selects deterministic guidance from the prompt topic and stores the conversation only on this device.'],
  ['How do I restart the demonstration?', 'Use Reset Demo Data in Settings to restore all seeded accounts and records.'],
];
export default function HelpScreen() { return <MobilePage><StatusBar style="light" /><AppHeader title="Help Center" onBack={() => router.back()} /><ScrollView contentContainerStyle={styles.content}><AppText weight="bold" style={styles.title}>SkillFlow Demo Help</AppText>{items.map(([question, answer]) => <View key={question} style={styles.item}><AppText weight="semibold">{question}</AppText><AppText style={styles.copy}>{answer}</AppText></View>)}</ScrollView></MobilePage>; }
const styles = StyleSheet.create({ content: { padding: contentPadding, paddingBottom: 35 }, title: { fontSize: 22, marginBottom: 8 }, item: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 16 }, copy: { color: colors.muted, fontSize: 12, lineHeight: 20, marginTop: 6 } });
