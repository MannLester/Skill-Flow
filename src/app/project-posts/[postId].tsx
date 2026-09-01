import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { ImageUploader } from '@/components/image-uploader';
import { MediaGallery } from '@/components/media-gallery';
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
import { mediaInputs, type UploadedImage } from '@/media/types';

type ProposalSubmitter = (projectPostId: string, input: ProposalInput) => Promise<StoreResult>;

export default function ProjectPostDetailsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const [manageVisible, setManageVisible] = useState(false);
  const [applyVisible, setApplyVisible] = useState(false);
  const insets = useSafeAreaInsets();
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
  const proposalCount = proposals.filter((item) => item.projectPostId === post.id && item.status !== 'withdrawn').length;
  const visibility = projectPostVisibility(currentAccount?.role, Boolean(booking), Boolean(myProposal), post.status);

  return (
    <MobilePage>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} style={{ flex: 1 }}>
        <ProjectSummary post={post} client={client} booking={booking} />
        {visibility.showProposal && myProposal ? (
          <StudentProposalSection
            post={post}
            proposal={myProposal}
            verification={verification}
            submitProposal={submitProposal}
            withdrawProposal={withdrawProposal}
          />
        ) : null}
        {visibility.showApply ? <ProposalForm post={post} verification={verification} submitProposal={submitProposal} /> : null}
      </ScrollView>
      {isOwner ? (
        <View style={[styles.manageBottomWrapper, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={() => setManageVisible(true)} style={styles.manageBottomBar}>
            <AppText weight="semibold" style={styles.manageBottomBarText}>Manage this post</AppText>
          </Pressable>
        </View>
      ) : null}
      {visibility.showApply ? (
        <View style={[styles.manageBottomWrapper, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={() => setApplyVisible(true)} style={styles.manageBottomBar}>
            <AppText weight="semibold" style={styles.manageBottomBarText}>Apply for this Job</AppText>
          </Pressable>
        </View>
      ) : null}
      <Modal visible={manageVisible} animationType="slide" transparent onRequestClose={() => setManageVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <AppText weight="semibold" style={styles.modalTitle}>Manage this post</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setManageVisible(false)} hitSlop={12} style={styles.modalClose}>
                <Ionicons name="close" size={24} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <PrimaryButton title={`View Proposals (${proposalCount})`} onPress={() => { setManageVisible(false); router.push({ pathname: '/project-posts/[postId]/proposals', params: { postId: post.id } }); }} />
              <OwnerControls
                post={post}
                setProjectPostStatus={setProjectPostStatus}
                onAction={() => setManageVisible(false)}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={applyVisible} animationType="slide" transparent onRequestClose={() => setApplyVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <AppText weight="semibold" style={styles.modalTitle}>Apply for this Job</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setApplyVisible(false)} hitSlop={12} style={styles.modalClose}>
                <Ionicons name="close" size={24} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <ProposalForm
                post={post}
                verification={verification}
                submitProposal={submitProposal}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </MobilePage>
  );
}

function projectPostVisibility(role: string | undefined, hasBooking: boolean, hasProposal: boolean, status: ProjectPost['status']) {
  const isStudent = role === 'student';
  return { showProposal: isStudent && !hasBooking && hasProposal, showApply: isStudent && !hasBooking && !hasProposal && status === 'open' };
}

function MissingProject() {
  const insets = useSafeAreaInsets();
  return (
    <MobilePage>
      <StatusBar style="light" />
      <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={26} color={colors.white} />
        </Pressable>
        <AppText weight="bold" style={styles.heroTitle}>Project</AppText>
      </View>
      <View style={styles.missing}>
        <AppText weight="semibold">Project post not found.</AppText>
      </View>
    </MobilePage>
  );
}

function ProjectSummary({ post, client, booking }: { post: ProjectPost; client?: { id: string; name: string }; booking?: ProjectBooking }) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={26} color={colors.white} />
        </Pressable>
        <View style={styles.heroRow}>
          <AppText weight="bold" style={styles.heroTitle}>{post.title}</AppText>
          <AppText weight="bold" style={styles.heroBudget}>{formatPeso(post.budget)}</AppText>
        </View>
      </View>
      <View style={[styles.infoRow, { marginTop: -16 }]}>
        <View style={styles.infoHalf}>
          <Ionicons name="calendar-outline" size={20} color={colors.burgundy} />
          <AppText style={styles.infoLabel}>Deadline</AppText>
          <AppText weight="semibold" style={styles.infoValue}>{post.deadline}</AppText>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoHalf}>
          <Ionicons name="pricetag-outline" size={20} color={colors.burgundy} />
          <AppText style={styles.infoLabel}>Category</AppText>
          <AppText weight="semibold" style={styles.infoValue}>{post.category}</AppText>
        </View>
      </View>
      <View style={[styles.divider, { marginHorizontal: contentPadding, marginTop: 16 }]} />
      <View style={{ marginHorizontal: contentPadding, marginTop: 16 }}>
        <AppText weight="semibold" style={styles.sectionHeading}>About</AppText>
        <AppText style={styles.description}>{post.description}</AppText>
        <MediaGallery targetType="project_post" targetId={post.id} purposes={['project_reference']} />
        {post.skills.length ? (
          <>
            <AppText weight="semibold" style={[styles.sectionHeading, { marginTop: 20, borderTopWidth: 1, borderTopColor: '#E8E8E8', paddingTop: 16 }]}>Skills Required</AppText>
            <View style={styles.skillsRow}>
              {post.skills.map((skill) => <View key={skill} style={styles.skill}><AppText style={styles.skillText}>{skill}</AppText></View>)}
            </View>
          </>
        ) : null}
      </View>
      <View style={[styles.divider, { marginHorizontal: contentPadding, marginTop: 16 }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={client ? `Open ${client.name}'s profile` : 'Project client'}
        disabled={!client}
        onPress={() => client && router.push({ pathname: '/profiles/[userId]', params: { userId: client.id } })}
        style={styles.clientCard}
      >
        <View style={styles.clientAvatar}><Ionicons name="person" size={22} color={colors.burgundy} /></View>
        <View style={styles.clientInfo}>
          <AppText weight="semibold" style={styles.clientName}>by {client?.name ?? 'Client'}</AppText>
          <AppText style={styles.clientCategory}>{post.category}</AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>
      {booking ? <PrimaryButton title="Open Accepted Project" onPress={() => router.push({ pathname: '/projects/[projectId]', params: { projectId: booking.id } })} style={styles.bookingButton} /> : null}
    </>
  );
}

function OwnerControls({
  post,
  setProjectPostStatus,
  onAction,
}: {
  post: ProjectPost;
  setProjectPostStatus: (projectPostId: string, status: ProjectPost['status']) => Promise<StoreResult>;
  onAction?: () => void;
}) {
  const changeStatus = (status: ProjectPost['status']) => {
    consumeResult(setProjectPostStatus(post.id, status), (result) => {
      Alert.alert(result.ok ? 'Project updated' : 'Unable to update', result.ok ? `Project is now ${status}.` : result.message);
      if (result.ok) onAction?.();
    });
  };
  const canEdit = !['closed', 'archived'].includes(post.status);
  const canOpen = post.status === 'draft' || (post.status === 'closed' && !post.acceptedProposalId);

  return (
    <View style={styles.controlGroup}>
      <Pressable disabled={!canEdit} onPress={() => { onAction?.(); router.push({ pathname: '/project-posts/[postId]/edit', params: { postId: post.id } }); }} style={styles.controlRow}>
        <Ionicons name="create-outline" size={20} color={colors.burgundy} />
        <AppText weight="medium" style={styles.controlText}>Edit Project</AppText>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
      {post.status === 'open' ? <Pressable onPress={() => changeStatus('closed')} style={styles.controlRow}>
        <Ionicons name="close-circle-outline" size={20} color={colors.burgundy} />
        <AppText weight="medium" style={styles.controlText}>Close Proposals</AppText>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable> : null}
      {canOpen ? <Pressable onPress={() => changeStatus('open')} style={styles.controlRow}>
        <Ionicons name="rocket-outline" size={20} color={colors.burgundy} />
        <AppText weight="medium" style={styles.controlText}>Open for Proposals</AppText>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable> : null}
      <View style={[styles.divider, { marginVertical: 4 }]} />
      <Pressable onPress={() => changeStatus('archived')} style={styles.archiveRow}>
        <Ionicons name="archive-outline" size={18} color={colors.red} />
        <AppText weight="medium" style={styles.archiveText}>Archive Project</AppText>
      </Pressable>
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
      <MediaGallery targetType="proposal" targetId={proposal.id} purposes={['proposal_sample']} />
      {proposal.status === 'submitted' ? <Pressable onPress={onWithdraw} style={styles.archive}><AppText weight="semibold" style={styles.archiveText}>Withdraw Proposal</AppText></Pressable> : null}
    </>
  );
}

function ProposalForm({ post, verification, submitProposal }: { post: ProjectPost; verification?: StudentVerification; submitProposal: ProposalSubmitter }) {
  const [coverLetter, setCoverLetter] = useState('');
  const [amount, setAmount] = useState(String(post.budget));
  const [deliveryDays, setDeliveryDays] = useState('5');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [feedback, setFeedback] = useState<{ message: string; verificationStatus: StudentVerification['status'] | undefined }>();

  const handleSubmit = () => {
    consumeResult(submitProposal(post.id, {
      coverLetter,
      amount: parseNumberOrZero(amount),
      deliveryDays: parseNumberOrZero(deliveryDays),
      sampleImages: mediaInputs(images),
    }), (result) => {
      if (!result.ok) return setFeedback({ message: result.message, verificationStatus: verification?.status });
      setFeedback(undefined);
      Alert.alert('Proposal submitted', 'The client can now compare your proposal.');
    });
  };
  const clearFeedback = () => setFeedback(undefined);
  const verificationRequired = verification?.status !== 'verified';
  const visibleFeedback = verification?.status === 'verified' && feedback?.verificationStatus !== 'verified' ? undefined : feedback?.message;

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
      <ImageUploader purpose="proposal_sample" value={images} onChange={setImages} max={3} label="Optional Work Samples" defaultAltText="Proposal work sample" />
      <View style={styles.fieldGap} />
      <FormField
        accessibilityLabel="Delivery days"
        icon="alarm-outline"
        value={deliveryDays}
        onChangeText={(value) => { setDeliveryDays(value); clearFeedback(); }}
        placeholder="Delivery days"
        keyboardType="number-pad"
      />
      {visibleFeedback ? <ProposalFeedback message={visibleFeedback} verificationRequired={verificationRequired} /> : null}
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
  content: { paddingBottom: 100 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: contentPadding },
  hero: { backgroundColor: colors.red, paddingHorizontal: contentPadding, paddingBottom: 48, borderBottomLeftRadius: 42, borderBottomRightRadius: 42 },
  backButton: { marginBottom: 24 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 },
  heroTitle: { color: colors.white, fontSize: 26, lineHeight: 34, flex: 1, marginRight: 12 },
  heroBudget: { color: colors.white, fontSize: 20 },
  clientCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, marginHorizontal: contentPadding, marginTop: 16, borderRadius: 14, padding: 14, ...shadow },
  clientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 15 },
  clientCategory: { color: colors.muted, fontSize: 11, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border },
  description: { color: colors.ink, fontSize: 13, lineHeight: 24 },
  aboutCard: { backgroundColor: colors.white, marginHorizontal: contentPadding, marginTop: 16, borderRadius: 14, padding: 17, ...shadow },
  sectionHeading: { fontSize: 18, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, marginHorizontal: contentPadding, marginTop: 16, borderRadius: 14, padding: 14, ...shadow },
  infoHalf: { flex: 1, alignItems: 'center', gap: 4 },
  infoDivider: { width: 1, height: 40, backgroundColor: colors.border },
  infoLabel: { color: colors.muted, fontSize: 10 },
  infoValue: { fontSize: 13 },
  skillsRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginTop: 10 },
  skill: { backgroundColor: colors.blush, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  skillText: { color: colors.burgundy, fontSize: 11 },
  bookingButton: { marginHorizontal: contentPadding, marginTop: 20 },
  manageBottomWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingBottom: 12, paddingHorizontal: 12, ...shadow },
  manageBottomBar: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red, borderRadius: 14, padding: 16 },
  manageBottomBarText: { color: colors.white, fontSize: 15, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: contentPadding, paddingTop: 20, paddingBottom: 12 },
  modalTitle: { fontSize: 18 },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: contentPadding, paddingBottom: 36, gap: 10 },
  controlGroup: { gap: 10 },
  panel: { backgroundColor: colors.white, marginHorizontal: contentPadding, marginTop: 20, borderRadius: 14, padding: 17, gap: 10, ...shadow },
  panelTitle: { fontSize: 17, marginBottom: 3 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  controlText: { flex: 1, color: colors.ink, fontSize: 13 },
  archiveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42 },
  archiveText: { color: colors.red, fontSize: 13 },
  archive: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.burgundy, fontSize: 13 },
  muted: { color: colors.muted, fontSize: 10, marginTop: 2 },
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
