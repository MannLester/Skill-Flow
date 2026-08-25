import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BottomNav, MobilePage, QuickAction, ReferenceCrop } from '@/components/ui';
import { colors, contentPadding, shadow } from '@/constants/theme';
import { ProjectBooking, useSession } from '@/context/session';
import { formatPeso } from '@/data/fixtures';

const clientReference = require('../../references/client_profile_page.jpg');

export default function ClientHomeScreen() {
  const insets = useSafeAreaInsets();
  const { bookings, homeRoute, messages, currentAccount, projectPosts, unreadCount } = useSession();
  const hasUnreadMessages = currentAccount ? messages.some((message) => message.senderId !== currentAccount.id && !message.readBy.includes(currentAccount.id)) : false;
  const myBookings = currentAccount ? bookings.filter((booking) => booking.clientId === currentAccount.id) : [];
  const activeCount = myBookings.filter((booking) => !['declined', 'cancelled', 'completed', 'reviewed'].includes(booking.status)).length;
  const myPosts = currentAccount ? projectPosts.filter((post) => post.clientId === currentAccount.id) : [];
  return (
    <MobilePage>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { paddingTop: insets.top + 11 }]}>
          <View style={styles.topRow}>
            <Pressable accessibilityLabel="Open settings" onPress={() => router.push('/settings')}><Ionicons name="menu" size={31} color={colors.white} /></Pressable>
            <Pressable accessibilityLabel="Open notifications" onPress={() => router.push('/notifications')} style={styles.bellWrap}><Ionicons name="notifications-outline" size={28} color={colors.white} />{unreadCount ? <View style={styles.badge}><AppText weight="semibold" style={styles.badgeText}>{unreadCount}</AppText></View> : null}</Pressable>
          </View>
          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}><AppText weight="semibold" style={styles.greeting}>Hi, Mark! 👋</AppText><AppText style={styles.heroSubtitle}>Find the best student{`\n`}talent for your project.</AppText></View>
            <ReferenceCrop source={clientReference} sourceSize={{ width: 1920, height: 1080 }} crop={{ x: 1010, y: 116, width: 141, height: 128 }} style={styles.avatar} />
          </View>
        </View>
        <View style={styles.body}>
          <Pressable onPress={() => router.push('/projects')} style={styles.activeCard}>
            <View><AppText weight="semibold" style={styles.activeTitle}>Active Projects</AppText><AppText weight="bold" style={styles.activeCount}>{activeCount}</AppText><AppText style={styles.activeStatus}>From local demo activity</AppText></View>
            <Ionicons name="briefcase" size={65} color={colors.red} />
          </Pressable>
          <View style={styles.sectionTitle}><AppText weight="semibold" style={styles.sectionText}>Quick Actions</AppText></View>
          <View style={styles.quickRow}>
            <QuickAction icon="checkbox-outline" label={'Post a\nProject'} onPress={() => router.push('/project-posts/new')} />
            <QuickAction icon="briefcase-outline" label={'My\nProjects'} onPress={() => router.push('/projects')} />
            <QuickAction icon="mail-outline" label="Messages" onPress={() => router.push('/messages/index')} />
            <QuickAction icon="search-circle-outline" label={'Find\nDesigners'} onPress={() => router.push('/marketplace')} />
          </View>
          <View style={styles.titleRow}><AppText weight="semibold" style={styles.sectionText}>Recent Projects</AppText><Pressable onPress={() => router.push('/projects')}><AppText weight="medium" style={styles.viewAll}>View All</AppText></Pressable></View>
          <View style={styles.projectList}>
            {myBookings.length ? myBookings.slice(0, 3).map((booking, index) => <BookingRow key={booking.id} booking={booking} last={index === Math.min(myBookings.length, 3) - 1} />) : myPosts.length ? myPosts.slice(0, 3).map((post) => <Pressable key={post.id} onPress={() => router.push({ pathname: '/project-posts/[postId]', params: { postId: post.id } })} style={styles.projectRow}><View style={styles.bookingIcon}><Ionicons name="document-text" size={26} color={colors.red} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={{ fontSize: 14 }}>{post.title}</AppText><AppText style={styles.emptyProjectText}>{post.status} · {post.category}</AppText></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>) : <View style={styles.emptyProjects}><AppText weight="medium">No project activity yet.</AppText><AppText style={styles.emptyProjectText}>Post a project or request a student service to begin.</AppText></View>}
          </View>
        </View>
      </ScrollView>
      <BottomNav active="home" onHome={() => router.replace(homeRoute)} onProjects={() => router.push('/projects')} onMessages={() => router.push('/messages/index')} onSaved={() => router.push({ pathname: '/marketplace', params: { saved: 'true' } })} onProfile={() => router.push('/profile/index')} messageUnread={hasUnreadMessages} variant="client" />
    </MobilePage>
  );
}

function BookingRow({ booking, last }: { booking: ProjectBooking; last: boolean }) {
  return <Pressable onPress={() => router.push({ pathname: '/projects/[projectId]', params: { projectId: booking.id } })} style={[styles.projectRow, last && { borderBottomWidth: 0 }]}><View style={styles.bookingIcon}><Ionicons name="briefcase" size={26} color={colors.red} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={{ fontSize: 14 }}>{booking.title}</AppText><AppText weight="semibold" style={{ marginTop: 7, fontSize: 14 }}>{formatPeso(booking.budget)}</AppText></View><View style={styles.proposals}><AppText style={{ color: colors.burgundy, fontSize: 9, textTransform: 'capitalize' }}>{booking.status.replaceAll('_', ' ')}</AppText></View></Pressable>;
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 30 }, hero: { backgroundColor: colors.red, paddingHorizontal: contentPadding, paddingBottom: 78 }, topRow: { flexDirection: 'row', justifyContent: 'space-between' }, bellWrap: { position: 'relative' }, badge: { position: 'absolute', right: -6, top: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#e56a6a', alignItems: 'center', justifyContent: 'center' }, badgeText: { color: colors.white, fontSize: 10 },
  greetingRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center' }, greeting: { color: colors.white, fontSize: 29 }, heroSubtitle: { color: colors.white, fontSize: 17, lineHeight: 25 }, avatar: { width: 112, borderRadius: 60 },
  body: { backgroundColor: colors.white, paddingHorizontal: contentPadding, marginTop: -50 }, activeCard: { minHeight: 145, backgroundColor: colors.white, borderRadius: 17, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadow }, activeTitle: { fontSize: 20 }, activeCount: { fontSize: 30, marginTop: 3 }, activeStatus: { color: colors.muted, fontSize: 14 },
  sectionTitle: { marginTop: 24, marginBottom: 14 }, sectionText: { fontSize: 18 }, quickRow: { flexDirection: 'row', gap: 4 }, titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 27, marginBottom: 12 }, viewAll: { color: colors.burgundy, fontSize: 14 },
  projectList: { borderRadius: 14, paddingHorizontal: 10, backgroundColor: colors.white, ...shadow }, projectRow: { minHeight: 91, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, bookingIcon: { width: 66, height: 66, borderRadius: 10, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, proposals: { backgroundColor: colors.blush, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6 }, emptyProjects: { minHeight: 110, alignItems: 'center', justifyContent: 'center' }, emptyProjectText: { color: colors.muted, fontSize: 10, marginTop: 4 },
});
