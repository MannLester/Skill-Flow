import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppText, MobilePage, ReferenceCrop } from '@/components/ui';
import { colors, contentPadding, font, shadow } from '@/constants/theme';
import { useSession } from '@/context/session';

const aiReference = require('../../references/ai_project_mentor_page.jpg');
const suggestions = [
  { icon: 'color-wand-outline' as const, label: 'Improve my project idea' }, { icon: 'scan-outline' as const, label: 'Check my design' },
  { icon: 'color-palette-outline' as const, label: 'Suggest color combinations' }, { icon: 'ribbon-outline' as const, label: 'Review my portfolio' },
];

export default function AiMentorScreen() {
  const insets = useSafeAreaInsets();
  const { clearMentorConversation, currentAccount, mentorMessages, sendMentorMessage } = useSession();
  const [message, setMessage] = useState('');
  const conversation = mentorMessages.filter((item) => item.accountId === currentAccount?.id);
  const send = () => { const result = sendMentorMessage(message); if (!result.ok) Alert.alert('Unable to send', result.message); else setMessage(''); };
  return <MobilePage><StatusBar style="light" /><AppHeader title="AI Project Mentor" onBack={() => router.back()} right={conversation.length ? <Pressable accessibilityRole="button" accessibilityLabel="Clear mentor conversation" onPress={() => Alert.alert('Clear conversation?', 'This removes the locally stored mentor messages.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: clearMentorConversation }])}><Ionicons name="trash-outline" size={23} color={colors.white} /></Pressable> : null} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ReferenceCrop source={aiReference} sourceSize={{ width: 1920, height: 1080 }} crop={{ x: 850, y: 224, width: 267, height: 205 }} style={styles.robot} />
        <View style={styles.simulation}><Ionicons name="flask-outline" size={19} color={colors.burgundy} /><AppText style={styles.simulationText}>Simulated AI: responses are deterministic, local, and do not contact an external AI service.</AppText></View>
        <View style={styles.greeting}><AppText weight="semibold" style={styles.greetingText}>Hi {currentAccount?.name ?? 'Student'}! I&apos;m your AI Mentor.{`\n`}How can I help you today?</AppText></View>
        {!conversation.length ? <View style={styles.suggestions}>{suggestions.map((item) => <Pressable key={item.label} onPress={() => setMessage(item.label)} style={styles.suggestion}><Ionicons name={item.icon} size={23} color={colors.burgundy} /><AppText weight="medium" style={styles.suggestionText}>{item.label}</AppText></Pressable>)}</View> : <View style={styles.conversation}>{conversation.map((item) => <View key={item.id} style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.mentorBubble]}><AppText weight="medium" style={[styles.speaker, item.role === 'user' && { color: colors.white }] }>{item.role === 'user' ? 'You' : 'Simulated Mentor'}</AppText><AppText style={[styles.messageText, item.role === 'user' && { color: colors.white }]}>{item.body}</AppText></View>)}</View>}
      </ScrollView>
      <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}><View style={styles.composer}><TextInput value={message} onChangeText={setMessage} placeholder="Ask about a project or portfolio…" placeholderTextColor={colors.muted} style={styles.input} onSubmitEditing={send} /><Pressable accessibilityRole="button" accessibilityLabel="Send mentor question" disabled={!message.trim()} onPress={send} style={[styles.send, !message.trim() && { opacity: 0.45 }]}><Ionicons name="send" size={20} color={colors.white} /></Pressable></View></View>
    </KeyboardAvoidingView>
  </MobilePage>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: contentPadding, paddingBottom: 24 }, robot: { width: 150, alignSelf: 'center', marginTop: 8 }, simulation: { flexDirection: 'row', gap: 8, backgroundColor: colors.blush, borderRadius: 10, padding: 11, marginTop: 8 }, simulationText: { flex: 1, color: colors.burgundy, fontSize: 9, lineHeight: 15 }, greeting: { backgroundColor: colors.white, borderRadius: 13, padding: 17, marginTop: 12, ...shadow }, greetingText: { fontSize: 16, lineHeight: 24 }, suggestions: { gap: 11, marginTop: 22 }, suggestion: { minHeight: 58, borderWidth: 1, borderColor: colors.border, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 17 }, suggestionText: { fontSize: 14 }, conversation: { gap: 11, marginTop: 18 }, bubble: { maxWidth: '88%', borderRadius: 13, padding: 13 }, userBubble: { alignSelf: 'flex-end', backgroundColor: colors.red }, mentorBubble: { alignSelf: 'flex-start', backgroundColor: colors.blush }, speaker: { color: colors.burgundy, fontSize: 8, marginBottom: 4 }, messageText: { fontSize: 11, lineHeight: 18 }, composerWrap: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.white }, composer: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 26, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 }, input: { flex: 1, fontFamily: font.regular, color: colors.ink, fontSize: 13 }, send: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red },
});
