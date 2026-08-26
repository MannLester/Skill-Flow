import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding, shadow } from '@/constants/theme';
import { CareerReadinessCategory, ReadinessCategoryKey } from '@/domain/career-readiness';
import { useSession } from '@/context/session';

const iconByCategory: Record<ReadinessCategoryKey, keyof typeof Ionicons.glyphMap> = {
  profile: 'person-outline', verification: 'shield-checkmark-outline', portfolio: 'images-outline', projects: 'briefcase-outline', ratings: 'star-outline', certifications: 'ribbon-outline',
};

export default function CareerReadinessScreen() {
  const { currentAccount, getCareerReadiness } = useSession();
  if (!currentAccount || currentAccount.role !== 'student') return <MobilePage><StatusBar style="light" /><AppHeader title="Career Readiness" onBack={() => router.back()} /><View style={styles.center}><AppText>Career Readiness is available to Student Designers.</AppText></View></MobilePage>;
  const breakdown = getCareerReadiness(currentAccount.id);
  return <MobilePage><StatusBar style="light" /><AppHeader title="Career Readiness" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.scoreCard}><View style={styles.scoreRing}><AppText weight="bold" style={styles.score}>{breakdown.score}</AppText><AppText style={styles.outOf}>/100</AppText></View><View style={{ flex: 1 }}><AppText weight="bold" style={styles.level}>{breakdown.level}</AppText><AppText style={styles.intro}>Your score updates automatically from your persisted SkillFlow demo activity.</AppText></View></View>
      <View style={styles.notice}><Ionicons name="information-circle-outline" size={21} color={colors.burgundy} /><AppText style={styles.noticeText}>This is a transparent academic demonstration score, not an employment assessment or guarantee.</AppText></View>
      <AppText weight="semibold" style={styles.heading}>Score Breakdown</AppText>
      {breakdown.categories.map((category) => <CategoryCard key={category.key} category={category} />)}
      <View style={styles.method}><AppText weight="semibold">How it is calculated</AppText><AppText style={styles.methodText}>Profile 15 · Simulated verification 15 · Portfolio 20 · Completed projects 25 · Client ratings 15 · Certifications 10</AppText><AppText style={styles.methodText}>Every category is capped. Adding extra records cannot raise the total beyond 100.</AppText></View>
    </ScrollView>
  </MobilePage>;
}

function CategoryCard({ category }: { category: CareerReadinessCategory }) {
  const routeFor = () => {
    if (category.key === 'verification') router.push('/verification');
    else if (category.key === 'portfolio') router.push('/portfolio');
    else if (category.key === 'projects' || category.key === 'ratings') router.push('/projects');
    else if (category.key === 'certifications') router.push('/certifications/new');
    else router.push('/profile/edit');
  };
  const complete = category.score === category.maximum;
  const percent = `${Math.round((category.score / category.maximum) * 100)}%` as `${number}%`;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${category.label}: ${category.score} of ${category.maximum}`} onPress={routeFor} style={styles.category}>
    <View style={styles.categoryTop}><View style={styles.categoryIcon}><Ionicons name={iconByCategory[category.key]} size={22} color={complete ? colors.green : colors.red} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={styles.categoryTitle}>{category.label}</AppText><AppText style={styles.detail}>{category.detail}</AppText></View><AppText weight="bold" style={styles.points}>{category.score}/{category.maximum}</AppText></View>
    <View style={styles.track}><View style={[styles.fill, { width: percent }, complete && { backgroundColor: colors.green }]} /></View>
    <View style={styles.next}><AppText style={styles.nextText}>{category.nextStep}</AppText><Ionicons name="chevron-forward" size={18} color={colors.burgundy} /></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  content: { padding: contentPadding, paddingBottom: 38, gap: 13 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: contentPadding },
  scoreCard: { minHeight: 150, backgroundColor: colors.red, borderRadius: 18, padding: 19, flexDirection: 'row', alignItems: 'center', gap: 18, ...shadow }, scoreRing: { width: 94, height: 94, borderRadius: 47, borderWidth: 7, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }, score: { color: colors.white, fontSize: 31, lineHeight: 35 }, outOf: { color: colors.white, fontSize: 10 }, level: { color: colors.white, fontSize: 21 }, intro: { color: colors.white, fontSize: 10, lineHeight: 16, marginTop: 5 },
  notice: { flexDirection: 'row', gap: 9, backgroundColor: colors.blush, borderRadius: 11, padding: 12 }, noticeText: { flex: 1, color: colors.burgundy, fontSize: 9, lineHeight: 15 }, heading: { fontSize: 19, marginTop: 8 },
  category: { backgroundColor: colors.white, borderRadius: 14, padding: 15, ...shadow }, categoryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, categoryIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, categoryTitle: { fontSize: 13 }, detail: { color: colors.muted, fontSize: 9, marginTop: 2 }, points: { color: colors.burgundy, fontSize: 15 }, track: { height: 7, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginTop: 13 }, fill: { height: '100%', backgroundColor: colors.red, borderRadius: 4 }, next: { flexDirection: 'row', alignItems: 'center', marginTop: 11 }, nextText: { flex: 1, color: colors.muted, fontSize: 9, lineHeight: 14 },
  method: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginTop: 3 }, methodText: { color: colors.muted, fontSize: 9, lineHeight: 16, marginTop: 5 },
});
