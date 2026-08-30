import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppText, HeroDecor, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding, shadow } from '@/constants/theme';
import { formatPeso, Service } from '@/data/fixtures';
import { CareerReadinessBreakdown } from '@/domain/career-readiness';
import { Certification, DemoAccount, PortfolioItem, ProjectBooking, ProjectReview, StudentVerification, UserProfile, useSession } from '@/context/session.remote';
import { PrimaryTabScene } from '@/navigation/primary-navigation';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { addCompletedProjectToPortfolio, bookings, certifications, currentAccount, getCareerReadiness, portfolioItems, profiles, reviews, services, verifications } = useSession();
  if (!currentAccount) return <MobilePage><View style={styles.center}><AppText>Please log in to view a profile.</AppText></View></MobilePage>;
  const profile = profiles.find((item) => item.accountId === currentAccount.id);
  const verification = verifications.find((item) => item.studentId === currentAccount.id);
  const ownPortfolio = portfolioItems.filter((item) => item.studentId === currentAccount.id);
  const ownCertifications = certifications.filter((item) => item.studentId === currentAccount.id);
  const ownServices = services.filter((item) => item.providerId === currentAccount.id);
  const ownProjects = bookings.filter((item) => item.clientId === currentAccount.id || item.studentId === currentAccount.id);
  const ownReviews = reviews.filter((item) => item.studentId === currentAccount.id);
  const earnings = currentAccount.role === 'student' ? bookings.filter((item) => item.studentId === currentAccount.id && ['completed', 'reviewed'].includes(item.status)).reduce((total, item) => total + item.budget, 0) : 0;
  const completedNotAdded = ownProjects.filter((item) => item.studentId === currentAccount.id && ['completed', 'reviewed'].includes(item.status) && !ownPortfolio.some((portfolio) => portfolio.sourceProjectId === item.id));
  const addProject = async (projectId: string) => { const result = await addCompletedProjectToPortfolio(projectId); Alert.alert(result.ok ? 'Added to portfolio' : 'Unable to add project', result.ok ? 'The completed work is now part of your portfolio.' : result.message); };
  const readiness = currentAccount.role === 'student' ? getCareerReadiness(currentAccount.id) : null;

  return (
    <PrimaryTabScene active="profile"><MobilePage>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroArea}>
          <HeroDecor />
          <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push('/settings')} style={[styles.settingsButton, { top: insets.top + 22 }]}>
            <Ionicons name="settings-outline" size={25} color={colors.white} />
          </Pressable>
          <ProfileIdentity account={currentAccount} verification={verification} />
        </View>
        <ProfileAbout profile={profile} />

        <ProfileRoleContent account={currentAccount} readiness={readiness} ownPortfolio={ownPortfolio} ownCertifications={ownCertifications} ownServices={ownServices} earnings={earnings} completedNotAdded={completedNotAdded} ownReviews={ownReviews} ownProjects={ownProjects} onAddProject={addProject} />
      </ScrollView>
    </MobilePage></PrimaryTabScene>
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
  return <Pressable onPress={() => router.push('/verification')} style={[styles.verification, isVerified && styles.verified]}><Ionicons name={isVerified ? 'checkmark-circle' : 'shield-outline'} size={17} color={isVerified ? colors.white : colors.burgundy} /><AppText weight={isVerified ? 'semibold' : 'medium'} style={[styles.verificationText, isVerified && { color: colors.white }]}>{isVerified ? 'Verified Student' : `Verification: ${(verification?.status ?? 'not submitted').replace('_', ' ')}`}</AppText></Pressable>;
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
  return <Pressable onPress={() => router.push('/career-readiness')} style={styles.readiness}><View style={{ flex: 1 }}><AppText weight="semibold" style={styles.readinessTitle}>Career Readiness</AppText><AppText style={styles.readinessDetail}>{readiness.level} · View the transparent breakdown</AppText></View><View style={[styles.readinessScore, { flexShrink: 0 }]}><AppText weight="bold" style={styles.readinessValue}>{readiness.score}</AppText><AppText style={styles.readinessMax}>/100</AppText></View><Ionicons name="chevron-forward" size={22} color={colors.burgundy} style={{ flexShrink: 0 }} /></Pressable>;
}

function PortfolioSummary({ portfolioCount, certificationCount }: { portfolioCount: number; certificationCount: number }) {
  return <View style={styles.card}><View style={styles.headingRow}><AppText weight="semibold" style={styles.heading}>Portfolio & Certifications</AppText><Pressable onPress={() => router.push('/portfolio')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><AppText weight="medium" style={styles.link}>Manage</AppText><Ionicons name="chevron-forward" size={14} color={colors.burgundy} /></Pressable></View><AppText style={styles.copy}>{portfolioCount} portfolio item{portfolioCount === 1 ? '' : 's'} · {certificationCount} certification{certificationCount === 1 ? '' : 's'}</AppText></View>;
}

function CompletedWork({ projects, onAddProject }: { projects: ProjectBooking[]; onAddProject: (projectId: string) => void }) {
  return <View style={styles.card}><AppText weight="semibold" style={styles.heading}>Completed Work</AppText><AppText style={styles.copy}>Add finished client projects as portfolio evidence.</AppText>{projects.map((project) => <Pressable key={project.id} onPress={() => onAddProject(project.id)} style={styles.actionRow}><AppText weight="medium" style={{ flex: 1 }}>{project.title}</AppText><AppText weight="semibold" style={styles.link}>Add</AppText></Pressable>)}</View>;
}

function ServicesCard({ services }: { services: Service[] }) {
  return <View style={styles.card}><View style={styles.headingRow}><AppText weight="semibold" style={styles.heading}>My Services</AppText><Pressable onPress={() => router.push('/services/new')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><AppText weight="medium" style={styles.link}>Create</AppText><Ionicons name="chevron-forward" size={14} color={colors.burgundy} /></Pressable></View>{services.length ? services.map((service) => <Pressable key={service.id} onPress={() => router.push({ pathname: '/services/[serviceId]/edit', params: { serviceId: service.id } })} style={styles.actionRow}><View style={{ flex: 1 }}><AppText weight="medium">{service.title}</AppText><AppText style={styles.small}>{service.status}</AppText></View><Ionicons name="create-outline" size={21} color={colors.burgundy} /></Pressable>) : <AppText style={styles.copy}>No services created yet.</AppText>}</View>;
}

function ReviewsCard({ reviews }: { reviews: ProjectReview[] }) {
  return <View style={styles.card}><AppText weight="semibold" style={styles.heading}>Client Reviews</AppText>{reviews.map((review) => <View key={review.id} style={styles.review}><AppText weight="semibold">{review.rating}/5</AppText><AppText style={styles.copy}>{review.comment}</AppText></View>)}</View>;
}

function ClientProfileContent({ projects }: { projects: ProjectBooking[] }) {
  return <View style={styles.card}><AppText weight="semibold" style={styles.heading}>Client Activity</AppText><AppText style={styles.copy}>{projects.length} project request{projects.length === 1 ? '' : 's'} created in this local demonstration.</AppText></View>;
}

function Info({ icon, text }: { icon: 'location-outline' | 'business-outline' | 'school-outline' | 'book-outline'; text: string }) { return <View style={styles.info}><Ionicons name={icon} size={18} color={colors.burgundy} /><AppText style={styles.infoText}>{text}</AppText></View>; }
function Stat({ value, label }: { value: string; label: string }) { return <View style={styles.stat}><AppText weight="bold" style={styles.statValue}>{value}</AppText><AppText style={styles.small}>{label}</AppText></View>; }

const styles = StyleSheet.create({
  content: { paddingHorizontal: contentPadding, gap: 16, paddingBottom: 30, paddingTop: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroArea: { backgroundColor: colors.red, overflow: 'hidden', borderBottomLeftRadius: 62, borderBottomRightRadius: 62, marginHorizontal: -contentPadding },
  settingsButton: { position: 'absolute', right: 16, zIndex: 10 },
  identity: { alignItems: 'center', paddingTop: 56, paddingBottom: 24 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 25, marginTop: 12, color: colors.white },
  role: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  verification: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 15, paddingHorizontal: 11, paddingVertical: 6 },
  verified: { backgroundColor: colors.green, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, elevation: 4, shadowColor: colors.green, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6 },
  verificationText: { color: colors.white, fontSize: 10, textTransform: 'capitalize' },
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 17, ...shadow },
  readiness: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.blush, borderRadius: 14, padding: 16 },
  readinessScore: { flexDirection: 'row', alignItems: 'baseline' },
  readinessTitle: { fontSize: 15 },
  readinessDetail: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 },
  readinessValue: { color: colors.red, fontSize: 24, lineHeight: 27 },
  readinessMax: { color: colors.burgundy, fontSize: 9 },
  heading: { fontSize: 17 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 6 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  infoText: { fontSize: 12 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 13 },
  skill: { backgroundColor: colors.blush, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  skillText: { color: colors.burgundy, fontSize: 10 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, paddingVertical: 14, ...shadow },
  statValue: { fontSize: 16 },
  small: { color: colors.muted, fontSize: 9, textTransform: 'capitalize', marginTop: 2 },
  link: { color: colors.burgundy, fontSize: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  review: { gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
});
