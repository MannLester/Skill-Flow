import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { DashboardHomeHero, DashboardHomeShell } from '@/components/dashboard-home-shell';
import { AppText, QuickAction } from '@/components/ui';
import { colors, shadow } from '@/constants/theme';
import { ProjectBooking, useSession } from '@/context/session.remote';
import { formatPeso } from '@/data/fixtures';
import { countActiveProjects } from '@/domain/project-status';

export default function ClientHomeScreen() {
  const { bookings, currentAccount, projectPosts, unreadCount } = useSession();
  const myBookings = currentAccount ? bookings.filter((booking) => booking.clientId === currentAccount.id) : [];
  const activeCount = countActiveProjects(myBookings);
  const myPosts = currentAccount ? projectPosts.filter((post) => post.clientId === currentAccount.id) : [];
  return <>
    <DashboardHomeShell
      role="client"
      hero={<DashboardHomeHero role="client" accountName={currentAccount?.name} activeCount={activeCount} unreadCount={unreadCount} onNotifications={() => router.push('/notifications')} />}
      featured={
        <View style={styles.activeCard}>
          <View style={styles.activeCardBody}>
            <AppText weight="semibold" style={styles.activeTitle}>Active Projects</AppText>
            <AppText weight="bold" style={styles.activeCount}>{activeCount}</AppText>
            <AppText style={styles.activeStatus}>Synced with SkillFlow Cloud</AppText>
          </View>
          <View style={styles.activeCardIcon}>
            <Ionicons name="briefcase" size={32} color={colors.red} />
          </View>
        </View>
      }
      featuredOnPress={() => router.push('/projects')}
      body={
        <>
          <View style={styles.sectionTitle}><AppText weight="semibold" style={styles.sectionText}>Quick Actions</AppText></View>
          <View style={styles.quickRow}>
            <QuickAction icon="add-circle" label={'Post a\nProject'} onPress={() => router.push('/project-posts/new')} />
            <QuickAction icon="briefcase" label={'My\nProjects'} onPress={() => router.push('/projects')} />
            <QuickAction icon="mail" label="Messages" onPress={() => router.push('/messages')} />
            <QuickAction icon="search" label={'Find\nDesigners'} onPress={() => router.push('/marketplace')} />
          </View>
          <View style={styles.titleRow}><AppText weight="semibold" style={styles.sectionText}>Recent Projects</AppText><Pressable onPress={() => router.push('/projects')}><AppText weight="medium" style={styles.viewAll}>View All</AppText></Pressable></View>
          <View style={styles.projectList}>
            {myBookings.length ? myBookings.slice(0, 3).map((booking, index) => <BookingRow key={booking.id} booking={booking} last={index === Math.min(myBookings.length, 3) - 1} />) : myPosts.length ? myPosts.slice(0, 3).map((post) => <Pressable key={post.id} onPress={() => router.push({ pathname: '/project-posts/[postId]', params: { postId: post.id } })} style={styles.projectRow}><View style={styles.bookingIcon}><Ionicons name="document-text" size={26} color={colors.red} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={{ fontSize: 14 }}>{post.title}</AppText><AppText style={styles.emptyProjectText}>{post.status} - {post.category}</AppText></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>) : <View style={styles.emptyProjects}><AppText weight="medium">No project activity yet.</AppText><AppText style={styles.emptyProjectText}>Post a project or request a student service to begin.</AppText></View>}
          </View>
        </>
      }
    />
  </>;
}

function BookingRow({ booking, last }: { booking: ProjectBooking; last: boolean }) {
  return <Pressable onPress={() => router.push({ pathname: '/projects/[projectId]', params: { projectId: booking.id } })} style={[styles.projectRow, last && { borderBottomWidth: 0 }]}><View style={styles.bookingIcon}><Ionicons name="briefcase" size={26} color={colors.red} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={{ fontSize: 14 }}>{booking.title}</AppText><AppText weight="semibold" style={{ marginTop: 7, fontSize: 14 }}>{formatPeso(booking.budget)}</AppText></View><View style={styles.proposals}><AppText style={{ color: colors.burgundy, fontSize: 9, textTransform: 'capitalize' }}>{booking.status.replaceAll('_', ' ')}</AppText></View></Pressable>;
}

const styles = StyleSheet.create({
  activeCard: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }, activeCardBody: { flex: 1, gap: 4 }, activeTitle: { fontSize: 20, marginBottom: 4 }, activeCount: { fontSize: 30, marginTop: 1 }, activeStatus: { color: colors.muted, fontSize: 13 }, activeCardIcon: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { marginTop: 24, marginBottom: 14 }, sectionText: { fontSize: 18 }, quickRow: { flexDirection: 'row', gap: 4 }, titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 27, marginBottom: 12 }, viewAll: { color: colors.burgundy, fontSize: 14 },
  projectList: { borderRadius: 14, paddingHorizontal: 10, backgroundColor: colors.white, ...shadow }, projectRow: { minHeight: 91, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, bookingIcon: { width: 66, height: 66, borderRadius: 10, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, proposals: { backgroundColor: colors.blush, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6 }, emptyProjects: { minHeight: 110, alignItems: 'center', justifyContent: 'center' }, emptyProjectText: { color: colors.muted, fontSize: 10, marginTop: 4 },
});
