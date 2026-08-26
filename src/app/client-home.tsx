import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, MobilePage, QuickAction } from '@/components/ui';
import { colors, contentPadding, shadow } from '@/constants/theme';
import { ProjectBooking, useSession } from '@/context/session';
import { formatPeso } from '@/data/fixtures';
import { PrimaryTabScene } from '@/navigation/primary-navigation';

export default function ClientHomeScreen() {
  const insets = useSafeAreaInsets();
  const { bookings, currentAccount, projectPosts, unreadCount } = useSession();
  const myBookings = currentAccount ? bookings.filter((booking) => booking.clientId === currentAccount.id) : [];
  const activeCount = myBookings.filter((booking) => !['declined', 'cancelled', 'completed', 'reviewed'].includes(booking.status)).length;
  const myPosts = currentAccount ? projectPosts.filter((post) => post.clientId === currentAccount.id) : [];
  return (
    <PrimaryTabScene active="home"><MobilePage backgroundColor={colors.red}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
          <View style={styles.topRow}>
            <Pressable accessibilityLabel="Open notifications" onPress={() => router.push('/notifications')} style={styles.bellWrap}><Ionicons name="notifications-outline" size={28} color={colors.white} />{unreadCount ? <View style={styles.badge}><AppText weight="semibold" style={styles.badgeText}>{unreadCount}</AppText></View> : null}</Pressable>
          </View>
          <View style={styles.greetingRow}>
            <View style={{ flex: 1, paddingRight: 16 }}><AppText weight="bold" style={styles.greeting}>Hi, Mark!</AppText><AppText style={styles.heroSubtitle}>{activeCount > 0 ? `You have ${activeCount} active project${activeCount === 1 ? '' : 's'} in progress.` : 'Find the best student talent for your project.'}</AppText></View>
            <View style={styles.avatarCircle}><Ionicons name="person" size={28} color={colors.red} /></View>
          </View>
        </View>
        <Pressable onPress={() => router.push('/projects')} style={styles.activeCard}>
          <View style={styles.activeCardBody}>
            <AppText weight="semibold" style={styles.activeTitle}>Active Projects</AppText>
            <AppText weight="bold" style={styles.activeCount}>{activeCount}</AppText>
            <AppText style={styles.activeStatus}>From local demo activity</AppText>
          </View>
          <View style={styles.activeCardIcon}>
            <Ionicons name="briefcase" size={32} color={colors.red} />
          </View>
        </Pressable>
        <View style={styles.body}>
          <View style={styles.sectionTitle}><AppText weight="semibold" style={styles.sectionText}>Quick Actions</AppText></View>
          <View style={styles.quickRow}>
            <QuickAction icon="checkbox-outline" label={'Post a\nProject'} onPress={() => router.push('/project-posts/new')} />
            <QuickAction icon="briefcase-outline" label={'My\nProjects'} onPress={() => router.push('/projects')} />
            <QuickAction icon="mail-outline" label="Messages" onPress={() => router.push('/messages')} />
            <QuickAction icon="search-circle-outline" label={'Find\nDesigners'} onPress={() => router.push('/marketplace')} />
          </View>
          <View style={styles.titleRow}><AppText weight="semibold" style={styles.sectionText}>Recent Projects</AppText><Pressable onPress={() => router.push('/projects')}><AppText weight="medium" style={styles.viewAll}>View All</AppText></Pressable></View>
          <View style={styles.projectList}>
            {myBookings.length ? myBookings.slice(0, 3).map((booking, index) => <BookingRow key={booking.id} booking={booking} last={index === Math.min(myBookings.length, 3) - 1} />) : myPosts.length ? myPosts.slice(0, 3).map((post) => <Pressable key={post.id} onPress={() => router.push({ pathname: '/project-posts/[postId]', params: { postId: post.id } })} style={styles.projectRow}><View style={styles.bookingIcon}><Ionicons name="document-text" size={26} color={colors.red} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={{ fontSize: 14 }}>{post.title}</AppText><AppText style={styles.emptyProjectText}>{post.status} · {post.category}</AppText></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>) : <View style={styles.emptyProjects}><AppText weight="medium">No project activity yet.</AppText><AppText style={styles.emptyProjectText}>Post a project or request a student service to begin.</AppText></View>}
          </View>
        </View>
      </ScrollView>
    </MobilePage></PrimaryTabScene>
  );
}

function BookingRow({ booking, last }: { booking: ProjectBooking; last: boolean }) {
  return <Pressable onPress={() => router.push({ pathname: '/projects/[projectId]', params: { projectId: booking.id } })} style={[styles.projectRow, last && { borderBottomWidth: 0 }]}><View style={styles.bookingIcon}><Ionicons name="briefcase" size={26} color={colors.red} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={{ fontSize: 14 }}>{booking.title}</AppText><AppText weight="semibold" style={{ marginTop: 7, fontSize: 14 }}>{formatPeso(booking.budget)}</AppText></View><View style={styles.proposals}><AppText style={{ color: colors.burgundy, fontSize: 9, textTransform: 'capitalize' }}>{booking.status.replaceAll('_', ' ')}</AppText></View></Pressable>;
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 30 },   hero: { backgroundColor: colors.red, paddingHorizontal: 24, paddingBottom: 87 }, topRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }, bellWrap: { position: 'relative' }, badge: { position: 'absolute', right: -6, top: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#e56a6a', alignItems: 'center', justifyContent: 'center' }, badgeText: { color: colors.white, fontSize: 10 },
  greetingRow: { marginTop: 24, flexDirection: 'row', alignItems: 'center' }, greeting: { color: colors.white, fontSize: 28 }, heroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22 }, avatarCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  body: { backgroundColor: colors.white, paddingHorizontal: contentPadding, marginTop: -55, borderTopLeftRadius: 42, borderTopRightRadius: 42, paddingTop: 52, overflow: 'hidden' },   activeCard: { minHeight: 150, backgroundColor: colors.white, borderRadius: 17, padding: 20, marginTop: -42, marginHorizontal: 24, zIndex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, ...shadow }, activeCardBody: { flex: 1, gap: 2 }, activeTitle: { fontSize: 20 }, activeCount: { fontSize: 30, marginTop: 3 }, activeStatus: { color: colors.muted, fontSize: 13 }, activeCardIcon: { width: 72, height: 72, borderRadius: 14, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { marginTop: 24, marginBottom: 14 }, sectionText: { fontSize: 18 }, quickRow: { flexDirection: 'row', gap: 4 }, titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 27, marginBottom: 12 }, viewAll: { color: colors.burgundy, fontSize: 14 },
  projectList: { borderRadius: 14, paddingHorizontal: 10, backgroundColor: colors.white, ...shadow }, projectRow: { minHeight: 91, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, bookingIcon: { width: 66, height: 66, borderRadius: 10, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, proposals: { backgroundColor: colors.blush, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6 }, emptyProjects: { minHeight: 110, alignItems: 'center', justifyContent: 'center' }, emptyProjectText: { color: colors.muted, fontSize: 10, marginTop: 4 },
});
