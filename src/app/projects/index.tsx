import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, BottomNav, MobilePage } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';
import { formatPeso } from '@/data/fixtures';
import { ProjectBooking, ProjectPost, ProjectStatus, Proposal, UserRole, useSession } from '@/context/session';

const statusLabels: Record<ProjectStatus, string> = {
  requested: 'Request Sent', accepted: 'Accepted', declined: 'Declined', cancelled: 'Cancelled', demo_funded: 'Demo Funds Reserved', in_progress: 'In Progress', submitted: 'Delivery Submitted', revision_requested: 'Revision Requested', approved: 'Approved', completed: 'Completed', reviewed: 'Reviewed',
};

export default function ProjectsScreen() {
  const { bookings, currentAccount, homeRoute, projectPosts, proposals } = useSession();
  const visible = currentAccount ? bookings.filter((booking) => booking.clientId === currentAccount.id || booking.studentId === currentAccount.id) : [];
  const myPosts = currentAccount?.role === 'client' ? projectPosts.filter((post) => post.clientId === currentAccount.id) : [];
  const myProposals = currentAccount?.role === 'student' ? proposals.filter((proposal) => proposal.studentId === currentAccount.id && proposal.status !== 'withdrawn') : [];
  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Projects" onBack={() => router.back()} />
      <FlatList data={visible} keyExtractor={(item) => item.id} renderItem={({ item }) => <ProjectRow booking={item} />} contentContainerStyle={styles.list} ListHeaderComponent={<ProjectsListHeader role={currentAccount?.role} myPosts={myPosts} myProposals={myProposals} projectPosts={projectPosts} proposals={proposals} />} ListEmptyComponent={<ProjectsEmptyState />} />
      <ProjectsBottomNav homeRoute={homeRoute} role={currentAccount?.role} />
    </MobilePage>
  );
}

function ProjectsListHeader({ role, myPosts, myProposals, projectPosts, proposals }: { role?: UserRole; myPosts: ProjectPost[]; myProposals: Proposal[]; projectPosts: ProjectPost[]; proposals: Proposal[] }) {
  return <View>
    <ProjectAction role={role} />
    {role === 'client' && myPosts.length ? <ProjectPosts posts={myPosts} proposals={proposals} /> : null}
    {role === 'student' && myProposals.length ? <StudentProposals proposals={myProposals} projectPosts={projectPosts} /> : null}
    <AppText weight="semibold" style={styles.groupTitle}>Shared Project Bookings</AppText>
  </View>;
}

function ProjectAction({ role }: { role?: UserRole }) {
  const isClient = role === 'client';
  return <Pressable onPress={() => router.push(isClient ? '/project-posts/new' : '/projects/discover')} style={styles.action}><Ionicons name={isClient ? 'add-circle-outline' : 'search-outline'} size={23} color={colors.red} /><AppText weight="semibold" style={{ flex: 1 }}>{isClient ? 'Post a New Project' : 'Discover Open Projects'}</AppText><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>;
}

function ProjectPosts({ posts, proposals }: { posts: ProjectPost[]; proposals: Proposal[] }) {
  return <><AppText weight="semibold" style={styles.groupTitle}>Your Project Posts</AppText>{posts.map((post) => <Pressable key={post.id} onPress={() => router.push({ pathname: '/project-posts/[postId]', params: { postId: post.id } })} style={styles.postRow}><View><AppText weight="semibold">{post.title}</AppText><AppText style={styles.postMeta}>{post.status} · {proposals.filter((proposal) => proposal.projectPostId === post.id && proposal.status === 'submitted').length} active proposals</AppText></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>)}</>;
}

function StudentProposals({ proposals, projectPosts }: { proposals: Proposal[]; projectPosts: ProjectPost[] }) {
  return <><AppText weight="semibold" style={styles.groupTitle}>Your Proposals</AppText>{proposals.map((proposal) => <ProposalRow key={proposal.id} proposal={proposal} projectPosts={projectPosts} />)}</>;
}

function ProposalRow({ proposal, projectPosts }: { proposal: Proposal; projectPosts: ProjectPost[] }) {
  const post = projectPosts.find((item) => item.id === proposal.projectPostId);
  if (!post) return null;
  return <Pressable onPress={() => router.push({ pathname: '/project-posts/[postId]', params: { postId: post.id } })} style={styles.postRow}><View><AppText weight="semibold">{post.title}</AppText><AppText style={styles.postMeta}>{proposal.status} · {formatPeso(proposal.amount)}</AppText></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>;
}

function ProjectsEmptyState() {
  return <View style={styles.empty}><Ionicons name="briefcase-outline" size={54} color={colors.muted} /><AppText weight="semibold" style={styles.emptyTitle}>No project bookings yet</AppText><AppText style={styles.emptyText}>An accepted proposal or service request will appear here and enter the shared delivery lifecycle.</AppText></View>;
}

function ProjectsBottomNav({ homeRoute, role }: { homeRoute: '/student-home' | '/client-home'; role?: UserRole }) {
  const isStudent = role === 'student';
  const isClient = role === 'client';
  return <BottomNav active="projects" onHome={() => router.replace(homeRoute)} onProjects={() => undefined} onPortfolio={isStudent ? () => router.push('/portfolio') : undefined} onMessages={() => router.push('/messages')} onSaved={isClient ? () => router.push({ pathname: '/marketplace', params: { saved: 'true' } }) : undefined} onProfile={() => router.push('/profile')} variant={isClient ? 'client' : 'student'} />;
}

function ProjectRow({ booking }: { booking: ProjectBooking }) {
  return <Pressable onPress={() => router.push({ pathname: '/projects/[projectId]', params: { projectId: booking.id } })} style={styles.row}><View style={styles.icon}><Ionicons name="briefcase" size={25} color={colors.red} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={styles.title}>{booking.title}</AppText><AppText style={styles.description} numberOfLines={2}>{booking.description}</AppText><View style={styles.meta}><AppText weight="semibold">{formatPeso(booking.budget)}</AppText><View style={styles.status}><AppText weight="medium" style={styles.statusText}>{statusLabels[booking.status]}</AppText></View></View></View><Ionicons name="chevron-forward" size={22} color={colors.muted} /></Pressable>;
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingHorizontal: contentPadding, paddingBottom: 24 }, action: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border }, groupTitle: { fontSize: 16, marginTop: 20, marginBottom: 7 }, postRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border }, postMeta: { color: colors.muted, fontSize: 9, textTransform: 'capitalize', marginTop: 4 }, row: { minHeight: 126, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border }, icon: { width: 54, height: 54, borderRadius: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 16 }, description: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }, status: { backgroundColor: colors.blush, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }, statusText: { color: colors.burgundy, fontSize: 10 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60 }, emptyTitle: { fontSize: 18, marginTop: 15 }, emptyText: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 19, marginTop: 7 },
});
