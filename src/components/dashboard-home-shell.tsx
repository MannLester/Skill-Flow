import Ionicons from '@expo/vector-icons/Ionicons';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OptimizedArtwork, optimizedArtwork } from '@/components/optimized-artwork';
import { AppText, HeroDecor, MobilePage } from '@/components/ui';
import { colors, contentPadding, shadow } from '@/constants/theme';
import type { UserRole } from '@/context/session.remote';
import { PrimaryTabScene } from '@/navigation/primary-navigation';

export function DashboardHomeShell({ body, featured, featuredOnPress, hero, role }: { body: ReactNode; featured: ReactNode; featuredOnPress?: () => void; hero: ReactNode; role: UserRole }) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const roleStyle = roleStyles[role];
  return (
    <PrimaryTabScene active="home">
      <MobilePage backgroundColor={colors.red}>
        <StatusBar style="light" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={{ minHeight: screenHeight }}>
            <View testID="dashboard-hero" style={[styles.hero, { paddingTop: insets.top + 28 }]}><HeroDecor />{hero}</View>
            <View style={styles.heroExtension} />
            <DashboardFeatured onPress={featuredOnPress} style={roleStyle.featured}>{featured}</DashboardFeatured>
            <View testID="dashboard-body" style={styles.body}>{body}</View>
          </View>
        </ScrollView>
      </MobilePage>
    </PrimaryTabScene>
  );
}

export function DashboardHomeHero({ accountName, activeCount, onNotifications, role, unreadCount }: { accountName?: string; activeCount: number; onNotifications: () => void; role: UserRole; unreadCount: number }) {
  const variant = heroVariants[role];
  const firstName = accountName?.split(' ')[0] ?? variant.fallbackName;
  const subtitle = activeCount > 0
    ? `You have ${activeCount} active project${activeCount === 1 ? '' : 's'} in progress.`
    : variant.emptySubtitle;
  return <>
    <View style={styles.topRow}>
      <View style={styles.logoRow}>
        <OptimizedArtwork source={optimizedArtwork.whiteLogo} style={styles.logo} />
        <AppText weight="bold" style={styles.logoText}>SkillFlow</AppText>
      </View>
      <Pressable accessibilityLabel="Open notifications" onPress={onNotifications} style={styles.bellWrap}>
        <Ionicons name="notifications-outline" size={variant.notificationIconSize} color={colors.white} />
        {unreadCount ? <View style={[styles.badge, { backgroundColor: variant.badgeColor }]}><AppText weight="semibold" style={styles.badgeText}>{unreadCount}</AppText></View> : null}
      </Pressable>
    </View>
    <View style={styles.greetingRow}>
      <View style={styles.greetingCopy}><AppText weight="bold" style={styles.greeting}>Hi, {firstName}!</AppText><AppText style={[styles.heroSubtitle, variant.subtitle]}>{subtitle}</AppText></View>
      <View style={styles.avatarCircle}><Ionicons name="person" size={28} color={colors.red} /></View>
    </View>
  </>;
}

function DashboardFeatured({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style: object }) {
  const Container = onPress ? Pressable : View;
  const pressProps = onPress ? { onPress } : {};
  return <Container testID="dashboard-featured" style={[styles.featured, style]} {...pressProps}>{children}</Container>;
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  hero: { backgroundColor: colors.red, paddingHorizontal: 24, paddingBottom: 87, overflow: 'hidden' },
  heroExtension: { backgroundColor: colors.red, height: 97 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { width: 36, height: 36, resizeMode: 'contain' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoText: { color: colors.white, fontSize: 17 },
  bellWrap: { position: 'relative' },
  badge: { position: 'absolute', right: -6, top: -6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontSize: 10 },
  greetingRow: { marginTop: 24, flexDirection: 'row', alignItems: 'center' },
  greetingCopy: { flex: 1, paddingRight: 16 },
  greeting: { color: colors.white, fontSize: 28 },
  heroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22 },
  studentSubtitle: { marginTop: 5 },
  avatarCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  featured: { minHeight: 140, backgroundColor: colors.white, paddingTop: 14, paddingBottom: 18, paddingHorizontal: 20, marginTop: -100, marginHorizontal: 24, zIndex: 1, transform: [{ translateY: -68 }], ...shadow },
  body: { flex: 1, backgroundColor: colors.white, paddingHorizontal: contentPadding, marginTop: -164, borderTopLeftRadius: 42, borderTopRightRadius: 42, paddingTop: 112, overflow: 'hidden' },
  clientFeatured: { borderRadius: 17 },
  studentFeatured: { borderRadius: 18 },
});

const roleStyles = {
  client: { featured: styles.clientFeatured },
  student: { featured: styles.studentFeatured },
};

const heroVariants = {
  client: { fallbackName: 'Client', emptySubtitle: 'Find the best student talent for your project.', notificationIconSize: 28, badgeColor: '#e56a6a', subtitle: undefined },
  student: { fallbackName: 'Student', emptySubtitle: 'Explore new project opportunities today.', notificationIconSize: 29, badgeColor: '#ef8585', subtitle: styles.studentSubtitle },
};
