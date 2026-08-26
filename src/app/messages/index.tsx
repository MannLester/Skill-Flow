import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { memo, useCallback, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';
import { ProjectBooking, ProjectMessage, useSession } from '@/context/session.remote';
import { PrimaryTabScene } from '@/navigation/primary-navigation';

export type ThreadSummary = { latest?: ProjectMessage; unread: number };

export function buildThreadSummaries(messages: ProjectMessage[], accountId?: string): Map<string, ThreadSummary> {
  const summaries = new Map<string, ThreadSummary>();
  messages.forEach((message) => {
    const summary = summaries.get(message.projectId) ?? { unread: 0 };
    summary.latest = message;
    if (accountId && message.senderId !== accountId && !message.readBy.includes(accountId)) summary.unread += 1;
    summaries.set(message.projectId, summary);
  });
  return summaries;
}

function messageKeyExtractor(item: ProjectBooking) {
  return item.id;
}

function MessagesEmptyState() {
  return <View style={styles.empty}><Ionicons name="chatbubbles-outline" size={55} color={colors.muted} /><AppText weight="semibold" style={styles.emptyTitle}>No project conversations</AppText><AppText style={styles.emptyText}>A conversation becomes available when a service request or project is created.</AppText></View>;
}

export default function MessagesScreen() {
  const { bookings, currentAccount, messages } = useSession();
  const accountId = currentAccount?.id;
  const projects = useMemo(() => accountId ? bookings.filter((booking) => booking.clientId === accountId || booking.studentId === accountId) : [], [accountId, bookings]);
  const summaries = useMemo(() => buildThreadSummaries(messages, accountId), [accountId, messages]);
  const renderItem = useCallback(({ item }: { item: ProjectBooking }) => <ThreadRow booking={item} summary={summaries.get(item.id)} />, [summaries]);
  return (
    <PrimaryTabScene active="messages"><MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Messages" />
      <FlatList data={projects} keyExtractor={messageKeyExtractor} renderItem={renderItem} contentContainerStyle={styles.list} ListEmptyComponent={MessagesEmptyState} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews={Platform.OS === 'android'} />
    </MobilePage></PrimaryTabScene>
  );
}

const ThreadRow = memo(function ThreadRow({ booking, summary }: { booking: ProjectBooking; summary?: ThreadSummary }) {
  return <Pressable onPress={() => router.push({ pathname: '/messages/[projectId]', params: { projectId: booking.id } })} style={styles.row}><View style={styles.avatar}><Ionicons name="person" size={27} color={colors.burgundy} /></View><View style={{ flex: 1 }}><View style={styles.titleRow}><AppText weight="semibold" style={styles.title}>{booking.title}</AppText>{summary?.unread ? <View style={styles.badge}><AppText weight="bold" style={styles.badgeText}>{summary.unread}</AppText></View> : null}</View><AppText style={styles.preview} numberOfLines={1}>{summary?.latest?.body ?? 'Start the project conversation.'}</AppText></View><Ionicons name="chevron-forward" size={21} color={colors.muted} /></Pressable>;
});

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingHorizontal: contentPadding }, row: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, avatar: { width: 51, height: 51, borderRadius: 26, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 15 }, preview: { color: colors.muted, fontSize: 11, marginTop: 5 }, badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }, badgeText: { color: colors.white, fontSize: 10 }, empty: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 30 }, emptyTitle: { fontSize: 18, marginTop: 14 }, emptyText: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 19, marginTop: 7 },
});
