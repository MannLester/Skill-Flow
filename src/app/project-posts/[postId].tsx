import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding, font, shadow } from '@/constants/theme';
import {
  ProjectBooking,
  ProjectPost,
  Proposal,
  ProposalInput,
  StoreResult,
  StudentVerification,
  useSession,
} from '@/context/session.remote';
import { formatPeso } from '@/data/fixtures';
import { consumeResult } from '@/utils/consume-result';

type ProposalSubmitter = (projectPostId: string, input: ProposalInput) => Promise<StoreResult>;

export default function ProjectPostDetailsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const {
    accounts,
    bookings,
    currentAccount,
    projectPosts,
    proposals,
    setProjectPostStatus,
    submitProposal,
    verifications,
    withdrawProposal,
  } = useSession();
  const post = projectPosts.find((item) => item.id === postId);

  if (!post) {
    return <MissingProject />;
  }

  const client = accounts.find((item) => item.id === post.clientId);
  const myProposal = proposals.find(
    (item) => item.projectPostId === post.id && item.studentId === currentAccount?.id && item.status !== 'withdrawn',
  );
  const booking = bookings.find((item) => item.projectPostId === post.id);
  const verification = verifications.find((item) => item.studentId === currentAccount?.id);
  const isOwner = currentAccount?.id === post.clientId;

  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Project Brief" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <ProjectSummary post={post} client={client} booking={booking} />
        {isOwner ? (
          <OwnerControls
            post={post}
            proposalCount={proposals.filter((item) => item.projectPostId === post.id && item.status !== 'withdrawn').length}
            setProjectPostStatus={setProjectPostStatus}
          />
        ) : null}
        {currentAccount?.role === 'student' && !booking ? (
          <StudentProposalSection
            post={post}
            proposal={myProposal}
            verification={verification}
            submitProposal={submitProposal}
            withdrawProposal={withdrawProposal}
          />
        ) : null}
      </ScrollView>
    </MobilePage>
  );
}

function MissingProject() {
  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Project" onBack={() => router.back()} />
      <View style={styles.missing}>
        <AppText weight="semibold">Project post not found.</AppText>
      </View>
    </MobilePage>
  );
}

function ProjectSummary({ post, client, booking }: { post: ProjectPost; client?: { id: string; name: string }; booking?: ProjectBooking }) {
  return (
    <>
      <View style={styles.statusRow}>
        <View style={styles.status}><AppText weight="medium" style={styles.statusText}>{post.status.toUpperCase()}</AppText></View>
        <AppText style={styles.deadline}>Deadline {post.deadline}</AppText>
      </View>
      <AppText weight="bold" style={styles.title}>{post.title}</AppText>
      <AppText weight="bold" style={styles.budget}>{formatPeso(post.budget)} budget</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={client ? `Open ${client.name}'s profile` : 'Project client'}
        disabled={!client}
        onPress={() => client && router.push({ pathname: '/profiles/[userId]', params: { userId: client.id } })}
        style={styles.client}
      >
        <View style={styles.avatar}><Ionicons name="business-outline" size={24} color={colors.burgundy} /></View>
        <View style={styles.clientInfo}>
          <AppText weight="semibold">{client?.name ?? 'Client'}</AppText>
          <AppText style={styles.muted}>{post.category}</AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>
      <AppText style={styles.description}>{post.description}</AppText>
      <View style={styles.skills}>
        {post.skills.map((skill) => <View key={skill} style={styles.skill}><AppText style={styles.skillText}>{skill}</AppText></View>)}
      </View>
      {booking ? <PrimaryButton title="Open Accepted Project" onPress={() => router.push({ pathname: '/projects/[projectId]', params: { projectId: booking.id } })} style={styles.bookingButton} /> : null}
    </>
  );
}

function OwnerControls({
  post,
  proposalCount,
  setProjectPostStatus,
}: {
  post: ProjectPost;
  proposalCount: number;
  setProjectPostStatus: (projectPostId: string, status: ProjectPost['status']) => Promise<StoreResult>;
}) {
  const changeStatus = (status: ProjectPost['status']) => {
    consumeResult(setProjectPostStatus(post.id, status), (result) => {
      Alert.alert(result.ok ? 'Project updated' : 'Unable to update', result.ok ? `Project is now ${status}.` : result.message);
    });
  };
  const canEdit = !['closed', 'archived'].includes(post.status);
  const canOpen = post.status === 'draft' || (post.status === 'closed' && !post.acceptedProposalId);

  return (
    <View style={styles.panel}>
      <AppText weight="semibold" style={styles.panelTitle}>Manage this post</AppText>
      <PrimaryButton title={`View Proposals (${proposalCount})`} onPress={() => router.push({ pathname: '/project-posts/[postId]/proposals', params: { postId: post.id } })} />
      <Pressable disabled={!canEdit} onPress={() => router.push({ pathname: '/project-posts/[postId]/edit', params: { postId: post.id } })} style={styles.secondary}>
        <AppText weight="semibold" style={styles.secondaryText}>Edit Project</AppText>
      </Pressable>
      {post.status === 'open' ? <Pressable onPress={() => changeStatus('closed')} style={styles.secondary}><AppText weight="semibold" style={styles.secondaryText}>Close Proposals</AppText></Pressable> : null}
      {canOpen ? <Pressable onPress={() => changeStatus('open')} style={styles.secondary}><AppText weight="semibold" style={styles.secondaryText}>Open for Proposals</AppText></Pressable> : null}
      <Pressable onPress={() => changeStatus('archived')} style={styles.archive}><AppText weight="semibold" style={styles.archiveText}>Archive Project</AppText></Pressable>
    </View>
  );
}

function StudentProposalSection({
  post,
  proposal,
  verification,
  submitProposal,
  withdrawProposal,
}: {
  post: ProjectPost;
  proposal?: Proposal;
  verification?: StudentVerification;
  submitProposal: ProposalSubmitter;
  withdrawProposal: (proposalId: string) => Promise<StoreResult>;
}) {
  const withdraw = () => {
    if (!proposal) return;
    consumeResult(withdrawProposal(proposal.id), (result) => {
      Alert.alert(result.ok ? 'Proposal withdrawn' : 'Unable to withdraw', result.ok ? 'You may submit a new proposal while the post remains open.' : result.message);
    });
  };

  return (
    <View style={styles.panel}>
      <AppText weight="semibold" style={styles.panelTitle}>Your proposal</AppText>
      {proposal ? <ExistingProposal proposal={proposal} onWithdraw={withdraw} /> : null}
      {!proposal && post.status === 'open' ? <ProposalForm post={post} verification={verification} submitProposal={submitProposal} /> : null}
      {!proposal && post.status !== 'open' ? <AppText style={styles.hint}>This project is not accepting proposals.</AppText> : null}
    </View>
  );
}

function ExistingProposal({ proposal, onWithdraw }: { proposal: Proposal; onWithdraw: () => void }) {
  return (
    <>
      <View style={styles.proposalStatus}>
        <Ionicons name={proposal.status === 'submitted' ? 'time-outline' : 'information-circle-outline'} size={21} color={colors.burgundy} />
        <View>
          <AppText weight="semibold" style={styles.secondaryText}>{proposal.status.replaceAll('_', ' ')}</AppText>
          <AppText style={styles.muted}>{formatPeso(proposal.amount)} · {proposal.deliveryDays} days</AppText>
        </View>
      </View>
      {proposal.status === 'submitted' ? <Pressable onPress={onWithdraw} style={styles.archive}><AppText weight="semibold" style={styles.archiveText}>Withdraw Proposal</AppText></Pressable> : null}
    </>
  );
}

function ProposalForm({ post, verification, submitProposal }: { post: ProjectPost; verification?: StudentVerification; submitProposal: ProposalSubmitter }) {
  const [coverLetter, setCoverLetter] = useState('');
  const [amount, setAmount] = useState(String(post.budget));
  const [deliveryDays, setDeliveryDays] = useState('5');
  const [feedback, setFeedback] = useState<string>();

  useEffect(() => {
    if (verification?.status === 'verified') setFeedback(undefined);
  }, [verification?.status]);

  const handleSubmit = () => {
    consumeResult(submitProposal(post.id, {
      coverLetter,
      amount: parseNumberOrZero(amount),
      deliveryDays: parseNumberOrZero(deliveryDays),
    }), (result) => {
      if (!result.ok) return setFeedback(result.message);
      setFeedback(undefined);
      Alert.alert('Proposal submitted', 'The client can now compare your proposal.');
    });
  };
  const clearFeedback = () => setFeedback(undefined);
  const verificationRequired = verification?.status !== 'verified';

  return (
    <>
      <AppText style={styles.hint}>{verificationRequired ? 'Simulated student verification is required before submission.' : 'Your verified status will be shown to the client.'}</AppText>
      <TextInput
        accessibilityLabel="Proposal cover letter"
        value={coverLetter}
        onChangeText={(value) => { setCoverLetter(value); clearFeedback(); }}
        placeholder="Explain why you are a good fit…"
        placeholderTextColor={colors.muted}
        multiline
        style={styles.textArea}
      />
      <FormField
        accessibilityLabel="Proposed amount"
        icon="cash-outline"
        value={amount}
        onChangeText={(value) => { setAmount(value); clearFeedback(); }}
        placeholder="Proposed amount"
        keyboardType="number-pad"
      />
      <View style={styles.fieldGap} />
      <FormField
        accessibilityLabel="Delivery days"
        icon="alarm-outline"
        value={deliveryDays}
        onChangeText={(value) => { setDeliveryDays(value); clearFeedback(); }}
        placeholder="Delivery days"
        keyboardType="number-pad"
      />
      {feedback ? <ProposalFeedback message={feedback} verificationRequired={verificationRequired} /> : null}
      <PrimaryButton title="Submit Proposal" onPress={handleSubmit} style={styles.submitButton} />
    </>
  );
}

function ProposalFeedback({ message, verificationRequired }: { message: string; verificationRequired: boolean }) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.feedback}>
      <Ionicons name="alert-circle-outline" size={22} color={colors.burgundy} />
      <View style={styles.feedbackBody}>
        <AppText weight="semibold" style={styles.feedbackTitle}>Unable to submit proposal</AppText>
        <AppText style={styles.feedbackText}>{message}</AppText>
        {verificationRequired ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Open Student Verification" onPress={() => router.push('/verification')} style={styles.feedbackAction}>
            <AppText weight="semibold" style={styles.feedbackActionText}>Open Student Verification</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function parseNumberOrZero(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const styles = StyleSheet.create({
  content: { padding: contentPadding, paddingBottom: 36 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: contentPadding },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { backgroundColor: colors.blush, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statusText: { color: colors.burgundy, fontSize: 9 },
  deadline: { color: colors.muted, fontSize: 10 },
  title: { fontSize: 25, lineHeight: 33, marginTop: 16 },
  budget: { fontSize: 20, color: colors.burgundy, marginTop: 8 },
  client: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  clientInfo: { flex: 1 },
  muted: { color: colors.muted, fontSize: 10, marginTop: 2 },
  description: { fontSize: 14, lineHeight: 23, marginTop: 23 },
  skills: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginTop: 17 },
  skill: { backgroundColor: colors.blush, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  skillText: { color: colors.burgundy, fontSize: 9 },
  bookingButton: { marginTop: 24 },
  panel: { backgroundColor: colors.white, borderRadius: 14, padding: 15, marginTop: 25, gap: 10, ...shadow },
  panelTitle: { fontSize: 17, marginBottom: 3 },
  secondary: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.burgundy, textTransform: 'capitalize' },
  archive: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  archiveText: { color: colors.red },
  hint: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  textArea: { minHeight: 115, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontFamily: font.regular, color: colors.ink, textAlignVertical: 'top' },
  fieldGap: { height: 10 },
  submitButton: { marginTop: 4 },
  proposalStatus: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.blush, borderRadius: 10, padding: 12 },
  feedback: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: colors.burgundy, borderRadius: 10, backgroundColor: colors.blush, padding: 12 },
  feedbackBody: { flex: 1, gap: 4 },
  feedbackTitle: { color: colors.burgundy, fontSize: 13 },
  feedbackText: { fontSize: 12, lineHeight: 18 },
  feedbackAction: { alignSelf: 'flex-start', marginTop: 5, paddingVertical: 5 },
  feedbackActionText: { color: colors.burgundy, textDecorationLine: 'underline' },
});
