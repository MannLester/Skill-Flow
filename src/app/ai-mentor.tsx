import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding, font } from '@/constants/theme';
import { MentorConversation, MentorMessage, useSession } from '@/context/session.remote';

const templates = [
  { icon: 'bulb-outline' as const, title: 'Improve an idea', prompt: 'Help me improve my project idea.' },
  { icon: 'scan-outline' as const, title: 'Review a design', prompt: 'Help me review my design and identify what to improve.' },
  { icon: 'color-palette-outline' as const, title: 'Build a palette', prompt: 'Suggest a color palette for my project.' },
  { icon: 'ribbon-outline' as const, title: 'Polish a portfolio', prompt: 'Help me improve how I present a project in my portfolio.' },
];

type PendingTurn = { turnKey: string; conversationId: string; userMessage: MentorMessage; status: 'thinking' | 'failed'; error?: string };
type StatusItem = { id: string; role: 'status'; status: 'thinking' | 'failed'; error?: string };
type TranscriptItem = MentorMessage | StatusItem;

const transcriptKey = (item: TranscriptItem) => item.id;
const isStatusItem = (item: TranscriptItem): item is StatusItem => item.role === 'status';
const makeTurnKey = () => `mentor-ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function leaveMentorScreen() {
  if (typeof router.canGoBack === 'function' && router.canGoBack()) router.back();
  else router.replace('/student-home');
}

function QuestionChoices({ item, onAnswer }: { item: MentorMessage; onAnswer: (answer: string) => void }) {
  if (!item.question) return null;
  return <View style={styles.questionChoices}>
    {item.question.options.map((option, index) => <Pressable key={`${item.id}-${option.label}`} accessibilityRole="button" accessibilityLabel={`Answer ${option.label}`} onPress={() => onAnswer(option.label)} style={styles.questionChoice}>
      <View style={styles.choiceNumber}><AppText weight="medium" style={styles.choiceNumberText}>{index + 1}</AppText></View>
      <View style={styles.choiceCopy}>
        <AppText weight="medium" style={styles.choiceLabel}>{option.label}{option.recommended ? ' (Recommended)' : ''}</AppText>
        {option.description ? <AppText style={styles.choiceDescription}>{option.description}</AppText> : null}
      </View>
    </Pressable>)}
    <AppText style={styles.customAnswerHint}>Or type a different answer below.</AppText>
  </View>;
}

const MentorMessageRow = memo(function MentorMessageRow({ answerable, item, onAnswer }: { answerable: boolean; item: MentorMessage; onAnswer: (answer: string) => void }) {
  const user = item.role === 'user';
  const body = answerable && item.question ? item.question.text : item.body;
  return <View style={[styles.bubble, item.question && answerable && styles.questionBubble, user ? styles.userBubble : styles.mentorBubble]}>
    <AppText style={[styles.messageText, user && styles.userMessageText]}>{body}</AppText>
    {answerable ? <QuestionChoices item={item} onAnswer={onAnswer} /> : null}
  </View>;
});

function PendingRow({ item, onRetry }: { item: StatusItem; onRetry: () => void }) {
  if (item.status === 'failed') {
    return <View style={[styles.bubble, styles.mentorBubble, styles.failedBubble]}>
      <AppText style={styles.errorText}>{item.error ?? 'The mentor could not reply.'}</AppText>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
        <Ionicons name="refresh" size={14} color={colors.burgundy} />
        <AppText weight="medium" style={styles.retryText}>Try again</AppText>
      </Pressable>
    </View>;
  }
  return <View accessibilityLabel="Mentor is thinking" style={[styles.bubble, styles.mentorBubble, styles.thinkingBubble]}>
    <ActivityIndicator size="small" color={colors.burgundy} />
    <AppText style={styles.thinkingText}>Mentor is thinking…</AppText>
  </View>;
}

function TranscriptRow({ answerableQuestionId, item, onAnswer, onRetry, pending }: { answerableQuestionId?: string; item: TranscriptItem; onAnswer: (answer: string) => void; onRetry: () => void; pending: boolean }) {
  if (isStatusItem(item)) return <PendingRow item={item} onRetry={onRetry} />;
  return <MentorMessageRow answerable={!pending && item.id === answerableQuestionId} item={item} onAnswer={onAnswer} />;
}

function EmptyChat({ accountName, disabled, onTemplate }: { accountName?: string; disabled: boolean; onTemplate: (prompt: string) => void }) {
  const firstName = accountName?.split(' ')[0] ?? 'there';
  return <View style={styles.emptyChat}>
    <View style={styles.mentorAvatar}><Ionicons name="sparkles" size={24} color={colors.red} /></View>
    <AppText weight="semibold" style={styles.emptyTitle}>How can I help, {firstName}?</AppText>
    <AppText style={styles.emptySubtitle}>Ask anything about your project, design, or portfolio, or start with a template.</AppText>
    <View style={styles.templateGrid}>
      {templates.map((template) => <Pressable key={template.title} accessibilityRole="button" disabled={disabled} onPress={() => onTemplate(template.prompt)} style={[styles.templateCard, disabled && styles.disabled]}>
        <Ionicons name={template.icon} size={20} color={colors.burgundy} />
        <AppText weight="medium" style={styles.templateTitle}>{template.title}</AppText>
        <Ionicons name="arrow-forward" size={15} color={colors.muted} style={styles.templateArrow} />
      </Pressable>)}
    </View>
  </View>;
}

function PrivacyNotice() {
  const [expanded, setExpanded] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={styles.notice}>
    <Ionicons name="shield-outline" size={17} color={colors.muted} />
    <View style={styles.noticeCopy}>
      <AppText weight="medium" style={styles.noticeTitle}>Don&apos;t share sensitive information</AppText>
      {expanded ? <AppText style={styles.noticeDetail}>Temporary OpenCode Zen models may retain prompts or use them for improvement. Prompts are stored in Convex Cloud. A simulated response is used when Zen is unavailable.</AppText> : null}
    </View>
    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
  </Pressable>;
}

function ConversationHistory({ active, confirming, conversations, deleting, disabled, onCancelDelete, onConfirmDelete, onDelete, onNew, onSelect }: { active?: string; confirming?: MentorConversation; conversations: MentorConversation[]; deleting?: string; disabled: boolean; onCancelDelete: () => void; onConfirmDelete: () => void; onDelete: (conversation: MentorConversation) => void; onNew: () => void; onSelect: (id: string) => void }) {
  return <View style={styles.historyPage}>
    <Pressable accessibilityRole="button" onPress={onNew} style={styles.newChatButton}>
      <Ionicons name="add" size={20} color={colors.white} />
      <AppText weight="medium" style={styles.newChatText}>New chat</AppText>
    </Pressable>
    <ScrollView showsVerticalScrollIndicator={false} style={styles.historyList} contentContainerStyle={styles.historyListContent}>
      {conversations.map((conversation) => <View key={conversation.id}>
        <View style={[styles.historyRow, active === conversation.id && styles.historyRowActive]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open chat ${conversation.title}`} onPress={() => onSelect(conversation.id)} style={styles.historyRowMain}>
            <Ionicons name="chatbubble-outline" size={18} color={active === conversation.id ? colors.burgundy : colors.muted} />
            <AppText weight={active === conversation.id ? 'medium' : 'regular'} numberOfLines={1} style={styles.historyRowTitle}>{conversation.title}</AppText>
            {active === conversation.id ? <Ionicons name="checkmark" size={18} color={colors.burgundy} /> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete chat ${conversation.title}`} disabled={disabled || Boolean(deleting)} onPress={() => onDelete(conversation)} hitSlop={8} style={styles.deleteChatButton}>
            {deleting === conversation.id ? <ActivityIndicator size="small" color={colors.burgundy} /> : <Ionicons name="trash-outline" size={18} color={colors.burgundy} />}
          </Pressable>
        </View>
        {confirming?.id === conversation.id ? <View accessibilityRole="alert" style={styles.deleteConfirmation}>
          <AppText weight="semibold" style={styles.deleteConfirmationTitle}>Delete this chat?</AppText>
          <AppText style={styles.deleteConfirmationCopy}>This permanently deletes the conversation and its messages.</AppText>
          <View style={styles.deleteConfirmationActions}>
            <Pressable accessibilityRole="button" onPress={onCancelDelete} style={styles.cancelDeleteButton}><AppText weight="medium">Cancel</AppText></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Confirm delete chat" onPress={onConfirmDelete} style={styles.confirmDeleteButton}><AppText weight="medium" style={styles.confirmDeleteText}>Delete</AppText></Pressable>
          </View>
        </View> : null}
      </View>)}
    </ScrollView>
  </View>;
}

function useMentorComposer(accountId: string | undefined, conversationId: string | undefined, allMessages: MentorMessage[], sendMentorMessage: ReturnType<typeof useSession>['sendMentorMessage']) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const persisted = pending ? allMessages.some((item) => item.turnKey === pending.turnKey) : false;
  const activePending = persisted ? null : pending;

  const submit = useCallback(async (body: string, existingTurnKey?: string) => {
    const trimmed = body.trim();
    if (!trimmed || !accountId || !conversationId) return;
    const turnKey = existingTurnKey ?? makeTurnKey();
    const userMessage: MentorMessage = { id: `pending-user-${turnKey}`, accountId, conversationId, role: 'user', body: trimmed, createdAt: new Date().toISOString(), turnKey };
    setMessage('');
    setPending({ turnKey, conversationId, userMessage, status: 'thinking' });
    const result = await sendMentorMessage(trimmed, turnKey, conversationId);
    if (!result.ok) setPending((current) => current?.turnKey === turnKey ? { ...current, status: 'failed', error: result.message } : current);
  }, [accountId, conversationId, sendMentorMessage]);

  const send = useCallback(async () => { if (!activePending) await submit(message); }, [activePending, message, submit]);
  const useTemplate = useCallback((prompt: string) => { if (!activePending) void submit(prompt); }, [activePending, submit]);
  const retry = useCallback(() => {
    if (activePending?.status === 'failed') void submit(activePending.userMessage.body, activePending.turnKey);
  }, [activePending, submit]);
  return { answerQuestion: useTemplate, message, pending: activePending, retry, send, setMessage, useTemplate };
}

function MentorComposer({ bottom, busy, ready, message, onChange, onSend }: { bottom: number; busy: boolean; ready: boolean; message: string; onChange: (value: string) => void; onSend: () => Promise<void> }) {
  const disabled = busy || !ready || !message.trim();
  return <View style={[styles.composerWrap, { paddingBottom: Math.max(bottom, 10) }]}>
    <View style={styles.composer}>
      <TextInput value={message} onChangeText={onChange} placeholder={busy ? 'You can type your next message…' : 'Message your AI mentor…'} placeholderTextColor={colors.muted} style={styles.input} multiline returnKeyType="send" blurOnSubmit={false} onSubmitEditing={onSend} />
      <Pressable accessibilityRole="button" accessibilityLabel={busy ? 'Waiting for mentor reply' : 'Send mentor question'} disabled={disabled} onPress={onSend} style={[styles.send, disabled && styles.sendDisabled]}>
        <Ionicons name="arrow-up" size={21} color={colors.white} />
      </Pressable>
    </View>
  </View>;
}

function selectedConversation(selectedId: string | null, conversations: MentorConversation[]) {
  if (selectedId) {
    const selected = conversations.find((item) => item.id === selectedId);
    if (selected) return selected;
  }
  return conversations[0];
}

function mentorUnavailable(hydrated: boolean, isClient: boolean) {
  return !hydrated || isClient;
}

function ownedConversations(conversations: MentorConversation[], accountId?: string) {
  return conversations
    .filter((item) => item.accountId === accountId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function messagesForConversation(messages: MentorMessage[], accountId?: string, conversationId?: string) {
  return messages.filter((item) => item.accountId === accountId && item.conversationId === conversationId);
}

function buildTranscript(conversation: MentorMessage[], messages: MentorMessage[], pending: PendingTurn | null, conversationId?: string): TranscriptItem[] {
  if (!pending || pending.conversationId !== conversationId) return conversation;
  if (messages.some((item) => item.turnKey === pending.turnKey)) return conversation;
  return [...conversation, pending.userMessage, { id: `pending-status-${pending.turnKey}`, role: 'status', status: pending.status, error: pending.error }];
}

function latestQuestionId(conversation: MentorMessage[]) {
  const latest = conversation.at(-1);
  return latest?.role === 'mentor' && latest.question ? latest.id : undefined;
}

function transcriptContentStyle(transcript: TranscriptItem[]) {
  return [styles.content, transcript.length === 0 && styles.emptyContent];
}

function useConversationControls({ conversations, createMentorConversation, deleteMentorConversation }: {
  conversations: MentorConversation[];
  createMentorConversation: ReturnType<typeof useSession>['createMentorConversation'];
  deleteMentorConversation: ReturnType<typeof useSession>['deleteMentorConversation'];
}) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | undefined>();
  const [conversationPendingDeletion, setConversationPendingDeletion] = useState<MentorConversation | undefined>();
  const closeHistory = useCallback(() => { setHistoryOpen(false); setConversationPendingDeletion(undefined); }, []);
  const openHistory = useCallback(() => setHistoryOpen(true), []);
  const selectConversation = useCallback((id: string) => { setSelectedConversationId(id); setHistoryOpen(false); }, []);
  const startNewChat = useCallback(async () => {
    const result = await createMentorConversation();
    if (!result.ok) { Alert.alert('Unable to start a chat', result.message); return; }
    setSelectedConversationId(result.conversationId);
    setHistoryOpen(false);
  }, [createMentorConversation]);
  const removeConversation = useCallback(async (conversationToDelete: MentorConversation) => {
    setDeletingConversationId(conversationToDelete.id);
    const result = await deleteMentorConversation(conversationToDelete.id);
    if (!result.ok) {
      setDeletingConversationId(undefined);
      Alert.alert('Unable to delete chat', result.message);
      return;
    }
    const nextConversation = conversations.find((item) => item.id !== conversationToDelete.id);
    const currentConversationId = selectedConversation(selectedConversationId, conversations)?.id;
    if (currentConversationId === conversationToDelete.id) setSelectedConversationId(nextConversation?.id ?? null);
    setDeletingConversationId(undefined);
    setConversationPendingDeletion(undefined);
    if (!nextConversation) await startNewChat();
  }, [conversations, deleteMentorConversation, selectedConversationId, startNewChat]);
  const requestConversationDeletion = useCallback((conversationToDelete: MentorConversation) => {
    setConversationPendingDeletion(conversationToDelete);
  }, []);
  const cancelConversationDeletion = useCallback(() => setConversationPendingDeletion(undefined), []);
  const confirmConversationDeletion = useCallback(() => {
    if (conversationPendingDeletion) void removeConversation(conversationPendingDeletion);
  }, [conversationPendingDeletion, removeConversation]);
  return { cancelConversationDeletion, closeHistory, confirmConversationDeletion, conversationPendingDeletion, deletingConversationId, historyOpen, openHistory, requestConversationDeletion, selectConversation, selectedConversationId, startNewChat };
}

export default function AiMentorScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<TranscriptItem>>(null);
  const ensuredAccount = useRef<string | null>(null);
  const { createMentorConversation, currentAccount, deleteMentorConversation, ensureMentorConversation, hydrated, mentorConversations, mentorMessages, sendMentorMessage } = useSession();
  const isClient = currentAccount?.role === 'client';
  const conversations = useMemo(() => ownedConversations(mentorConversations, currentAccount?.id), [currentAccount?.id, mentorConversations]);
  const controls = useConversationControls({ conversations, createMentorConversation, deleteMentorConversation });
  const { cancelConversationDeletion, closeHistory, confirmConversationDeletion, conversationPendingDeletion, deletingConversationId, historyOpen, openHistory, requestConversationDeletion, selectConversation, selectedConversationId, startNewChat } = controls;
  const activeConversation = selectedConversation(selectedConversationId, conversations);
  const activeConversationId = activeConversation?.id;
  const conversation = useMemo(() => messagesForConversation(mentorMessages, currentAccount?.id, activeConversationId), [activeConversationId, currentAccount?.id, mentorMessages]);
  const { answerQuestion, message, pending, retry, send, setMessage, useTemplate } = useMentorComposer(currentAccount?.id, activeConversationId, mentorMessages, sendMentorMessage);

  useEffect(() => {
    if (hydrated && isClient) router.replace('/client-home');
  }, [hydrated, isClient]);
  useEffect(() => {
    if (!hydrated || !currentAccount || isClient || ensuredAccount.current === currentAccount.id) return;
    ensuredAccount.current = currentAccount.id;
    void ensureMentorConversation();
  }, [currentAccount, ensureMentorConversation, hydrated, isClient]);

  const transcript = useMemo(() => buildTranscript(conversation, mentorMessages, pending, activeConversationId), [activeConversationId, conversation, mentorMessages, pending]);
  const answerableQuestionId = latestQuestionId(conversation);
  const renderItem = useCallback(({ item }: { item: TranscriptItem }) => <TranscriptRow answerableQuestionId={answerableQuestionId} item={item} onAnswer={answerQuestion} onRetry={retry} pending={Boolean(pending)} />, [answerQuestion, answerableQuestionId, pending, retry]);
  const emptyChat = useMemo(() => <EmptyChat accountName={currentAccount?.name} disabled={!activeConversationId} onTemplate={useTemplate} />, [activeConversationId, currentAccount?.name, useTemplate]);
  const scrollToBottom = useCallback(() => listRef.current?.scrollToEnd({ animated: true }), []);
  if (mentorUnavailable(hydrated, isClient)) return <MobilePage><View /></MobilePage>;

  if (historyOpen) return <MobilePage>
    <StatusBar style="light" />
    <AppHeader title="Your chats" onBack={closeHistory} />
    <ConversationHistory active={activeConversationId} confirming={conversationPendingDeletion} conversations={conversations} deleting={deletingConversationId} disabled={Boolean(pending)} onCancelDelete={cancelConversationDeletion} onConfirmDelete={confirmConversationDeletion} onDelete={requestConversationDeletion} onNew={startNewChat} onSelect={selectConversation} />
  </MobilePage>;

  return <MobilePage>
    <StatusBar style="light" />
    <AppHeader title="AI Project Mentor" onBack={leaveMentorScreen} right={<Pressable accessibilityRole="button" accessibilityLabel="Open chat history" onPress={openHistory} hitSlop={10}><Ionicons name="chatbubbles-outline" size={24} color={colors.white} /></Pressable>} />
    <PrivacyNotice />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList ref={listRef} testID="mentor-transcript" style={styles.list} data={transcript} keyExtractor={transcriptKey} renderItem={renderItem} ListEmptyComponent={emptyChat} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={transcriptContentStyle(transcript)} onContentSizeChange={scrollToBottom} initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7} removeClippedSubviews={Platform.OS === 'android'} />
      <MentorComposer bottom={insets.bottom} busy={Boolean(pending)} ready={Boolean(activeConversationId)} message={message} onChange={setMessage} onSend={send} />
    </KeyboardAvoidingView>
  </MobilePage>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, list: { flex: 1 }, disabled: { opacity: 0.5 },
  content: { flexGrow: 1, paddingHorizontal: contentPadding, paddingTop: 14, paddingBottom: 22 }, emptyContent: { justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.surface, paddingVertical: 9, paddingHorizontal: contentPadding, borderBottomWidth: 1, borderBottomColor: colors.border },
  noticeCopy: { flex: 1 }, noticeTitle: { color: colors.muted, fontSize: 9, lineHeight: 14 }, noticeDetail: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 3 },
  emptyChat: { alignItems: 'center', paddingBottom: 20 }, mentorAvatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { color: colors.ink, fontSize: 17, textAlign: 'center' }, emptySubtitle: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', maxWidth: 310, marginTop: 6 },
  templateGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 22 }, templateCard: { width: '48.5%', minHeight: 82, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13, backgroundColor: colors.white },
  templateTitle: { color: colors.ink, fontSize: 10, lineHeight: 15, marginTop: 9, paddingRight: 16 }, templateArrow: { position: 'absolute', right: 11, bottom: 11 },
  bubble: { maxWidth: '86%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 10 }, userBubble: { alignSelf: 'flex-end', backgroundColor: colors.red, borderBottomRightRadius: 5 }, mentorBubble: { alignSelf: 'flex-start', backgroundColor: colors.blush, borderBottomLeftRadius: 5 },
  questionBubble: { maxWidth: '96%', width: '96%' }, questionChoices: { marginTop: 12, gap: 7 }, questionChoice: { minHeight: 48, paddingVertical: 8, paddingHorizontal: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 10 },
  choiceNumber: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, choiceNumberText: { color: colors.ink, fontSize: 10 }, choiceCopy: { flex: 1 }, choiceLabel: { color: colors.ink, fontSize: 10, lineHeight: 15 }, choiceDescription: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 2 }, customAnswerHint: { color: colors.muted, fontSize: 8, marginTop: 3, paddingHorizontal: 4 },
  messageText: { color: colors.ink, fontSize: 11, lineHeight: 18 }, userMessageText: { color: colors.white }, thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10 }, thinkingText: { color: colors.muted, fontSize: 9 },
  failedBubble: { borderWidth: 1, borderColor: colors.blushStrong }, errorText: { color: colors.burgundy, fontSize: 9, lineHeight: 15 }, retryButton: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 8 }, retryText: { color: colors.burgundy, fontSize: 9 },
  composerWrap: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingTop: 10, backgroundColor: colors.white }, composer: { minHeight: 52, maxHeight: 120, borderWidth: 1, borderColor: colors.border, borderRadius: 26, flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 16, paddingRight: 5, paddingVertical: 4 },
  input: { flex: 1, maxHeight: 100, minHeight: 42, paddingTop: 10, paddingBottom: 8, fontFamily: font.regular, color: colors.ink, fontSize: 11 }, send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red }, sendDisabled: { backgroundColor: '#f39a9a' },
  historyPage: { flex: 1, backgroundColor: colors.white, paddingHorizontal: contentPadding, paddingTop: 18 },
  newChatButton: { minHeight: 48, borderRadius: 14, backgroundColor: colors.red, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, newChatText: { color: colors.white, fontSize: 10 },
  historyList: { marginTop: 14 }, historyListContent: { paddingBottom: 24 }, historyRow: { minHeight: 52, borderRadius: 12, paddingLeft: 12, paddingRight: 5, flexDirection: 'row', alignItems: 'center' }, historyRowActive: { backgroundColor: colors.blush }, historyRowMain: { minHeight: 52, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }, historyRowTitle: { flex: 1, fontSize: 10, color: colors.ink }, deleteChatButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  deleteConfirmation: { marginTop: 6, marginBottom: 10, marginHorizontal: 6, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.blushStrong, backgroundColor: colors.blush }, deleteConfirmationTitle: { fontSize: 12, color: colors.ink }, deleteConfirmationCopy: { marginTop: 4, fontSize: 9, lineHeight: 15, color: colors.muted }, deleteConfirmationActions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }, cancelDeleteButton: { minWidth: 72, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white }, confirmDeleteButton: { minWidth: 80, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.red }, confirmDeleteText: { color: colors.white },
});
