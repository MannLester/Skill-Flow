import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, BottomNav, MobilePage } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';
import { ProjectBooking, useSession } from '@/context/session';

export default function MessagesScreen() {
  const { bookings, currentAccount, homeRoute, messages } = useSession();
  const projects = currentAccount ? bookings.filter((booking) => booking.clientId === currentAccount.id || booking.studentId === currentAccount.id) : [];
  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Messages" onBack={() => router.back()} />
      <FlatList data={projects} keyExtractor={(item) => item.id} renderItem={({ item }) => <ThreadRow booking={item} />} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.empty}><Ionicons name="chatbubbles-outline" size={55} color={colors.muted} /><AppText weight="semibold" style={styles.emptyTitle}>No project conversations</AppText><AppText style={styles.emptyText}>A conversation becomes available when a service request or project is created.</AppText></View>} />
      <BottomNav active="messages" onHome={() => router.replace(homeRoute)} onProjects={() => router.push('/projects/index')} onPortfolio={currentAccount?.role === 'student' ? () => router.push('/portfolio/index') : undefined} onMessages={() => undefined} onSaved={currentAccount?.role === 'client' ? () => router.push({ pathname: '/marketplace', params: { saved: 'true' } }) : undefined} onProfile={() => router.push('/profile/index')} variant={currentAccount?.role === 'client' ? 'client' : 'student'} />
    </MobilePage>
  );

  function ThreadRow({ booking }: { booking: ProjectBooking }) {
    const thread = messages.filter((message) => message.projectId === booking.id);
    const latest = thread[thread.length - 1];
    const unread = currentAccount ? thread.filter((message) => message.senderId !== currentAccount.id && !message.readBy.includes(currentAccount.id)).length : 0;
    return <Pressable onPress={() => router.push({ pathname: '/messages/[projectId]', params: { projectId: booking.id } })} style={styles.row}><View style={styles.avatar}><Ionicons name="person" size={27} color={colors.burgundy} /></View><View style={{ flex: 1 }}><View style={styles.titleRow}><AppText weight="semibold" style={styles.title}>{booking.title}</AppText>{unread ? <View style={styles.badge}><AppText weight="bold" style={styles.badgeText}>{unread}</AppText></View> : null}</View><AppText style={styles.preview} numberOfLines={1}>{latest?.body ?? 'Start the project conversation.'}</AppText></View><Ionicons name="chevron-forward" size={21} color={colors.muted} /></Pressable>;
  }
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingHorizontal: contentPadding }, row: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, avatar: { width: 51, height: 51, borderRadius: 26, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 15 }, preview: { color: colors.muted, fontSize: 11, marginTop: 5 }, badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }, badgeText: { color: colors.white, fontSize: 10 }, empty: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 30 }, emptyTitle: { fontSize: 18, marginTop: 14 }, emptyText: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 19, marginTop: 7 },
});
