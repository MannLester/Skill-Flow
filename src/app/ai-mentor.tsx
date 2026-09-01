import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding, font } from '@/constants/theme';
import { MentorMessage, useSession } from '@/context/session.remote';

const suggestions = [
  { icon: 'color-wand-outline' as const, label: 'Improve my project idea' }, { icon: 'scan-outline' as const, label: 'Check my design' },
  { icon: 'color-palette-outline' as const, label: 'Suggest color combinations' }, { icon: 'ribbon-outline' as const, label: 'Review my portfolio' },
];

const mentorKeyExtractor = (item: MentorMessage) => item.id;

const MentorMessageRow = memo(function MentorMessageRow({ item }: { item: MentorMessage }) {
  const user = item.role === 'user';
  return <View style={[styles.bubble, user ? styles.userBubble : styles.mentorBubble]}><AppText weight="medium" style={[styles.speaker, user && { color: colors.white }]}>{user ? 'You' : 'Simulated Mentor'}</AppText><AppText style={[styles.messageText, user && { color: colors.white }]}>{item.body}</AppText></View>;
});

function MentorListHeader({ accountName, hasConversation, onSuggestion }: { accountName?: string; hasConversation: boolean; onSuggestion: (value: string) => void }) {
  return <>
    <View style={styles.robotWrap}><View style={styles.robotContainer}><Ionicons name="hardware-chip" size={64} color={colors.red} /></View><AppText weight="semibold" style={styles.robotTitle}>AI Mentor</AppText></View>
    <View style={styles.greetingBubble}><AppText weight="medium" style={styles.greetingSpeaker}>Simulated Mentor</AppText><AppText style={styles.greetingText}>Hi {accountName ?? 'Student'}! I&apos;m your AI Mentor.{`\n`}How can I help you today?</AppText></View>
    {!hasConversation ? <View style={styles.suggestions}>{suggestions.map((item) => <Pressable key={item.label} onPress={() => onSuggestion(item.label)} style={styles.suggestion}><Ionicons name={item.icon} size={23} color={colors.burgundy} /><AppText weight="medium" style={styles.suggestionText}>{item.label}</AppText></Pressable>)}</View> : null}
  </>;
}

export default function AiMentorScreen() {
  const insets = useSafeAreaInsets();
  const { currentAccount, hydrated, mentorMessages, sendMentorMessage } = useSession();
  const [message, setMessage] = useState('');
  const isClient = currentAccount?.role === 'client';

  useEffect(() => {
    if (hydrated && isClient) router.replace('/client-home');
  }, [hydrated, isClient]);

  const conversation = useMemo(() => mentorMessages.filter((item) => item.accountId === currentAccount?.id), [currentAccount?.id, mentorMessages]);
  const chooseSuggestion = useCallback((value: string) => setMessage(value), []);
  const renderItem = useCallback(({ item }: { item: MentorMessage }) => <MentorMessageRow item={item} />, []);
  const listHeader = useMemo(() => <MentorListHeader accountName={currentAccount?.name} hasConversation={conversation.length > 0} onSuggestion={chooseSuggestion} />, [conversation.length, currentAccount?.name, chooseSuggestion]);
  if (!hydrated || isClient) return <MobilePage><View /></MobilePage>;

  const send = async () => { const result = await sendMentorMessage(message); if (!result.ok) Alert.alert('Unable to send', result.message); else setMessage(''); };
  return <MobilePage><StatusBar style="light" /><AppHeader title="AI Project Mentor" onBack={() => router.back()} />
    <View style={styles.simulationBanner}><Ionicons name="flask-outline" size={19} color={colors.muted} /><AppText style={styles.simulationText}>Simulated AI: responses are deterministic and do not contact an external AI service. Prompts and conversation history are stored in Convex Cloud.</AppText></View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        testID="mentor-transcript"
        style={styles.list}
        data={conversation}
        keyExtractor={mentorKeyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
      />
      <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}><View style={styles.composer}><TextInput value={message} onChangeText={setMessage} placeholder="Ask about a project or portfolio…" placeholderTextColor={colors.muted} style={styles.input} onSubmitEditing={send} /><Pressable accessibilityRole="button" accessibilityLabel="Send mentor question" disabled={!message.trim()} onPress={send} style={[styles.send, !message.trim() && { opacity: 0.45 }]}><Ionicons name="send" size={20} color={colors.white} /></Pressable></View></View>
    </KeyboardAvoidingView>
  </MobilePage>;
}

const styles = StyleSheet.create({
  list: { flex: 1 }, content: { flexGrow: 1, padding: contentPadding, paddingBottom: 24 }, robotWrap: { alignItems: 'center', marginTop: 16 }, robotContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, robotTitle: { fontSize: 15, color: colors.ink, marginTop: 8 }, simulationBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, paddingVertical: 11, paddingHorizontal: contentPadding }, simulationText: { flex: 1, color: colors.muted, fontSize: 9, lineHeight: 15 },   greetingBubble: { alignSelf: 'flex-start', backgroundColor: colors.blush, borderRadius: 13, padding: 13, marginTop: 11, maxWidth: '88%' }, greetingSpeaker: { color: colors.burgundy, fontSize: 8, marginBottom: 4 }, greetingText: { fontSize: 11, lineHeight: 18 }, suggestions: { gap: 10, marginTop: 18 }, suggestion: { minHeight: 58, borderWidth: 1, borderColor: colors.border, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 17 }, suggestionText: { fontSize: 14 }, bubble: { maxWidth: '88%', borderRadius: 13, padding: 13, marginTop: 11 }, userBubble: { alignSelf: 'flex-end', backgroundColor: colors.red }, mentorBubble: { alignSelf: 'flex-start', backgroundColor: colors.blush }, speaker: { color: colors.burgundy, fontSize: 8, marginBottom: 4 }, messageText: { fontSize: 11, lineHeight: 18 }, composerWrap: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.white }, composer: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 26, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 }, input: { flex: 1, fontFamily: font.regular, color: colors.ink, fontSize: 13 }, send: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red },
});
