import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding, shadow } from '@/constants/theme';
import { StoreResult, StudentVerification, VerificationStatus, useSession } from '@/context/session';

export default function VerificationScreen() {
  const { currentAccount, simulateVerificationReview, submitVerification, verifications } = useSession();
  const current = verifications.find((item) => item.studentId === currentAccount?.id);
  const { status, school, studentNumber, program, gradeLevel, year, sampleDocument, setSchool, setStudentNumber, setProgram, setGradeLevel, setYear, setSampleDocument } = useVerificationFormState(current);
  if (!currentAccount || currentAccount.role !== 'student') return <MobilePage><AppHeader title="Student Verification" onBack={() => router.back()} /><View style={styles.center}><AppText>Student verification is only available to Student Designer accounts.</AppText></View></MobilePage>;
  return <VerificationContent current={current} status={status} school={school} studentNumber={studentNumber} program={program} gradeLevel={gradeLevel} year={year} sampleDocument={sampleDocument} setSchool={setSchool} setStudentNumber={setStudentNumber} setProgram={setProgram} setGradeLevel={setGradeLevel} setYear={setYear} setSampleDocument={setSampleDocument} submitVerification={submitVerification} simulateVerificationReview={simulateVerificationReview} />;
}

function useVerificationFormState(current?: StudentVerification) {
  const [school, setSchool] = useState(defaultVerificationText(current?.school, 'Batangas State University TNEU'));
  const [studentNumber, setStudentNumber] = useState('2026-1234-5678');
  const [program, setProgram] = useState(defaultVerificationText(current?.program, 'Senior High School'));
  const [gradeLevel, setGradeLevel] = useState(defaultVerificationText(current?.gradeLevel, 'Grade 12'));
  const [year, setYear] = useState(defaultVerificationYear(current?.graduationYear));
  const [sampleDocument, setSampleDocument] = useState(defaultVerificationText(current?.sampleDocumentName, ''));
  const status = defaultVerificationStatus(current?.status);
  return { status, school, studentNumber, program, gradeLevel, year, sampleDocument, setSchool, setStudentNumber, setProgram, setGradeLevel, setYear, setSampleDocument };
}

function defaultVerificationText(value: string | undefined, fallback: string) {
  return value ?? fallback;
}

function defaultVerificationYear(value?: number) {
  return value ? String(value) : '2027';
}

function defaultVerificationStatus(value?: VerificationStatus): VerificationStatus {
  return value ?? 'not_submitted';
}

type VerificationInput = { school: string; studentNumber: string; program: string; gradeLevel: string; graduationYear: number; sampleDocumentName: string };
type VerificationContentProps = {
  current?: StudentVerification;
  status: VerificationStatus;
  school: string;
  studentNumber: string;
  program: string;
  gradeLevel: string;
  year: string;
  sampleDocument: string;
  setSchool: (value: string) => void;
  setStudentNumber: (value: string) => void;
  setProgram: (value: string) => void;
  setGradeLevel: (value: string) => void;
  setYear: (value: string) => void;
  setSampleDocument: (value: string) => void;
  submitVerification: (input: VerificationInput) => StoreResult;
  simulateVerificationReview: (approved: boolean, rejectionReason?: string) => StoreResult;
};

function VerificationContent({ current, status, school, studentNumber, program, gradeLevel, year, sampleDocument, setSchool, setStudentNumber, setProgram, setGradeLevel, setYear, setSampleDocument, submitVerification, simulateVerificationReview }: VerificationContentProps) {
  const submit = () => submitVerificationForm(submitVerification, { school, studentNumber, program, gradeLevel, graduationYear: Number(year), sampleDocumentName: sampleDocument });
  const review = (approved: boolean) => reviewVerification(simulateVerificationReview, approved);
  if (status === 'verified') return <VerifiedVerification current={current} />;
  if (status === 'pending') return <PendingVerification onReview={review} />;
  return <VerificationForm current={current} status={status} school={school} studentNumber={studentNumber} program={program} gradeLevel={gradeLevel} year={year} sampleDocument={sampleDocument} setSchool={setSchool} setStudentNumber={setStudentNumber} setProgram={setProgram} setGradeLevel={setGradeLevel} setYear={setYear} setSampleDocument={setSampleDocument} onSubmit={submit} />;
}

function submitVerificationForm(submitVerification: (input: VerificationInput) => StoreResult, input: VerificationInput) {
  const result = submitVerification(input);
  Alert.alert(result.ok ? 'Submitted' : 'Unable to submit', result.ok ? 'The demo verification is now pending review.' : result.message);
}

function reviewVerification(simulateVerificationReview: (approved: boolean, rejectionReason?: string) => StoreResult, approved: boolean) {
  const reason = approved ? undefined : 'Student ID image is unclear.';
  const result = simulateVerificationReview(approved, reason);
  Alert.alert(result.ok ? (approved ? 'Simulation approved' : 'Simulation rejected') : 'Unable to review', result.ok ? (approved ? 'The verified badge is now active.' : 'The student can correct the form and resubmit.') : result.message);
}

function VerifiedVerification({ current }: { current?: StudentVerification }) {
  return <VerificationPage><View style={styles.statusPage}><View style={[styles.statusIcon, { backgroundColor: colors.greenSoft }]}><Ionicons name="checkmark-circle" size={55} color={colors.green} /></View><AppText weight="bold" style={styles.statusTitle}>Verified Student</AppText><AppText style={styles.centerCopy}>This is a simulated verification for the academic demonstration.</AppText><View style={styles.summary}><Row label="School" value={current?.school ?? ''} /><Row label="Student Number" value={current?.studentNumberMasked ?? ''} /><Row label="Program" value={current?.program ?? ''} /><Row label="Grade" value={current?.gradeLevel ?? ''} /></View><PrimaryButton title="Return to Profile" onPress={() => router.replace('/profile')} style={{ width: '100%' }} /></View></VerificationPage>;
}

function PendingVerification({ onReview }: { onReview: (approved: boolean) => void }) {
  return <VerificationPage><View style={styles.statusPage}><View style={styles.statusIcon}><Ionicons name="time-outline" size={52} color={colors.burgundy} /></View><AppText weight="bold" style={styles.statusTitle}>Review Pending</AppText><AppText style={styles.centerCopy}>No university or external verifier is contacted. Use one of the controls below to demonstrate the review outcome.</AppText><PrimaryButton title="Simulate Approval" onPress={() => onReview(true)} style={{ width: '100%', marginTop: 20 }} /><Pressable onPress={() => onReview(false)} style={styles.reject}><AppText weight="semibold" style={{ color: colors.red }}>Simulate Rejection</AppText></Pressable></View></VerificationPage>;
}

function VerificationPage({ children }: { children: ReactNode }) {
  return <MobilePage><StatusBar style="light" /><AppHeader title="Student Verification" onBack={() => router.back()} />{children}</MobilePage>;
}

type VerificationFormProps = Omit<VerificationContentProps, 'submitVerification' | 'simulateVerificationReview'> & { onSubmit: () => void };

function VerificationForm({ current, status, school, studentNumber, program, gradeLevel, year, sampleDocument, setSchool, setStudentNumber, setProgram, setGradeLevel, setYear, setSampleDocument, onSubmit }: VerificationFormProps) {
  return <VerificationPage><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><View style={styles.warning}><Ionicons name="information-circle-outline" size={24} color={colors.burgundy} /><AppText style={styles.warningText}>Demo only. Use sample information and never upload a real student ID.</AppText></View>{status === 'rejected' ? <View style={styles.rejected}><AppText weight="semibold" style={{ color: colors.red }}>Verification rejected</AppText><AppText style={styles.warningText}>{current?.rejectionReason}</AppText></View> : null}<Label text="School or Campus" /><FormField icon="school-outline" value={school} onChangeText={setSchool} placeholder="School or Campus" /><Label text="Student Number" /><FormField icon="card-outline" value={studentNumber} onChangeText={setStudentNumber} placeholder="Sample Student Number" /><Label text="Program or Strand" /><FormField icon="book-outline" value={program} onChangeText={setProgram} placeholder="Program or Strand" /><Label text="Grade Level" /><FormField icon="ribbon-outline" value={gradeLevel} onChangeText={setGradeLevel} placeholder="Grade Level" /><Label text="Graduation Year" /><FormField icon="calendar-outline" value={year} onChangeText={setYear} placeholder="Graduation Year" keyboardType="number-pad" /><Label text="Student ID Sample" /><Pressable onPress={() => setSampleDocument('sample-student-id.png')} style={styles.document}><Ionicons name={sampleDocument ? 'checkmark-circle' : 'image-outline'} size={25} color={sampleDocument ? colors.green : colors.burgundy} /><AppText weight="medium" style={{ flex: 1 }}>{sampleDocument || 'Use Sample Student ID'}</AppText></Pressable><PrimaryButton title={status === 'rejected' ? 'Resubmit Verification' : 'Submit for Verification'} onPress={onSubmit} style={{ marginTop: 23 }} /></ScrollView></VerificationPage>;
}

function Label({ text }: { text: string }) { return <AppText weight="semibold" style={styles.label}>{text}</AppText>; }
function Row({ label, value }: { label: string; value: string }) { return <View style={styles.row}><AppText style={{ color: colors.muted }}>{label}</AppText><AppText weight="medium" style={{ flex: 1, textAlign: 'right' }}>{value}</AppText></View>; }
const styles = StyleSheet.create({ content: { padding: contentPadding, paddingBottom: 36 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: contentPadding }, warning: { flexDirection: 'row', gap: 10, backgroundColor: colors.blush, borderRadius: 12, padding: 13 }, warningText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 }, rejected: { backgroundColor: '#fff3f3', borderRadius: 11, padding: 12, marginTop: 13 }, label: { fontSize: 13, marginTop: 16, marginBottom: 7 }, document: { minHeight: 58, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }, statusPage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: contentPadding }, statusIcon: { width: 98, height: 98, borderRadius: 49, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, statusTitle: { fontSize: 24, marginTop: 18 }, centerCopy: { color: colors.muted, fontSize: 12, lineHeight: 20, textAlign: 'center', marginTop: 8 }, summary: { width: '100%', backgroundColor: colors.white, borderRadius: 13, padding: 15, marginVertical: 22, ...shadow }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8 }, reject: { width: '100%', minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 11 } });
