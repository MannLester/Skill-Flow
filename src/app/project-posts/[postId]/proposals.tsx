import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding, shadow } from '@/constants/theme';
import { formatPeso } from '@/data/fixtures';
import { DemoAccount, Proposal, StudentVerification, UserProfile, useSession } from '@/context/session';

type ProposalLookupIndexes = {
  accountsById: Map<string, DemoAccount>;
  profilesByAccountId: Map<string, UserProfile>;
  verificationsByStudentId: Map<string, StudentVerification>;
};

export function buildProposalLookupIndexes(accounts: DemoAccount[], profiles: UserProfile[], verifications: StudentVerification[]): ProposalLookupIndexes {
  return {
    accountsById: new Map(accounts.map((account) => [account.id, account])),
    profilesByAccountId: new Map(profiles.map((profile) => [profile.accountId, profile])),
    verificationsByStudentId: new Map(verifications.map((verification) => [verification.studentId, verification])),
  };
}

function proposalKeyExtractor(item: Proposal) {
  return item.id;
}

function ProposalEmptyState() {
  return <View style={styles.empty}><Ionicons name="document-text-outline" size={52} color={colors.muted} /><AppText weight="semibold" style={{ marginTop: 12 }}>No proposals yet</AppText><AppText style={styles.muted}>Verified Student Designer proposals will appear here.</AppText></View>;
}

export default function ProposalsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { accounts, currentAccount, decideProposal, profiles, projectPosts, proposals, verifications } = useSession();
  const post = projectPosts.find((item) => item.id === postId);
  const visible = useMemo(() => proposals.filter((item) => item.projectPostId === postId && item.status !== 'withdrawn'), [postId, proposals]);
  const lookupIndexes = useMemo(() => buildProposalLookupIndexes(accounts, profiles, verifications), [accounts, profiles, verifications]);
  const decide = useCallback((proposal: Proposal, accept: boolean) => {
    const result = decideProposal(proposal.id, accept);
    if (!result.ok) return Alert.alert('Unable to update proposal', result.message);
    if (accept && result.bookingId) { Alert.alert('Proposal accepted', 'A shared project booking has been created. Demo funding is the next step.'); router.replace({ pathname: '/projects/[projectId]', params: { projectId: result.bookingId } }); }
    else Alert.alert('Proposal rejected', 'The Student Designer has been notified locally.');
  }, [decideProposal]);
  const renderItem = useCallback(({ item }: { item: Proposal }) => {
    const student = lookupIndexes.accountsById.get(item.studentId);
    const profile = lookupIndexes.profilesByAccountId.get(item.studentId);
    const verified = lookupIndexes.verificationsByStudentId.get(item.studentId)?.status === 'verified';
    return <ProposalRow proposal={item} studentName={student?.name} skills={profile?.skills.slice(0, 3).join(' · ')} verified={verified} postOpen={post?.status === 'open'} onDecide={decide} />;
  }, [decide, lookupIndexes, post?.status]);
  if (!post || post.clientId !== currentAccount?.id) return <MobilePage><StatusBar style="light" /><AppHeader title="Proposals" onBack={() => router.back()} /><View style={styles.empty}><AppText>This proposal list is available only to the project Client.</AppText></View></MobilePage>;
  return <MobilePage><StatusBar style="light" /><AppHeader title="Compare Proposals" onBack={() => router.back()} /><View style={styles.summary}><AppText weight="semibold" style={styles.projectTitle}>{post.title}</AppText><AppText style={styles.muted}>{visible.length} proposal{visible.length === 1 ? '' : 's'} · {formatPeso(post.budget)} posted budget</AppText></View><FlatList data={visible} keyExtractor={proposalKeyExtractor} contentContainerStyle={styles.list} renderItem={renderItem} initialNumToRender={6} maxToRenderPerBatch={6} windowSize={5} removeClippedSubviews={Platform.OS === 'android'} ListEmptyComponent={ProposalEmptyState} /></MobilePage>;
}

const ProposalRow = memo(function ProposalRow({ proposal, studentName, skills, verified, postOpen, onDecide }: { proposal: Proposal; studentName?: string; skills?: string; verified: boolean; postOpen: boolean; onDecide: (proposal: Proposal, accept: boolean) => void }) {
  return <View style={styles.card}><Pressable onPress={() => router.push({ pathname: '/profiles/[userId]', params: { userId: proposal.studentId } })} style={styles.person}><View style={styles.avatar}><Ionicons name="person" size={24} color={colors.burgundy} /></View><View style={{ flex: 1 }}><AppText weight="semibold">{studentName ?? 'Student Designer'}</AppText><AppText style={styles.muted}>{skills || 'View public profile'}</AppText></View>{verified ? <View style={styles.verified}><Ionicons name="checkmark-circle" size={15} color={colors.green} /><AppText style={styles.verifiedText}>Verified</AppText></View> : null}</Pressable><AppText style={styles.cover}>{proposal.coverLetter}</AppText><View style={styles.bid}><View><AppText style={styles.muted}>Proposal</AppText><AppText weight="bold">{formatPeso(proposal.amount)}</AppText></View><View><AppText style={styles.muted}>Delivery</AppText><AppText weight="bold">{proposal.deliveryDays} days</AppText></View><View style={styles.state}><AppText weight="medium" style={styles.stateText}>{proposal.status}</AppText></View></View>{proposal.status === 'submitted' && postOpen ? <View style={styles.actions}><Pressable onPress={() => onDecide(proposal, false)} style={styles.reject}><AppText weight="semibold" style={{ color: colors.red }}>Reject</AppText></Pressable><PrimaryButton title="Accept" onPress={() => onDecide(proposal, true)} style={{ flex: 1 }} /></View> : null}</View>;
});

const styles = StyleSheet.create({ summary: { paddingHorizontal: contentPadding, paddingTop: 16 }, projectTitle: { fontSize: 19 }, muted: { color: colors.muted, fontSize: 10, marginTop: 3 }, list: { flexGrow: 1, padding: contentPadding, gap: 14 }, card: { backgroundColor: colors.white, borderRadius: 14, padding: 15, ...shadow }, person: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, verified: { flexDirection: 'row', alignItems: 'center', gap: 3 }, verifiedText: { color: colors.green, fontSize: 8 }, cover: { fontSize: 12, lineHeight: 19, marginTop: 14 }, bid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.blush, borderRadius: 10, padding: 12, marginTop: 14 }, state: { backgroundColor: colors.white, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }, stateText: { color: colors.burgundy, fontSize: 8, textTransform: 'capitalize' }, actions: { flexDirection: 'row', gap: 9, marginTop: 13 }, reject: { flex: 1, minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 } });
