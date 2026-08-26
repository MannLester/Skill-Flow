import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';
import { DemoNotification, useSession } from '@/context/session';

type Filter = 'All' | 'Unread' | 'Mentions';

export default function NotificationsScreen() {
  const { currentAccount, markNotificationRead, notifications } = useSession();
  const [filter, setFilter] = useState<Filter>('All');
  const accountNotifications = useMemo(() => notifications.filter((item) => item.userId === currentAccount?.id), [currentAccount?.id, notifications]);
  const data = useMemo(() => accountNotifications.filter((item) => filter === 'All' || (filter === 'Unread' ? !item.read : item.kind === 'message')), [accountNotifications, filter]);
  const openNotification = (item: DemoNotification) => {
    markNotificationRead(item.id);
    if (item.projectPostId) { router.push({ pathname: '/project-posts/[postId]', params: { postId: item.projectPostId } }); return; }
    if (!item.projectId) return;
    if (item.kind === 'message') router.push({ pathname: '/messages/[projectId]', params: { projectId: item.projectId } });
    else router.push({ pathname: '/projects/[projectId]', params: { projectId: item.projectId } });
  };
  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Notifications" onBack={() => router.back()} />
      <View style={styles.tabs}>{(['All', 'Unread', 'Mentions'] as Filter[]).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.tab, filter === item && styles.tabActive]}><AppText weight="medium" style={[styles.tabText, filter === item && { color: colors.white }]}>{item}</AppText></Pressable>)}</View>
      <FlatList data={data} keyExtractor={(item) => item.id} renderItem={({ item }) => <NotificationRow item={item} onPress={() => openNotification(item)} />} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.empty}><Ionicons name="notifications-off-outline" size={48} color={colors.muted} /><AppText style={styles.emptyText}>No notifications here.</AppText></View>} />
    </MobilePage>
  );
}

function NotificationRow({ item, onPress }: { item: DemoNotification; onPress: () => void }) {
  const green = item.kind === 'payment' || item.kind === 'complete';
  const icon = item.kind === 'message' ? 'chatbubble-outline' : item.kind === 'payment' ? 'cash-outline' : item.kind === 'complete' ? 'checkbox-outline' : 'briefcase-outline';
  const time = new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.row, !item.read && styles.unreadRow]}>
      <View style={[styles.icon, { backgroundColor: green ? '#a9e7a9' : '#ef7777' }]}><Ionicons name={icon} size={24} color={green ? '#087a25' : colors.white} /></View>
      <View style={{ flex: 1 }}><AppText weight="semibold" style={styles.rowTitle}>{item.title}</AppText><AppText style={styles.detail}>{item.detail}</AppText></View>
      <View style={styles.timeWrap}>{!item.read ? <View style={styles.unreadDot} /> : null}<AppText style={styles.time}>{time}</AppText></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: contentPadding, paddingVertical: 13 }, tab: { flex: 1, minHeight: 45, borderWidth: 1, borderColor: colors.border, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, tabActive: { backgroundColor: colors.red, borderColor: colors.red }, tabText: { fontSize: 13 },
  list: { paddingHorizontal: contentPadding, flexGrow: 1 }, row: { minHeight: 103, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 4 }, unreadRow: { backgroundColor: '#fff8f8' }, icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, rowTitle: { fontSize: 14, lineHeight: 20 }, detail: { fontSize: 12, marginTop: 4 }, timeWrap: { alignSelf: 'flex-start', alignItems: 'flex-end', marginTop: 27 }, time: { color: colors.muted, fontSize: 9 }, unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red, marginBottom: 5 }, empty: { alignItems: 'center', paddingTop: 90 }, emptyText: { textAlign: 'center', color: colors.muted, marginTop: 12 },
});
