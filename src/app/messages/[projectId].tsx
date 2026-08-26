import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding, font } from '@/constants/theme';
import { DemoAccount, ProjectMessage, useSession } from '@/context/session.remote';

export function buildMessageSenderIndex(accounts: DemoAccount[]) {
  return new Map(accounts.map((account) => [account.id, account.name]));
}

function messageKeyExtractor(item: ProjectMessage) {
  return item.id;
}

function ConversationEmptyState() {
  return <View style={styles.empty}><AppText weight="semibold">Start the conversation</AppText><AppText style={styles.emptyText}>Messages sync through the shared SkillFlow development backend.</AppText></View>;
}

export default function ProjectMessagesScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const insets = useSafeAreaInsets();
  const { accounts, bookings, currentAccount, markProjectMessagesRead, messages, sendMessage } = useSession();
  const [body, setBody] = useState('');
  const booking = bookings.find((item) => item.id === projectId);
  const thread = useMemo(() => messages.filter((message) => message.projectId === projectId), [messages, projectId]);
  const senderNames = useMemo(() => buildMessageSenderIndex(accounts), [accounts]);
  const renderItem = useCallback(({ item }: { item: ProjectMessage }) => <MessageBubble message={item} own={item.senderId === currentAccount?.id} sender={senderNames.get(item.senderId) ?? 'User'} />, [currentAccount?.id, senderNames]);

  useEffect(() => { if (booking) void markProjectMessagesRead(booking.id); }, [booking, markProjectMessagesRead, thread.length]);
  if (!booking) return <MobilePage><StatusBar style="light" /><AppHeader title="Messages" onBack={() => router.back()} /><View style={styles.empty}><AppText>Project conversation not found.</AppText></View></MobilePage>;

  const submit = async () => { const result = await sendMessage(booking.id, body); if (result.ok) setBody(''); };
  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title={booking.title} onBack={() => router.back()} right={<Pressable accessibilityRole="button" accessibilityLabel="Open project" onPress={() => router.push({ pathname: '/projects/[projectId]', params: { projectId: booking.id } })}><Ionicons name="briefcase-outline" size={25} color={colors.white} /></Pressable>} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList data={thread} keyExtractor={messageKeyExtractor} renderItem={renderItem} contentContainerStyle={styles.list} initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7} removeClippedSubviews={Platform.OS === 'android'} ListEmptyComponent={ConversationEmptyState} />
        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 9) }]}><View style={styles.composer}><TextInput value={body} onChangeText={setBody} placeholder="Write a message…" placeholderTextColor={colors.muted} style={styles.input} onSubmitEditing={submit} /><Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!body.trim()} onPress={submit} style={[styles.send, !body.trim() && { opacity: 0.45 }]}><Ionicons name="send" size={20} color={colors.white} /></Pressable></View></View>
      </KeyboardAvoidingView>
    </MobilePage>
  );
}

const MessageBubble = memo(function MessageBubble({ message, own, sender }: { message: ProjectMessage; own: boolean; sender: string }) { return <View style={[styles.bubbleWrap, own && { alignItems: 'flex-end' }]}><AppText style={styles.sender}>{sender}</AppText><View style={[styles.bubble, own && styles.ownBubble]}><AppText style={[styles.body, own && { color: colors.white }]}>{message.body}</AppText></View></View>; });

const styles = StyleSheet.create({
  list: { flexGrow: 1, padding: contentPadding, gap: 13 }, bubbleWrap: { alignItems: 'flex-start' }, sender: { color: colors.muted, fontSize: 9, marginBottom: 3 }, bubble: { maxWidth: '82%', backgroundColor: colors.surface, borderRadius: 15, borderBottomLeftRadius: 4, paddingHorizontal: 13, paddingVertical: 10 }, ownBubble: { backgroundColor: colors.red, borderBottomLeftRadius: 15, borderBottomRightRadius: 4 }, body: { fontSize: 12, lineHeight: 18 }, composerWrap: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 13, paddingTop: 9 }, composer: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingLeft: 15, paddingRight: 4 }, input: { flex: 1, fontFamily: font.regular, color: colors.ink, fontSize: 12 }, send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: contentPadding }, emptyText: { color: colors.muted, textAlign: 'center', marginTop: 6, fontSize: 11 },
});
