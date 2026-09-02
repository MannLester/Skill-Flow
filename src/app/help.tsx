import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';

const items = [
  ['How do I test both roles?', 'Create or use one Student Designer account and one Client account in the Clerk development instance. Log out and sign in to the other account to switch roles. Shared project data remains available in Convex Cloud.'],
  ['Where is demonstration data stored?', 'Authenticated application records, including shared project data, are stored in Convex Cloud. Use fictional or non-sensitive information.'],
  ['Who handles sign-in and recovery?', 'Clerk processes authentication, email verification, OAuth when chosen, session data, and delivery of password-recovery email codes.'],
  ['Are payments real?', 'No. Holds, releases, balances, and earnings are clearly labeled simulations. Never enter card or banking information.'],
  ['How does verification work?', 'The student completes a sample form and selects a placeholder ID. A deterministic approve or reject control simulates review. Never enter a real student ID.'],
  ['Does the AI Mentor use an external AI?', 'It can. When configured, prompts are sent to a temporary OpenCode Zen model. Zen may retain prompts or use them for improvement. SkillFlow uses deterministic simulated guidance when Zen is unavailable. Prompts and conversation history are stored in Convex Cloud. Do not share personal, confidential, or client information.'],
  ['How do I restart the demonstration?', 'There is no demo-reset action in Settings. Cloud-development seed resets are operator-only and limited to the designated demonstration seed namespace.'],
];
export default function HelpScreen() { return <MobilePage><StatusBar style="light" /><AppHeader title="Help Center" onBack={() => router.back()} /><ScrollView contentContainerStyle={styles.content}><AppText weight="bold" style={styles.title}>SkillFlow Demo Help</AppText>{items.map(([question, answer]) => <View key={question} style={styles.item}><AppText weight="semibold">{question}</AppText><AppText style={styles.copy}>{answer}</AppText></View>)}</ScrollView></MobilePage>; }
const styles = StyleSheet.create({ content: { padding: contentPadding, paddingBottom: 35 }, title: { fontSize: 22, marginBottom: 8 }, item: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 16 }, copy: { color: colors.muted, fontSize: 12, lineHeight: 20, marginTop: 6 } });
