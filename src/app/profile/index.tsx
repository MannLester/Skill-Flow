import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, BottomNav, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding, shadow } from '@/constants/theme';
import { formatPeso, Service } from '@/data/fixtures';
import { CareerReadinessBreakdown } from '@/domain/career-readiness';
import { Certification, DemoAccount, PortfolioItem, ProjectBooking, ProjectReview, StudentVerification, UserProfile, useSession } from '@/context/session';

export default function ProfileScreen() {
  const { addCompletedProjectToPortfolio, bookings, certifications, currentAccount, getCareerReadiness, homeRoute, messages, portfolioItems, profiles, reviews, services, verifications } = useSession();
  if (!currentAccount) return <MobilePage><AppHeader title="Profile" onBack={() => router.back()} /><View style={styles.center}><AppText>Please log in to view a profile.</AppText></View></MobilePage>;
  const profile = profiles.find((item) => item.accountId === currentAccount.id);
  const verification = verifications.find((item) => item.studentId === currentAccount.id);
  const ownPortfolio = portfolioItems.filter((item) => item.studentId === currentAccount.id);
  const ownCertifications = certifications.filter((item) => item.studentId === currentAccount.id);
  const ownServices = services.filter((item) => item.providerId === currentAccount.id);
  const ownProjects = bookings.filter((item) => item.clientId === currentAccount.id || item.studentId === currentAccount.id);
  const ownReviews = reviews.filter((item) => item.studentId === currentAccount.id);
  const earnings = currentAccount.role === 'student' ? bookings.filter((item) => item.studentId === currentAccount.id && ['completed', 'reviewed'].includes(item.status)).reduce((total, item) => total + item.budget, 0) : 0;
  const completedNotAdded = ownProjects.filter((item) => item.studentId === currentAccount.id && ['completed', 'reviewed'].includes(item.status) && !ownPortfolio.some((portfolio) => portfolio.sourceProjectId === item.id));
  const hasUnreadMessages = messages.some((message) => message.senderId !== currentAccount.id && !message.readBy.includes(currentAccount.id));
  const addProject = (projectId: string) => { const result = addCompletedProjectToPortfolio(projectId); Alert.alert(result.ok ? 'Added to portfolio' : 'Unable to add project', result.ok ? 'The completed work is now part of your portfolio.' : result.message); };
  const readiness = currentAccount.role === 'student' ? getCareerReadiness(currentAccount.id) : null;

  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Profile" onBack={() => router.back()} right={<Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push('/settings')}><Ionicons name="settings-outline" size={25} color={colors.white} /></Pressable>} />
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileIdentity account={currentAccount} verification={verification} />
        <ProfileAbout profile={profile} />

        <ProfileRoleContent account={currentAccount} readiness={readiness} ownPortfolio={ownPortfolio} ownCertifications={ownCertifications} ownServices={ownServices} earnings={earnings} completedNotAdded={completedNotAdded} ownReviews={ownReviews} ownProjects={ownProjects} onAddProject={addProject} />
      </ScrollView>
      <ProfileBottomNav account={currentAccount} homeRoute={homeRoute} messageUnread={hasUnreadMessages} />
    </MobilePage>
  );
}

function ProfileIdentity({ account, verification }: { account: DemoAccount; verification?: StudentVerification }) {
  const isStudent = account.role === 'student';
  return <View style={styles.identity}><View style={styles.avatar}><Ionicons name={isStudent ? 'school' : 'person'} size={43} color={colors.red} /></View><AppText weight="bold" style={styles.name}>{account.name}</AppText><AppText style={styles.role}>{isStudent ? 'Student Designer' : 'Client'}</AppText><ProfileVerificationBadge isStudent={isStudent} verification={verification} /></View>;
}

function ProfileAbout({ profile }: { profile?: UserProfile }) {
  return <View style={styles.card}><AppText weight="semibold" style={styles.heading}>About</AppText><AppText style={styles.copy}>{profile?.bio || 'No biography added yet.'}</AppText><ProfileDetails profile={profile} /><PrimaryButton title="Edit Profile" onPress={() => router.push('/profile/edit')} style={{ marginTop: 18 }} /></View>;
}

function ProfileVerificationBadge({ isStudent, verification }: { isStudent: boolean; verification?: StudentVerification }) {
  if (!isStudent) return null;
  const isVerified = verification?.status === 'verified';
  return <Pressable onPress={() => router.push('/verification')} style={[styles.verification, isVerified && styles.verified]}><Ionicons name={isVerified ? 'checkmark-circle' : 'shield-outline'} size={17} color={isVerified ? colors.green : colors.burgundy} /><AppText weight="medium" style={styles.verificationText}>{isVerified ? 'Verified Student' : `Verification: ${(verification?.status ?? 'not submitted').replace('_', ' ')}`}</AppText></Pressable>;
}

function ProfileDetails({ profile }: { profile?: UserProfile }) {
  return <><ProfileInfoRow condition={profile?.location} icon="location-outline" /><ProfileInfoRow condition={profile?.organization} icon="business-outline" /><ProfileInfoRow condition={profile?.school} icon="school-outline" /><ProfileInfoRow condition={profile?.program} icon="book-outline" suffix={profile?.gradeLevel} /><ProfileSkills skills={profile?.skills} /></>;
}

function ProfileInfoRow({ condition, icon, suffix }: { condition?: string; icon: 'location-outline' | 'business-outline' | 'school-outline' | 'book-outline'; suffix?: string }) {
  if (!condition) return null;
  return <Info icon={icon} text={suffix ? `${condition} · ${suffix}` : condition} />;
}

function ProfileSkills({ skills }: { skills?: string[] }) {
  if (!skills?.length) return null;
  return <View style={styles.skills}>{skills.map((skill) => <View key={skill} style={styles.skill}><AppText style={styles.skillText}>{skill}</AppText></View>)}</View>;
}

type ProfileRoleContentProps = {
  account: DemoAccount;
  readiness: CareerReadinessBreakdown | null;
  ownPortfolio: PortfolioItem[];
  ownCertifications: Certification[];
  ownServices: Service[];
  earnings: number;
  completedNotAdded: ProjectBooking[];
  ownReviews: ProjectReview[];
  ownProjects: ProjectBooking[];
  onAddProject: (projectId: string) => void;
};

function ProfileRoleContent(props: ProfileRoleContentProps) {
  return props.account.role === 'student' ? <StudentProfileContent {...props} /> : <ClientProfileContent projects={props.ownProjects} />;
}

function StudentProfileContent({ readiness, ownPortfolio, ownCertifications, ownServices, earnings, completedNotAdded, ownReviews, onAddProject }: ProfileRoleContentProps) {
  return <>
    <StudentReadinessCard readiness={readiness} />
    <View style={styles.stats}><Stat value={String(ownPortfolio.length)} label="Portfolio" /><Stat value={String(ownServices.filter((item) => item.status === 'published').length)} label="Services" /><Stat value={formatPeso(earnings)} label="Earned" /></View>
    <PortfolioSummary portfolioCount={ownPortfolio.length} certificationCount={ownCertifications.length} />
    {completedNotAdded.length ? <CompletedWork projects={completedNotAdded} onAddProject={onAddProject} /> : null}
    <ServicesCard services={ownServices} />
    {ownReviews.length ? <ReviewsCard reviews={ownReviews} /> : null}
  </>;
}

function StudentReadinessCard({ readiness }: { readiness: CareerReadinessBreakdown | null }) {
  if (!readiness) return null;
  return <Pressable onPress={() => router.push('/career-readiness')} style={styles.readiness}><View><AppText weight="semibold" style={styles.heading}>Career Readiness</AppText><AppText style={styles.copy}>{readiness.level} · View the transparent breakdown</AppText></View><View style={styles.readinessScore}><AppText weight="bold" style={styles.readinessValue}>{readiness.score}</AppText><AppText style={styles.readinessMax}>/100</AppText></View><Ionicons name="chevron-forward" size={22} color={colors.burgundy} /></Pressable>;
}

function PortfolioSummary({ portfolioCount, certificationCount }: { portfolioCount: number; certificationCount: number }) {
  return <View style={styles.card}><View style={styles.headingRow}><AppText weight="semibold" style={styles.heading}>Portfolio & Certifications</AppText><Pressable onPress={() => router.push('/portfolio')}><AppText weight="medium" style={styles.link}>Manage</AppText></Pressable></View><AppText style={styles.copy}>{portfolioCount} portfolio item{portfolioCount === 1 ? '' : 's'} · {certificationCount} certification{certificationCount === 1 ? '' : 's'}</AppText></View>;
}

function CompletedWork({ projects, onAddProject }: { projects: ProjectBooking[]; onAddProject: (projectId: string) => void }) {
  return <View style={styles.card}><AppText weight="semibold" style={styles.heading}>Completed Work</AppText><AppText style={styles.copy}>Add finished client projects as portfolio evidence.</AppText>{projects.map((project) => <Pressable key={project.id} onPress={() => onAddProject(project.id)} style={styles.actionRow}><AppText weight="medium" style={{ flex: 1 }}>{project.title}</AppText><AppText weight="semibold" style={styles.link}>Add</AppText></Pressable>)}</View>;
}

function ServicesCard({ services }: { services: Service[] }) {
  return <View style={styles.card}><View style={styles.headingRow}><AppText weight="semibold" style={styles.heading}>My Services</AppText><Pressable onPress={() => router.push('/services/new')}><AppText weight="medium" style={styles.link}>Create</AppText></Pressable></View>{services.length ? services.map((service) => <Pressable key={service.id} onPress={() => router.push({ pathname: '/services/[serviceId]/edit', params: { serviceId: service.id } })} style={styles.actionRow}><View style={{ flex: 1 }}><AppText weight="medium">{service.title}</AppText><AppText style={styles.small}>{service.status}</AppText></View><Ionicons name="create-outline" size={21} color={colors.burgundy} /></Pressable>) : <AppText style={styles.copy}>No services created yet.</AppText>}</View>;
}

function ReviewsCard({ reviews }: { reviews: ProjectReview[] }) {
  return <View style={styles.card}><AppText weight="semibold" style={styles.heading}>Client Reviews</AppText>{reviews.map((review) => <View key={review.id} style={styles.review}><AppText weight="semibold">{review.rating}/5</AppText><AppText style={styles.copy}>{review.comment}</AppText></View>)}</View>;
}

function ClientProfileContent({ projects }: { projects: ProjectBooking[] }) {
  return <View style={styles.card}><AppText weight="semibold" style={styles.heading}>Client Activity</AppText><AppText style={styles.copy}>{projects.length} project request{projects.length === 1 ? '' : 's'} created in this local demonstration.</AppText></View>;
}

function ProfileBottomNav({ account, homeRoute, messageUnread }: { account: DemoAccount; homeRoute: '/student-home' | '/client-home'; messageUnread: boolean }) {
  const isStudent = account.role === 'student';
  const isClient = account.role === 'client';
  return <BottomNav active="profile" onHome={() => router.replace(homeRoute)} onProjects={() => router.push('/projects')} onPortfolio={isStudent ? () => router.push('/portfolio') : undefined} onMessages={() => router.push('/messages')} onSaved={isClient ? () => router.push({ pathname: '/marketplace', params: { saved: 'true' } }) : undefined} onProfile={() => undefined} messageUnread={messageUnread} variant={isClient ? 'client' : 'student'} />;
}

function Info({ icon, text }: { icon: 'location-outline' | 'business-outline' | 'school-outline' | 'book-outline'; text: string }) { return <View style={styles.info}><Ionicons name={icon} size={18} color={colors.burgundy} /><AppText style={styles.infoText}>{text}</AppText></View>; }
function Stat({ value, label }: { value: string; label: string }) { return <View style={styles.stat}><AppText weight="bold" style={styles.statValue}>{value}</AppText><AppText style={styles.small}>{label}</AppText></View>; }

const styles = StyleSheet.create({
  content: { padding: contentPadding, gap: 16, paddingBottom: 30 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, identity: { alignItems: 'center', paddingVertical: 10 }, avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, name: { fontSize: 25, marginTop: 12 }, role: { color: colors.muted, fontSize: 12, marginTop: 2 }, verification: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: colors.blush, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 6 }, verified: { backgroundColor: colors.greenSoft }, verificationText: { color: colors.burgundy, fontSize: 10, textTransform: 'capitalize' }, card: { backgroundColor: colors.white, borderRadius: 14, padding: 17, ...shadow }, readiness: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.blush, borderRadius: 14, padding: 16 }, readinessScore: { flexDirection: 'row', alignItems: 'baseline' }, readinessValue: { color: colors.red, fontSize: 27 }, readinessMax: { color: colors.burgundy, fontSize: 9 }, heading: { fontSize: 17 }, headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, copy: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 6 }, info: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 }, infoText: { fontSize: 12 }, skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 13 }, skill: { backgroundColor: colors.blush, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }, skillText: { color: colors.burgundy, fontSize: 10 }, stats: { flexDirection: 'row', gap: 8 }, stat: { flex: 1, alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, paddingVertical: 14, ...shadow }, statValue: { fontSize: 16 }, small: { color: colors.muted, fontSize: 9, textTransform: 'capitalize', marginTop: 2 }, link: { color: colors.burgundy, fontSize: 12 }, actionRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10, paddingTop: 10 }, review: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10, paddingTop: 10 },
});
