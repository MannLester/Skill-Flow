import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { AppHeader, AppText, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding, font, shadow } from '@/constants/theme';
import { formatPeso } from '@/data/fixtures';
import { ProjectAction, ProjectStatus, useSession } from '@/context/session';

const statusLabels: Record<ProjectStatus, string> = {
  requested: 'Request Sent', accepted: 'Accepted', declined: 'Declined', cancelled: 'Cancelled', demo_funded: 'Demo Funds Reserved', in_progress: 'In Progress', submitted: 'Delivery Submitted', revision_requested: 'Revision Requested', approved: 'Approved', completed: 'Completed', reviewed: 'Reviewed',
};

export default function ProjectDetailsScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { accounts, actOnProject, addCompletedProjectToPortfolio, bookings, currentAccount, homeRoute, portfolioItems, reviews } = useSession();
  const booking = bookings.find((item) => item.id === projectId);
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  if (!booking) return <MobilePage><StatusBar style="light" /><AppHeader title="Project" onBack={() => router.back()} /><View style={styles.missing}><AppText weight="semibold">Project booking not found.</AppText><PrimaryButton title="Go Home" onPress={() => router.replace(homeRoute)} /></View></MobilePage>;

  const isClient = currentAccount?.id === booking.clientId;
  const isStudent = currentAccount?.id === booking.studentId;
  const client = accounts.find((account) => account.id === booking.clientId);
  const student = accounts.find((account) => account.id === booking.studentId);
  const review = reviews.find((item) => item.projectId === booking.id);
  const addedToPortfolio = portfolioItems.some((item) => item.sourceProjectId === booking.id);
  const run = (action: ProjectAction, payload?: { note?: string; rating?: number; comment?: string }) => {
    const result = actOnProject(booking.id, action, payload);
    if (!result.ok) Alert.alert('Action unavailable', result.message);
    else { setNote(''); if (action === 'review') setComment(''); }
  };

  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Project Booking" onBack={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.statusCard}><View style={styles.statusIcon}><Ionicons name={booking.status === 'completed' || booking.status === 'reviewed' ? 'checkmark-circle' : 'briefcase'} size={29} color={colors.white} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={styles.statusTitle}>{statusLabels[booking.status]}</AppText><AppText style={styles.statusDetail}>{isStudent ? `Client: ${client?.name ?? 'Client'}` : `Student: ${student?.name ?? 'Student'}`}</AppText></View></View>
        <View style={styles.card}>
          <AppText weight="bold" style={styles.title}>{booking.title}</AppText>
          <Detail label="Budget" value={formatPeso(booking.budget)} />
          <Detail label="Delivery" value={`${booking.deliveryDays} Days`} />
          <Detail label="Status" value={statusLabels[booking.status]} />
          <View style={styles.divider} />
          <AppText weight="semibold">Project Details</AppText><AppText style={styles.description}>{booking.description}</AppText>
          {booking.revisionNote ? <InfoBlock title="Requested Revision" text={booking.revisionNote} warning /> : null}
          {booking.deliveryNote ? <InfoBlock title="Latest Delivery" text={booking.deliveryNote} /> : null}
          {review ? <InfoBlock title={`Client Review — ${review.rating}/5`} text={review.comment} /> : null}
        </View>

        {isClient || isStudent ? <PrimaryButton title="Open Project Messages" onPress={() => router.push({ pathname: '/messages/[projectId]', params: { projectId: booking.id } })} /> : null}
        {isStudent && ['completed', 'reviewed'].includes(booking.status) && !addedToPortfolio ? <SecondaryButton title="Add Completed Work to Portfolio" onPress={() => { const result = addCompletedProjectToPortfolio(booking.id); Alert.alert(result.ok ? 'Added to portfolio' : 'Unable to add project', result.ok ? 'The completed project is now portfolio evidence.' : result.message); }} /> : null}

        <ProjectActions status={booking.status} isClient={isClient} isStudent={isStudent} note={note} setNote={setNote} rating={rating} setRating={setRating} comment={comment} setComment={setComment} run={run} />

        <AppText style={styles.demoNote}>All funding and earnings shown in this project are simulated. No payment credentials or real transfers are used.</AppText>
      </ScrollView>
    </MobilePage>
  );
}

function ProjectActions({ status, isClient, isStudent, note, setNote, rating, setRating, comment, setComment, run }: {
  status: ProjectStatus; isClient: boolean; isStudent: boolean; note: string; setNote: (value: string) => void; rating: number; setRating: (value: number) => void; comment: string; setComment: (value: string) => void; run: (action: ProjectAction, payload?: { note?: string; rating?: number; comment?: string }) => void;
}) {
  if (isStudent && status === 'requested') return <View style={styles.actionCard}><AppText weight="semibold" style={styles.actionTitle}>Respond to Request</AppText><PrimaryButton title="Accept Request" onPress={() => run('accept')} /><SecondaryButton title="Decline Request" onPress={() => run('decline')} danger /></View>;
  if (isClient && status === 'requested') return <View style={styles.actionCard}><AppText style={styles.waiting}>Waiting for the student to respond.</AppText><SecondaryButton title="Cancel Request" onPress={() => run('cancel')} danger /></View>;
  if (isClient && status === 'accepted') return <View style={styles.actionCard}><AppText weight="semibold" style={styles.actionTitle}>Reserve Demo Funds</AppText><AppText style={styles.helper}>This only creates a simulated ledger hold.</AppText><PrimaryButton title="Reserve Demo Funds" onPress={() => run('fund')} /><SecondaryButton title="Cancel Request" onPress={() => run('cancel')} danger /></View>;
  if (isStudent && status === 'demo_funded') return <View style={styles.actionCard}><AppText style={styles.helper}>The client reserved simulated funds. You can begin the project.</AppText><PrimaryButton title="Start Work" onPress={() => run('start')} /></View>;
  if (isStudent && (status === 'in_progress' || status === 'revision_requested')) return <View style={styles.actionCard}><AppText weight="semibold" style={styles.actionTitle}>{status === 'revision_requested' ? 'Submit Revised Delivery' : 'Submit Delivery'}</AppText><TextInput value={note} onChangeText={setNote} placeholder="Describe the completed work or demo file…" placeholderTextColor={colors.muted} multiline style={styles.textArea} /><PrimaryButton title={status === 'revision_requested' ? 'Submit Revision' : 'Submit Delivery'} onPress={() => run('submit', { note })} /></View>;
  if (isClient && status === 'submitted') return <View style={styles.actionCard}><AppText weight="semibold" style={styles.actionTitle}>Review Delivery</AppText><TextInput value={note} onChangeText={setNote} placeholder="Revision instructions, if needed…" placeholderTextColor={colors.muted} multiline style={styles.textArea} /><PrimaryButton title="Approve and Release Demo Earnings" onPress={() => run('approve')} /><SecondaryButton title="Request Revision" onPress={() => run('request_revision', { note })} /></View>;
  if (isClient && status === 'completed') return <View style={styles.actionCard}><AppText weight="semibold" style={styles.actionTitle}>Rate the Student</AppText><View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <Pressable accessibilityRole="button" accessibilityLabel={`${value} star rating`} key={value} onPress={() => setRating(value)}><Ionicons name={value <= rating ? 'star' : 'star-outline'} size={31} color={colors.gold} /></Pressable>)}</View><TextInput value={comment} onChangeText={setComment} placeholder="Write a short review…" placeholderTextColor={colors.muted} multiline style={styles.textArea} /><PrimaryButton title="Submit Review" onPress={() => run('review', { rating, comment })} /></View>;
  if (status === 'declined' || status === 'cancelled') return <View style={styles.actionCard}><AppText style={styles.waiting}>This request is closed. Create a new request if you want to restart the project.</AppText></View>;
  if (status === 'reviewed') return <View style={styles.actionCard}><AppText style={styles.waiting}>This project lifecycle is complete.</AppText></View>;
  return <View style={styles.actionCard}><AppText style={styles.waiting}>{isClient ? 'Waiting for the student’s next action.' : 'Waiting for the client’s next action.'}</AppText></View>;
}

function SecondaryButton({ title, onPress, danger = false }: { title: string; onPress: () => void; danger?: boolean }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondary}><AppText weight="semibold" style={{ color: danger ? colors.red : colors.burgundy }}>{title}</AppText></Pressable>; }
function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.detailRow}><AppText style={styles.detailLabel}>{label}</AppText><AppText weight="semibold">{value}</AppText></View>; }
function InfoBlock({ title, text, warning = false }: { title: string; text: string; warning?: boolean }) { return <View style={[styles.infoBlock, warning && { backgroundColor: '#fff6df' }]}><AppText weight="semibold" style={{ fontSize: 13 }}>{title}</AppText><AppText style={styles.infoText}>{text}</AppText></View>; }

const styles = StyleSheet.create({
  content: { padding: contentPadding, gap: 18, paddingBottom: 38 }, statusCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 17, borderRadius: 14, backgroundColor: colors.blush, ...shadow }, statusIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red }, statusTitle: { fontSize: 18 }, statusDetail: { color: colors.muted, fontSize: 12, marginTop: 3 }, card: { padding: 18, borderRadius: 14, backgroundColor: colors.white, ...shadow }, title: { fontSize: 23, marginBottom: 17 }, detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 11 }, detailLabel: { color: colors.muted }, divider: { height: 1, backgroundColor: colors.border, marginVertical: 18 }, description: { lineHeight: 23, marginTop: 8 }, infoBlock: { backgroundColor: colors.blush, borderRadius: 10, padding: 12, marginTop: 15 }, infoText: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 4 }, actionCard: { gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border }, actionTitle: { fontSize: 17 }, helper: { color: colors.muted, fontSize: 11, lineHeight: 17 }, waiting: { color: colors.muted, textAlign: 'center', lineHeight: 21 }, secondary: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, textArea: { minHeight: 100, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontFamily: font.regular, fontSize: 13, color: colors.ink, textAlignVertical: 'top' }, stars: { flexDirection: 'row', justifyContent: 'center', gap: 6 }, demoNote: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center' }, missing: { flex: 1, padding: contentPadding, justifyContent: 'center', gap: 20 },
});
