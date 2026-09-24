import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { AppHeader, AppText, MobilePage, PrimaryButton, LocalizedTextInput } from '@/components/ui';
import { ImageUploader } from '@/components/image-uploader';
import { MediaGallery } from '@/components/media-gallery';
import { colors, contentPadding, font, shadow } from '@/constants/theme';
import { formatPeso } from '@/data/fixtures';
import { DemoAccount, ProjectAction, ProjectBooking, ProjectReview, ProjectStatus, useSession } from '@/context/session.remote';
import type { DemoLedgerEntry, DemoPaymentMethod } from '@/context/session';
import { consumeResult } from '@/utils/consume-result';
import { mediaInputs, type MediaInput, type UploadedImage } from '@/media/types';

const statusLabels: Record<ProjectStatus, string> = {
  requested: 'Request Sent', accepted: 'Accepted', declined: 'Declined', cancelled: 'Cancelled', demo_funded: 'Demo Funds Reserved', in_progress: 'In Progress', submitted: 'Delivery Submitted', revision_requested: 'Revision Requested', completed: 'Completed', reviewed: 'Reviewed',
};

type ProjectActionPayload = { note?: string; rating?: number; comment?: string; demoPaymentMethod?: DemoPaymentMethod; deliveryImages?: MediaInput[] };
type RunProjectAction = (action: ProjectAction, payload?: ProjectActionPayload) => void;
type ActionFeedback = { context: string; message: string };

export default function ProjectDetailsScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { accounts, actOnProject, addCompletedProjectToPortfolio, bookings, currentAccount, homeRoute, ledger, portfolioItems, reviews } = useSession();
  const booking = bookings.find((item) => item.id === projectId);
  const actionContext = projectActionContext(currentAccount, booking, projectId);
  const form = useProjectActionForm(String(projectId), actionContext, actOnProject);

  if (!booking) return <MobilePage><StatusBar style="light" /><AppHeader title="Project" onBack={() => router.back()} /><View style={styles.missing}><AppText weight="semibold">Project booking not found.</AppText><PrimaryButton title="Go Home" onPress={() => router.replace(homeRoute)} /></View></MobilePage>;

  const { isClient, isStudent } = projectRoles(currentAccount, booking);
  const client = accounts.find((account) => account.id === booking.clientId);
  const student = accounts.find((account) => account.id === booking.studentId);
  const review = reviews.find((item) => item.projectId === booking.id);
  const hold = ledger?.find((item) => item.projectId === booking.id && item.type === 'hold');
  const refund = ledger?.find((item) => item.projectId === booking.id && item.type === 'refund');
  const addedToPortfolio = portfolioItems.some((item) => item.sourceProjectId === booking.id);
  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Project Booking" onBack={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <ProjectStatusCard booking={booking} isStudent={isStudent} client={client} student={student} />
        <ProjectDetailCard booking={booking} review={review} />
        <ProjectLinks booking={booking} isClient={isClient} isStudent={isStudent} addedToPortfolio={addedToPortfolio} addToPortfolio={addCompletedProjectToPortfolio} />
        {isClient && hold ? <DemoReceipt hold={hold} status={refund ? 'Simulated refund' : ['completed', 'reviewed'].includes(booking.status) ? 'Simulated release' : 'Simulated hold'} /> : null}
        <ProjectActions status={booking.status} budget={booking.budget} isClient={isClient} isStudent={isStudent} {...form} />
        <AppText style={styles.demoNote}>All funding and earnings shown in this project are simulated. No payment credentials or real transfers are used.</AppText>
      </ScrollView>
    </MobilePage>
  );
}

function projectActionContext(account: DemoAccount | null | undefined, booking: ProjectBooking | undefined, projectId: string | undefined) {
  return `${account?.id ?? 'guest'}:${booking?.id ?? projectId ?? 'missing'}:${booking?.status ?? 'missing'}`;
}

function projectRoles(account: DemoAccount | null | undefined, booking: ProjectBooking) {
  return { isClient: account?.id === booking.clientId, isStudent: account?.id === booking.studentId };
}

function useProjectActionForm(bookingId: string, actionContext: string, actOnProject: ReturnType<typeof useSession>['actOnProject']) {
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback>();
  const run: RunProjectAction = (action, payload) => {
    consumeResult(actOnProject(bookingId, action, payload), (result) => {
      if (!result.ok) return setActionFeedback({ context: actionContext, message: result.message });
      setActionFeedback(undefined);
      setNote('');
      if (action === 'submit') setImages([]);
      if (action === 'review') setComment('');
    });
  };
  const clearActionFeedback = () => setActionFeedback(undefined);
  const updateNote = (value: string) => { setNote(value); clearActionFeedback(); };
  const updateRating = (value: number) => { setRating(value); clearActionFeedback(); };
  const updateComment = (value: string) => { setComment(value); clearActionFeedback(); };
  const visibleFeedback = actionFeedback?.context === actionContext ? actionFeedback.message : undefined;
  return { note, setNote: updateNote, rating, setRating: updateRating, comment, setComment: updateComment, images, setImages, feedback: visibleFeedback, run };
}

function ProjectStatusCard({ booking, isStudent, client, student }: { booking: ProjectBooking; isStudent: boolean; client?: DemoAccount; student?: DemoAccount }) {
  const complete = booking.status === 'completed' || booking.status === 'reviewed';
  const party = isStudent ? `Client: ${client?.name ?? 'Client'}` : `Student: ${student?.name ?? 'Student'}`;
  return <View style={styles.statusCard}><View style={styles.statusIcon}><Ionicons name={complete ? 'checkmark-circle' : 'briefcase'} size={29} color={colors.white} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={styles.statusTitle}>{statusLabels[booking.status]}</AppText><AppText style={styles.statusDetail}>{party}</AppText></View></View>;
}

function ProjectDetailCard({ booking, review }: { booking: ProjectBooking; review?: ProjectReview }) {
  return <View style={styles.card}><AppText weight="bold" style={styles.title}>{booking.title}</AppText><Detail label="Budget" value={formatPeso(booking.budget)} /><Detail label="Delivery" value={`${booking.deliveryDays} Days`} /><Detail label="Status" value={statusLabels[booking.status]} /><View style={styles.divider} /><AppText weight="semibold">Project Details</AppText><AppText style={styles.description}>{booking.description}</AppText><MediaGallery targetType="booking" targetId={booking.id} purposes={['booking_reference']} />{booking.revisionNote ? <InfoBlock title="Requested Revision" text={booking.revisionNote} warning /> : null}{booking.deliveryNote ? <InfoBlock title="Latest Delivery" text={booking.deliveryNote} /> : null}<MediaGallery targetType="booking" targetId={booking.id} purposes={['delivery_image']} />{review ? <InfoBlock title={`Client Review — ${review.rating}/5`} text={review.comment} /> : null}</View>;
}

function ProjectLinks({ booking, isClient, isStudent, addedToPortfolio, addToPortfolio }: { booking: ProjectBooking; isClient: boolean; isStudent: boolean; addedToPortfolio: boolean; addToPortfolio: ReturnType<typeof useSession>['addCompletedProjectToPortfolio'] }) {
  const canAdd = isStudent && ['completed', 'reviewed'].includes(booking.status) && !addedToPortfolio;
  const add = () => {
    consumeResult(addToPortfolio(booking.id), (result) => {
      Alert.alert(result.ok ? 'Added to portfolio' : 'Unable to add project', result.ok ? 'The completed project is now portfolio evidence.' : result.message);
    });
  };
  return <>{isClient || isStudent ? <PrimaryButton title="Open Project Messages" onPress={() => router.push({ pathname: '/messages/[projectId]', params: { projectId: booking.id } })} /> : null}{canAdd ? <SecondaryButton title="Add Completed Work to Portfolio" onPress={add} /> : null}</>;
}

type ProjectActionsProps = {
  status: ProjectStatus;
  budget: number;
  isClient: boolean;
  isStudent: boolean;
  note: string;
  setNote: (value: string) => void;
  rating: number;
  setRating: (value: number) => void;
  comment: string;
  setComment: (value: string) => void;
  feedback?: string;
  images: UploadedImage[];
  setImages: (images: UploadedImage[]) => void;
  run: RunProjectAction;
};

function ProjectActions(props: ProjectActionsProps) {
  if (props.isStudent) return <StudentProjectActions {...props} />;
  if (props.isClient) return <ClientProjectActions {...props} />;
  return <WaitingAction status={props.status} isClient={false} />;
}

function StudentProjectActions({ status, note, setNote, images, setImages, feedback, run }: ProjectActionsProps) {
  if (status === 'requested') return <View style={styles.actionCard}><AppText weight="semibold" style={styles.actionTitle}>Respond to Request</AppText><PrimaryButton title="Accept Request" onPress={() => run('accept')} /><SecondaryButton title="Decline Request" onPress={() => run('decline')} danger /></View>;
  if (status === 'demo_funded') return <View style={styles.actionCard}><AppText style={styles.helper}>The client reserved simulated funds. You can begin the project.</AppText><PrimaryButton title="Start Work" onPress={() => run('start')} /></View>;
  if (status === 'in_progress' || status === 'revision_requested') return <View style={styles.actionCard}><AppText weight="semibold" style={styles.actionTitle}>{status === 'revision_requested' ? 'Submit Revised Delivery' : 'Submit Delivery'}</AppText><LocalizedTextInput accessibilityLabel="Delivery note" accessibilityHint={feedback ?? 'Required. Describe the completed work or demo file.'} value={note} onChangeText={setNote} placeholder="Describe the completed work or demo file…" placeholderTextColor={colors.muted} multiline style={[styles.textArea, feedback && styles.textAreaError]} /><ImageUploader purpose="delivery_image" value={images} onChange={setImages} max={5} label="Optional Delivery Images" defaultAltText="Project delivery image" /><ProjectActionFeedback message={feedback} /><PrimaryButton title={status === 'revision_requested' ? 'Submit Revision' : 'Submit Delivery'} onPress={() => run('submit', deliveryPayload(note, images))} /></View>;
  return <WaitingAction status={status} isClient={false} />;
}

function deliveryPayload(note: string, images: UploadedImage[]): ProjectActionPayload {
  return images.length ? { note, deliveryImages: mediaInputs(images) } : { note };
}

function ClientProjectActions({ status, budget, note, setNote, rating, setRating, comment, setComment, feedback, run }: ProjectActionsProps) {
  if (status === 'requested') return <View style={styles.actionCard}><AppText style={styles.waiting}>Waiting for the student to respond.</AppText><SecondaryButton title="Cancel Request" onPress={() => run('cancel')} danger /></View>;
  if (status === 'accepted') return <DemoCheckout budget={budget} run={run} feedback={feedback} />;
  if (status === 'demo_funded') return <View style={styles.actionCard}><AppText style={styles.waiting}>Demo funds are reserved. Waiting for the student to start work.</AppText><SecondaryButton title="Cancel and Refund Demo Funds" onPress={() => run('cancel')} danger /></View>;
  if (status === 'submitted') return <View style={styles.actionCard}><AppText weight="semibold" style={styles.actionTitle}>Review Delivery</AppText><LocalizedTextInput accessibilityLabel="Revision instructions" accessibilityHint={feedback ?? 'Required when requesting a revision.'} value={note} onChangeText={setNote} placeholder="Revision instructions, if needed…" placeholderTextColor={colors.muted} multiline style={[styles.textArea, feedback && styles.textAreaError]} /><PrimaryButton title="Approve and Release Demo Earnings" onPress={() => run('approve')} /><ProjectActionFeedback message={feedback} /><SecondaryButton title="Request Revision" onPress={() => run('request_revision', { note })} /></View>;
  if (status === 'completed') return <View style={styles.actionCard}><AppText weight="semibold" style={styles.actionTitle}>Rate the Student</AppText><View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <Pressable accessibilityRole="button" accessibilityLabel={`${value} star rating`} key={value} onPress={() => setRating(value)}><Ionicons name={value <= rating ? 'star' : 'star-outline'} size={31} color={colors.gold} /></Pressable>)}</View><LocalizedTextInput accessibilityLabel="Project review" accessibilityHint={feedback ?? 'Required. Add a review before submitting.'} value={comment} onChangeText={setComment} placeholder="Write a short review…" placeholderTextColor={colors.muted} multiline style={[styles.textArea, feedback && styles.textAreaError]} /><ProjectActionFeedback message={feedback} /><PrimaryButton title="Submit Review" onPress={() => run('review', { rating, comment })} /></View>;
  return <WaitingAction status={status} isClient />;
}

const demoMethodLabels: Record<DemoPaymentMethod, string> = { demo_wallet: 'Demo e-wallet', demo_bank: 'Demo bank transfer', demo_cash: 'Demo cash' };

function DemoCheckout({ budget, run, feedback }: { budget: number; run: RunProjectAction; feedback?: string }) {
  const [method, setMethod] = useState<DemoPaymentMethod>();
  const [methodError, setMethodError] = useState(false);
  return <View style={styles.actionCard}><AppText weight="semibold" style={styles.actionTitle}>Demo Checkout</AppText><AppText style={styles.helper}>Choose a fictional payment method for this display-only checkout. No account details are needed and no money moves.</AppText><Detail label="Demo amount" value={formatPeso(budget)} />{(Object.keys(demoMethodLabels) as DemoPaymentMethod[]).map((option) => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: method === option }} onPress={() => { setMethod(option); setMethodError(false); }} style={[styles.method, method === option && styles.methodSelected]}><Ionicons name={method === option ? 'radio-button-on' : 'radio-button-off'} size={20} color={colors.red} /><AppText>{demoMethodLabels[option]}</AppText></Pressable>)}<ProjectActionFeedback message={methodError ? 'Choose a simulated payment method.' : feedback} /><PrimaryButton title="Confirm Simulated Payment" onPress={() => { if (method) run('fund', { demoPaymentMethod: method }); else setMethodError(true); }} /><AppText style={styles.helper}>Confirmation creates a demo hold and receipt only.</AppText><SecondaryButton title="Cancel Request" onPress={() => run('cancel')} danger /></View>;
}

function DemoReceipt({ hold, status }: { hold: DemoLedgerEntry; status: string }) {
  return <View style={styles.card}><AppText weight="semibold" style={styles.actionTitle}>Demo Payment Receipt</AppText><Detail label="Amount" value={formatPeso(hold.amount)} /><Detail label="Method" value={hold.demoPaymentMethod ? demoMethodLabels[hold.demoPaymentMethod] : 'Earlier demo hold'} /><Detail label="Status" value={status} /><AppText style={styles.helper}>Reference: {hold.id}</AppText><AppText style={styles.helper}>Simulation only. This is not proof of payment.</AppText></View>;
}

function WaitingAction({ status, isClient }: { status: ProjectStatus; isClient: boolean }) {
  if (status === 'declined' || status === 'cancelled') return <View style={styles.actionCard}><AppText style={styles.waiting}>This request is closed. Create a new request if you want to restart the project.</AppText></View>;
  if (status === 'reviewed') return <View style={styles.actionCard}><AppText style={styles.waiting}>This project lifecycle is complete.</AppText></View>;
  return <View style={styles.actionCard}><AppText style={styles.waiting}>{isClient ? 'Waiting for the student’s next action.' : 'Waiting for the client’s next action.'}</AppText></View>;
}

function ProjectActionFeedback({ message }: { message?: string }) {
  if (!message) return null;
  return <View testID="project-action-feedback" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.feedback}><Ionicons name="alert-circle-outline" size={21} color={colors.burgundy} /><View style={{ flex: 1 }}><AppText weight="semibold" style={styles.feedbackTitle}>Action unavailable</AppText><AppText style={styles.feedbackText}>{message}</AppText></View></View>;
}

function SecondaryButton({ title, onPress, danger = false }: { title: string; onPress: () => void; danger?: boolean }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondary}><AppText weight="semibold" style={{ color: danger ? colors.red : colors.burgundy }}>{title}</AppText></Pressable>; }
function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.detailRow}><AppText style={styles.detailLabel}>{label}</AppText><AppText weight="semibold">{value}</AppText></View>; }
function InfoBlock({ title, text, warning = false }: { title: string; text: string; warning?: boolean }) { return <View style={[styles.infoBlock, warning && { backgroundColor: colors.warningSurface }]}><AppText weight="semibold" style={{ fontSize: 13 }}>{title}</AppText><AppText style={styles.infoText}>{text}</AppText></View>; }

const styles = StyleSheet.create({
  content: { padding: contentPadding, gap: 18, paddingBottom: 38 }, statusCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 17, borderRadius: 14, backgroundColor: colors.blush, ...shadow }, statusIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red }, statusTitle: { fontSize: 18 }, statusDetail: { color: colors.muted, fontSize: 12, marginTop: 3 }, card: { padding: 18, borderRadius: 14, backgroundColor: colors.background, ...shadow }, title: { fontSize: 23, marginBottom: 17 }, detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 11 }, detailLabel: { color: colors.muted }, divider: { height: 1, backgroundColor: colors.border, marginVertical: 18 }, description: { lineHeight: 23, marginTop: 8 }, infoBlock: { backgroundColor: colors.blush, borderRadius: 10, padding: 12, marginTop: 15 }, infoText: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 4 }, actionCard: { gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border }, actionTitle: { fontSize: 17 }, helper: { color: colors.muted, fontSize: 11, lineHeight: 17 }, waiting: { color: colors.muted, textAlign: 'center', lineHeight: 21 }, secondary: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, method: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderWidth: 1, borderRadius: 9, borderColor: colors.border }, methodSelected: { borderColor: colors.red, backgroundColor: colors.blush }, textArea: { minHeight: 100, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontFamily: font.regular, fontSize: 13, color: colors.ink, textAlignVertical: 'top' }, textAreaError: { borderColor: colors.red, backgroundColor: colors.blush }, feedback: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1, borderColor: colors.red, borderRadius: 10, backgroundColor: colors.blush, padding: 11 }, feedbackTitle: { color: colors.red, fontSize: 12 }, feedbackText: { color: colors.burgundy, fontSize: 11, lineHeight: 17, marginTop: 2 }, stars: { flexDirection: 'row', justifyContent: 'center', gap: 6 }, demoNote: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center' }, missing: { flex: 1, padding: contentPadding, justifyContent: 'center', gap: 20 },
});
