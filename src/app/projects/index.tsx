import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { memo, useCallback, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding, shadow } from '@/constants/theme';
import { formatPeso } from '@/data/fixtures';
import { ProjectBooking, ProjectPost, ProjectStatus, Proposal, UserRole, useSession } from '@/context/session.remote';
import { PrimaryTabScene } from '@/navigation/primary-navigation';

const statusLabels: Record<ProjectStatus, string> = {
  requested: 'Request Sent', accepted: 'Accepted', declined: 'Declined', cancelled: 'Cancelled', demo_funded: 'Demo Funds Reserved', in_progress: 'In Progress', submitted: 'Delivery Submitted', revision_requested: 'Revision Requested', completed: 'Completed', reviewed: 'Reviewed',
};

export function buildProjectPostIndex(projectPosts: ProjectPost[]): Map<string, ProjectPost> {
  return new Map(projectPosts.map((post) => [post.id, post]));
}

export function buildSubmittedProposalCounts(proposals: Proposal[]): Map<string, number> {
  const counts = new Map<string, number>();
  proposals.forEach((proposal) => {
    if (proposal.status !== 'submitted') return;
    counts.set(proposal.projectPostId, (counts.get(proposal.projectPostId) ?? 0) + 1);
  });
  return counts;
}

export default function ProjectsScreen() {
  const { bookings, currentAccount, projectPosts, proposals } = useSession();
  const accountId = currentAccount?.id;
  const visible = useMemo(() => accountId ? bookings.filter((booking) => booking.clientId === accountId || booking.studentId === accountId) : [], [accountId, bookings]);
  const myPosts = useMemo(() => currentAccount?.role === 'client' && accountId ? projectPosts.filter((post) => post.clientId === accountId) : [], [accountId, currentAccount?.role, projectPosts]);
  const myProposals = useMemo(() => currentAccount?.role === 'student' && accountId ? proposals.filter((proposal) => proposal.studentId === accountId && proposal.status !== 'withdrawn') : [], [accountId, currentAccount?.role, proposals]);
  const postsById = useMemo(() => buildProjectPostIndex(projectPosts), [projectPosts]);
  const proposalCounts = useMemo(() => buildSubmittedProposalCounts(proposals), [proposals]);
  const renderItem = useCallback(({ item }: { item: ProjectBooking }) => <ProjectRow booking={item} />, []);
  const header = useMemo(() => <ProjectsListHeader role={currentAccount?.role} myPosts={myPosts} myProposals={myProposals} postsById={postsById} proposalCounts={proposalCounts} />, [currentAccount?.role, myPosts, myProposals, postsById, proposalCounts]);
  return (
    <PrimaryTabScene active="projects"><MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Projects" />
      <FlatList data={visible} keyExtractor={projectKeyExtractor} renderItem={renderItem} contentContainerStyle={styles.list} ListHeaderComponent={header} ListEmptyComponent={ProjectsEmptyState} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews={Platform.OS === 'android'} />
    </MobilePage></PrimaryTabScene>
  );
}

function projectKeyExtractor(item: ProjectBooking) {
  return item.id;
}

const ProjectsListHeader = memo(function ProjectsListHeader({ role, myPosts, myProposals, postsById, proposalCounts }: { role?: UserRole; myPosts: ProjectPost[]; myProposals: Proposal[]; postsById: Map<string, ProjectPost>; proposalCounts: Map<string, number> }) {
  return <View>
    <ProjectAction role={role} />
    {role === 'client' && myPosts.length ? <ProjectPosts posts={myPosts} proposalCounts={proposalCounts} /> : null}
    {role === 'student' && myProposals.length ? <StudentProposals proposals={myProposals} postsById={postsById} /> : null}
    <AppText weight="semibold" style={styles.groupTitle}>Shared Project Bookings</AppText>
  </View>;
});

function ProjectAction({ role }: { role?: UserRole }) {
  const isClient = role === 'client';
  return <Pressable onPress={() => router.push(isClient ? '/project-posts/new' : '/projects/discover')} style={styles.action}><View style={styles.actionIcon}><Ionicons name={isClient ? 'add-circle' : 'search'} size={24} color={colors.white} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={styles.actionTitle}>{isClient ? 'Post a New Project' : 'Discover Open Projects'}</AppText><AppText style={styles.actionSubtitle}>{isClient ? 'Create a project request for students' : 'Browse available student projects'}</AppText></View><Ionicons name="chevron-forward" size={20} color={colors.white} /></Pressable>;
}

const ProjectPosts = memo(function ProjectPosts({ posts, proposalCounts }: { posts: ProjectPost[]; proposalCounts: Map<string, number> }) {
  return <><AppText weight="semibold" style={styles.groupTitle}>Your Project Posts</AppText>{posts.map((post) => <Pressable key={post.id} onPress={() => router.push({ pathname: '/project-posts/[postId]', params: { postId: post.id } })} style={styles.postCard}><View style={styles.postIcon}><Ionicons name="document-text" size={22} color={colors.red} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={styles.postTitle}>{post.title}</AppText><View style={styles.statusPill}><AppText weight="medium" style={styles.statusPillText}>{post.status} · {proposalCounts.get(post.id) ?? 0} proposals</AppText></View></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>)}</>;
});

const StudentProposals = memo(function StudentProposals({ proposals, postsById }: { proposals: Proposal[]; postsById: Map<string, ProjectPost> }) {
  return <><AppText weight="semibold" style={styles.groupTitle}>Your Proposals</AppText>{proposals.map((proposal) => <ProposalRow key={proposal.id} proposal={proposal} post={postsById.get(proposal.projectPostId)} />)}</>;
});

const ProposalRow = memo(function ProposalRow({ proposal, post }: { proposal: Proposal; post?: ProjectPost }) {
  if (!post) return null;
  return <Pressable onPress={() => router.push({ pathname: '/project-posts/[postId]', params: { postId: post.id } })} style={styles.postRow}><View><AppText weight="semibold">{post.title}</AppText><AppText style={styles.postMeta}>{proposal.status} · {formatPeso(proposal.amount)}</AppText></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>;
});

function ProjectsEmptyState() {
  return <View style={styles.empty}><Ionicons name="briefcase-outline" size={54} color={colors.muted} /><AppText weight="semibold" style={styles.emptyTitle}>No project bookings yet</AppText><AppText style={styles.emptyText}>An accepted proposal or service request will appear here and enter the shared delivery lifecycle.</AppText></View>;
}

const ProjectRow = memo(function ProjectRow({ booking }: { booking: ProjectBooking }) {
  return <Pressable onPress={() => router.push({ pathname: '/projects/[projectId]', params: { projectId: booking.id } })} style={styles.row}><View style={styles.icon}><Ionicons name="briefcase" size={25} color={colors.red} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={styles.title}>{booking.title}</AppText><AppText style={styles.description} numberOfLines={2}>{booking.description}</AppText><View style={styles.meta}><AppText weight="semibold">{formatPeso(booking.budget)}</AppText><View style={styles.status}><AppText weight="medium" style={styles.statusText}>{statusLabels[booking.status]}</AppText></View></View></View><Ionicons name="chevron-forward" size={22} color={colors.muted} /></Pressable>;
});

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingHorizontal: contentPadding, paddingBottom: 24 }, action: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.red, borderRadius: 14, padding: 14, marginTop: 12 }, actionIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }, actionTitle: { color: colors.white, fontSize: 14 }, actionSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 }, groupTitle: { fontSize: 16, marginTop: 20, marginBottom: 7 }, postCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 14, padding: 14, marginTop: 10, ...shadow }, postIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, postTitle: { fontSize: 14 }, statusPill: { backgroundColor: colors.blush, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6, alignSelf: 'flex-start' }, statusPillText: { color: colors.burgundy, fontSize: 10, textTransform: 'capitalize' }, postRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border }, postMeta: { color: colors.muted, fontSize: 9, textTransform: 'capitalize', marginTop: 4 }, row: { minHeight: 126, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border }, icon: { width: 54, height: 54, borderRadius: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 16 }, description: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }, status: { backgroundColor: colors.blush, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }, statusText: { color: colors.burgundy, fontSize: 10 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60 }, emptyTitle: { fontSize: 18, marginTop: 15 }, emptyText: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 19, marginTop: 7 },
});
