import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Svg, Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OptimizedArtwork, optimizedArtwork } from '@/components/optimized-artwork';
import { AppText, MobilePage, QuickAction } from '@/components/ui';
import { colors, contentPadding, shadow } from '@/constants/theme';
import { ProjectBooking, ProjectPost, useSession } from '@/context/session';
import { CareerReadinessBreakdown } from '@/domain/career-readiness';
import { formatPeso } from '@/data/fixtures';
import { PrimaryTabScene } from '@/navigation/primary-navigation';

export default function StudentHomeScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { bookings, getCareerReadiness, ledger, currentAccount, projectPosts, unreadCount } = useSession();
  const myBookings = currentAccount ? bookings.filter((booking) => booking.studentId === currentAccount.id) : [];
  const latestBooking = myBookings[0];
  const earnings = currentAccount ? ledger.filter((entry) => entry.userId === currentAccount.id && entry.type === 'release').reduce((total, entry) => total + entry.amount, 0) : 0;
  const readiness = currentAccount ? getCareerReadiness(currentAccount.id) : null;
  return (
    <PrimaryTabScene active="home"><MobilePage>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ minHeight: screenHeight }}>
        <StudentHero insetsTop={insets.top} unreadCount={unreadCount} activeCount={myBookings.filter((b) => !['declined', 'cancelled', 'completed', 'reviewed'].includes(b.status)).length} />
        <View style={{ backgroundColor: colors.red, height: 97 }} />
        <StudentEarnings earnings={earnings} />
        <View style={[styles.body, { flex: 1 }]}>
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
        </View>
      </ScrollView>
    </MobilePage></PrimaryTabScene>
  );
}

function StudentHero({ insetsTop, unreadCount, activeCount }: { insetsTop: number; unreadCount: number; activeCount: number }) {
  const subtitle = activeCount > 0
    ? `You have ${activeCount} active project${activeCount === 1 ? '' : 's'} in progress.`
    : 'Explore new project opportunities today.';
  return <View style={[styles.hero, { paddingTop: insetsTop + 28 }]}>
    <View style={styles.topRow}>
      <Pressable accessibilityLabel="Open notifications" onPress={() => router.push('/notifications')} style={styles.bellWrap}><Ionicons name="notifications-outline" size={29} color={colors.white} />{unreadCount ? <View style={styles.badge}><AppText weight="semibold" style={styles.badgeText}>{unreadCount}</AppText></View> : null}</Pressable>
    </View>
    <View style={styles.greetingRow}>
      <View style={{ flex: 1, paddingRight: 16 }}><AppText weight="bold" style={styles.greeting}>Hi, Alex!</AppText><AppText style={styles.heroSubtitle}>{subtitle}</AppText></View>
      <View style={styles.avatarCircle}><Ionicons name="person" size={28} color={colors.red} /></View>
    </View>
  </View>;
}

function StudentEarnings({ earnings }: { earnings: number }) {
  return <View style={styles.earningsCard}>
    <AppText weight="semibold" style={styles.cardTitle}>Earnings Overview</AppText>
    <View style={styles.earningsRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <AppText weight="bold" style={styles.pesoSign}>₱</AppText>
          <AppText weight="bold" style={styles.earnings}>{earnings.toLocaleString('en-PH')}</AppText>
        </View>
        <AppText style={styles.muted}>Simulated Earnings</AppText>
      </View>
      <Sparkline />
    </View>
  </View>;
}

function StudentReadiness({ readiness }: { readiness: CareerReadinessBreakdown | null }) {
  if (!readiness) return null;
  const detail = `${readiness.level} · See what to improve next`;
  return (
    <Pressable
      testID="career-readiness-card"
      accessibilityRole="button"
      accessibilityLabel={`Career Readiness. ${detail}. ${readiness.score} out of 100.`}
      accessibilityHint="Opens the career readiness breakdown"
      onPress={() => router.push('/career-readiness')}
      style={styles.readinessCard}
    >
      <View testID="career-readiness-copy" style={styles.readinessCopy}>
        <AppText weight="semibold" style={styles.readinessTitle}>Career Readiness</AppText>
        <AppText style={styles.readinessDetail}>{detail}</AppText>
      </View>
      <View testID="career-readiness-score" style={styles.readinessScore}>
        <AppText weight="bold" style={styles.readinessValue}>{readiness.score}</AppText>
        <AppText style={styles.readinessMax}>/100</AppText>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.burgundy} />
    </Pressable>
  );
}

function RecentProjectCard({ booking }: { booking?: ProjectBooking }) {
  return <Pressable disabled={!booking} onPress={() => booking && router.push({ pathname: '/projects/[projectId]', params: { projectId: booking.id } })} style={styles.projectCard}>
    <OptimizedArtwork source={optimizedArtwork.studentProject} style={styles.projectImage} />
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

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionTitle}><AppText weight="semibold" style={{ fontSize: 19 }}>{title}</AppText>{action ? <Pressable disabled={!onAction} onPress={onAction}><AppText weight="medium" style={{ color: colors.burgundy, fontSize: 14 }}>{action}</AppText></Pressable> : null}</View>;
}

function Sparkline() {
  return (
    <Svg width={120} height={70} viewBox="0 0 120 70">
      <Defs>
        <LinearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.red} stopOpacity="0.3" />
          <Stop offset="1" stopColor={colors.red} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d="M0,58 C10,55 18,35 30,32 S48,50 55,42 C62,34 70,18 85,22 S105,8 112,5 L112,70 L0,70 Z" fill="url(#sparkGrad)" />
      <Path d="M0,58 C10,55 18,35 30,32 S48,50 55,42 C62,34 70,18 85,22 S105,8 112,5" stroke={colors.burgundy} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={112} cy={5} r={4} fill={colors.red} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 30 },   hero: { backgroundColor: colors.red, paddingHorizontal: 24, paddingBottom: 87 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }, bellWrap: { position: 'relative' }, badge: { position: 'absolute', right: -6, top: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#ef8585', alignItems: 'center', justifyContent: 'center' }, badgeText: { color: colors.white, fontSize: 10 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24 }, greeting: { color: colors.white, fontSize: 28 }, heroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22, marginTop: 5 }, avatarCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  body: { backgroundColor: colors.white, paddingHorizontal: contentPadding, marginTop: -164, borderTopLeftRadius: 42, borderTopRightRadius: 42, paddingTop: 112, overflow: 'hidden' }, earningsCard: { borderRadius: 18, backgroundColor: colors.white, paddingTop: 14, paddingBottom: 18, paddingHorizontal: 20, minHeight: 140, marginTop: -100, marginHorizontal: 24, zIndex: 1, transform: [{ translateY: -68 }], ...shadow }, cardTitle: { fontSize: 20, marginBottom: 8 }, earningsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }, earnings: { fontSize: 28 }, pesoSign: { fontSize: 26 }, muted: { color: colors.muted, fontSize: 13, marginTop: 2 }, readinessCard: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 15, borderRadius: 14, padding: 13, backgroundColor: colors.blush }, readinessCopy: { flex: 1, flexShrink: 1, minWidth: 0 }, readinessScore: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', flexShrink: 0 }, readinessValue: { color: colors.red, fontSize: 24, lineHeight: 27 }, readinessMax: { color: colors.burgundy, fontSize: 9 }, readinessTitle: { fontSize: 15 }, readinessDetail: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 29, marginBottom: 16 }, quickRow: { flexDirection: 'row', gap: 4 },
  projectCard: { backgroundColor: colors.white, borderRadius: 14, minHeight: 128, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 14, ...shadow }, projectImage: { width: 92, aspectRatio: 122 / 117, borderRadius: 11 }, projectTitle: { fontSize: 16, lineHeight: 21 }, projectPrice: { marginTop: 10, fontSize: 15 }, statusPill: { backgroundColor: colors.blush, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }, statusText: { color: colors.burgundy, fontSize: 11 },
  recommendCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, backgroundColor: colors.white, padding: 12, ...shadow }, recommendImage: { width: 72, height: 62, borderRadius: 10, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
});
