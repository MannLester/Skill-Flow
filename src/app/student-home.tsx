import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BottomNav, MobilePage, QuickAction, ReferenceCrop } from '@/components/ui';
import { colors, contentPadding, shadow } from '@/constants/theme';
import { ProjectBooking, ProjectPost, useSession } from '@/context/session';
import { CareerReadinessBreakdown } from '@/domain/career-readiness';
import { formatPeso } from '@/data/fixtures';

const studentReference = require('../../references/student_profile_page.jpg');

export default function StudentHomeScreen() {
  const insets = useSafeAreaInsets();
  const { bookings, getCareerReadiness, homeRoute, ledger, messages, currentAccount, projectPosts, unreadCount } = useSession();
  const hasUnreadMessages = currentAccount ? messages.some((message) => message.senderId !== currentAccount.id && !message.readBy.includes(currentAccount.id)) : false;
  const myBookings = currentAccount ? bookings.filter((booking) => booking.studentId === currentAccount.id) : [];
  const latestBooking = myBookings[0];
  const earnings = currentAccount ? ledger.filter((entry) => entry.userId === currentAccount.id && entry.type === 'release').reduce((total, entry) => total + entry.amount, 0) : 0;
  const readiness = currentAccount ? getCareerReadiness(currentAccount.id) : null;
  return (
    <MobilePage>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <StudentHero insetsTop={insets.top} unreadCount={unreadCount} />
        <View style={styles.body}>
          <StudentEarnings earnings={earnings} />
          <StudentReadiness readiness={readiness} />
          <SectionTitle title="Quick Actions" />
          <View style={styles.quickRow}>
            <QuickAction icon="person-outline" label={'Browse\nProjects'} onPress={() => router.push('/projects/discover')} />
            <QuickAction icon="briefcase-outline" label={'My\nPortfolio'} onPress={() => router.push('/portfolio')} />
            <QuickAction icon="hardware-chip-outline" label="AI Mentor" onPress={() => router.push('/ai-mentor')} />
            <QuickAction icon="chatbubble-outline" label="Messages" onPress={() => router.push('/messages')} />
          </View>
          <SectionTitle title="Recent Projects" action="View All" onAction={() => router.push('/projects')} />
          <RecentProjectCard booking={latestBooking} />
          <SectionTitle title="Recommended for You" action="View All" onAction={() => router.push('/projects/discover')} />
          <RecommendedProjectCard projectPosts={projectPosts} />
        </View>
      </ScrollView>
      <StudentBottomNav homeRoute={homeRoute} messageUnread={hasUnreadMessages} />
    </MobilePage>
  );
}

function StudentHero({ insetsTop, unreadCount }: { insetsTop: number; unreadCount: number }) {
  return <View style={[styles.hero, { paddingTop: insetsTop + 11 }]}>
    <View style={styles.topRow}>
      <Pressable accessibilityLabel="Open settings" onPress={() => router.push('/settings')}><Ionicons name="menu" size={32} color={colors.white} /></Pressable>
      <Pressable accessibilityLabel="Open notifications" onPress={() => router.push('/notifications')} style={styles.bellWrap}><Ionicons name="notifications-outline" size={29} color={colors.white} />{unreadCount ? <View style={styles.badge}><AppText weight="semibold" style={styles.badgeText}>{unreadCount}</AppText></View> : null}</Pressable>
    </View>
    <View style={styles.greetingRow}>
      <View style={{ flex: 1 }}><AppText weight="semibold" style={styles.greeting}>Hi, Alex! 👋</AppText><AppText style={styles.heroSubtitle}>Ready to work on{`\n`}amazing projects?</AppText></View>
      <ReferenceCrop source={studentReference} sourceSize={{ width: 704, height: 1486 }} crop={{ x: 493, y: 229, width: 127, height: 146 }} style={styles.avatar} />
    </View>
  </View>;
}

function StudentEarnings({ earnings }: { earnings: number }) {
  return <View style={styles.earningsCard}>
    <AppText weight="semibold" style={styles.cardTitle}>Earnings Overview</AppText>
    <View style={styles.earningsRow}>
      <View><AppText weight="bold" style={styles.earnings}>{formatPeso(earnings)}</AppText><View style={{ flexDirection: 'row', gap: 8 }}><AppText style={styles.muted}>Simulated Earnings</AppText>{earnings ? <AppText weight="medium" style={styles.growth}>Released</AppText> : null}</View></View>
      <Sparkline />
    </View>
  </View>;
}

function StudentReadiness({ readiness }: { readiness: CareerReadinessBreakdown | null }) {
  if (!readiness) return null;
  return <Pressable onPress={() => router.push('/career-readiness')} style={styles.readinessCard}><View style={styles.readinessCircle}><AppText weight="bold" style={styles.readinessValue}>{readiness.score}</AppText><AppText style={styles.readinessMax}>/100</AppText></View><View style={{ flex: 1 }}><AppText weight="semibold" style={styles.readinessTitle}>Career Readiness</AppText><AppText style={styles.readinessDetail}>{readiness.level} · See what to improve next</AppText></View><Ionicons name="chevron-forward" size={22} color={colors.burgundy} /></Pressable>;
}

function RecentProjectCard({ booking }: { booking?: ProjectBooking }) {
  return <Pressable disabled={!booking} onPress={() => booking && router.push({ pathname: '/projects/[projectId]', params: { projectId: booking.id } })} style={styles.projectCard}>
    <ReferenceCrop source={studentReference} sourceSize={{ width: 704, height: 1486 }} crop={{ x: 96, y: 995, width: 122, height: 117 }} style={styles.projectImage} />
    <View style={{ flex: 1 }}><AppText weight="semibold" style={styles.projectTitle}>{booking?.title ?? 'No project requests yet'}</AppText><AppText weight="semibold" style={styles.projectPrice}>{booking ? formatPeso(booking.budget) : 'Browse projects to get started'}</AppText></View>
    {booking ? <View style={styles.statusPill}><AppText style={styles.statusText}>{booking.status.replaceAll('_', ' ')}</AppText></View> : null}
  </Pressable>;
}

function RecommendedProjectCard({ projectPosts }: { projectPosts: ProjectPost[] }) {
  const openPost = projectPosts.find((item) => item.status === 'open');
  const openProject = () => {
    if (openPost) router.push({ pathname: '/project-posts/[postId]', params: { postId: openPost.id } });
    else router.push('/projects/discover');
  };
  return <Pressable onPress={openProject} style={styles.recommendCard}><View style={styles.recommendImage}><Ionicons name="phone-portrait-outline" size={31} color={colors.red} /></View><View><AppText weight="semibold">{openPost?.title ?? 'Discover Open Projects'}</AppText><AppText style={styles.muted}>Recommended project</AppText></View></Pressable>;
}

function StudentBottomNav({ homeRoute, messageUnread }: { homeRoute: '/student-home' | '/client-home'; messageUnread: boolean }) {
  return <BottomNav active="home" onHome={() => router.replace(homeRoute)} onProjects={() => router.push('/projects')} onPortfolio={() => router.push('/portfolio')} onMessages={() => router.push('/messages')} onProfile={() => router.push('/profile')} messageUnread={messageUnread} variant="student" />;
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionTitle}><AppText weight="semibold" style={{ fontSize: 19 }}>{title}</AppText>{action ? <Pressable disabled={!onAction} onPress={onAction}><AppText weight="medium" style={{ color: colors.burgundy, fontSize: 14 }}>{action}</AppText></Pressable> : null}</View>;
}

function Sparkline() {
  return (
    <View style={styles.spark}>
      <View style={[styles.line, { left: 3, top: 42, width: 32, transform: [{ rotate: '-18deg' }] }]} />
      <View style={[styles.line, { left: 31, top: 34, width: 27, transform: [{ rotate: '16deg' }] }]} />
      <View style={[styles.line, { left: 54, top: 29, width: 30, transform: [{ rotate: '-34deg' }] }]} />
      <View style={[styles.line, { left: 79, top: 20, width: 34, transform: [{ rotate: '-49deg' }] }]} />
      <View style={styles.sparkDot} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 30 }, hero: { backgroundColor: colors.red, paddingHorizontal: contentPadding, paddingBottom: 82 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, bellWrap: { position: 'relative' }, badge: { position: 'absolute', right: -6, top: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#ef8585', alignItems: 'center', justifyContent: 'center' }, badgeText: { color: colors.white, fontSize: 10 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 }, greeting: { color: colors.white, fontSize: 31 }, heroSubtitle: { color: colors.white, fontSize: 17, lineHeight: 25, marginTop: 5 }, avatar: { width: 112, borderRadius: 60 },
  body: { backgroundColor: colors.white, paddingHorizontal: contentPadding, marginTop: -55 }, earningsCard: { borderRadius: 18, backgroundColor: colors.white, padding: 20, minHeight: 170, ...shadow }, cardTitle: { fontSize: 20 }, earningsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }, earnings: { fontSize: 30 }, muted: { color: colors.muted, fontSize: 13 }, growth: { color: colors.green, fontSize: 13 }, readinessCard: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 15, borderRadius: 14, padding: 13, backgroundColor: colors.blush }, readinessCircle: { width: 57, height: 57, borderRadius: 29, borderWidth: 4, borderColor: colors.red, alignItems: 'center', justifyContent: 'center' }, readinessValue: { color: colors.red, fontSize: 19, lineHeight: 21 }, readinessMax: { color: colors.burgundy, fontSize: 7 }, readinessTitle: { fontSize: 15 }, readinessDetail: { color: colors.muted, fontSize: 9, marginTop: 3 },
  spark: { width: 120, height: 70, position: 'relative' }, line: { position: 'absolute', height: 2, backgroundColor: colors.burgundy, borderRadius: 2 }, sparkDot: { position: 'absolute', right: 3, top: 3, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 29, marginBottom: 16 }, quickRow: { flexDirection: 'row', gap: 4 },
  projectCard: { backgroundColor: colors.white, borderRadius: 14, minHeight: 128, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 14, ...shadow }, projectImage: { width: 92, borderRadius: 11 }, projectTitle: { fontSize: 16, lineHeight: 21 }, projectPrice: { marginTop: 10, fontSize: 15 }, statusPill: { backgroundColor: colors.blush, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }, statusText: { color: colors.burgundy, fontSize: 11 },
  recommendCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, backgroundColor: colors.white, padding: 12, ...shadow }, recommendImage: { width: 72, height: 62, borderRadius: 10, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
});
