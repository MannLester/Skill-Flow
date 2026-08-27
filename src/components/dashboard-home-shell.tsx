import Ionicons from '@expo/vector-icons/Ionicons';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding, shadow } from '@/constants/theme';
import { UserRole } from '@/context/session';
import { PrimaryTabScene } from '@/navigation/primary-navigation';

export function DashboardHomeShell({ body, featured, featuredOnPress, hero, role }: { body: ReactNode; featured: ReactNode; featuredOnPress?: () => void; hero: ReactNode; role: UserRole }) {
  const insets = useSafeAreaInsets();
  const roleStyle = roleStyles[role];
  return (
    <PrimaryTabScene active="home">
      <MobilePage backgroundColor={colors.red}>
        <StatusBar style="light" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View testID="dashboard-hero" style={[styles.hero, { paddingTop: insets.top + 28 }]}>{hero}</View>
          <DashboardFeatured onPress={featuredOnPress} style={roleStyle.featured}>{featured}</DashboardFeatured>
          <View testID="dashboard-body" style={[styles.body, roleStyle.body]}>{body}</View>
        </ScrollView>
      </MobilePage>
    </PrimaryTabScene>
  );
}

export function DashboardHomeHero({ activeCount, onNotifications, role, unreadCount }: { activeCount: number; onNotifications: () => void; role: UserRole; unreadCount: number }) {
  const variant = heroVariants[role];
  const subtitle = activeCount > 0
    ? `You have ${activeCount} active project${activeCount === 1 ? '' : 's'} in progress.`
    : variant.emptySubtitle;
  return <>
    <View style={styles.topRow}>
      <Pressable accessibilityLabel="Open notifications" onPress={onNotifications} style={styles.bellWrap}>
        <Ionicons name="notifications-outline" size={variant.notificationIconSize} color={colors.white} />
        {unreadCount ? <View style={[styles.badge, { backgroundColor: variant.badgeColor }]}><AppText weight="semibold" style={styles.badgeText}>{unreadCount}</AppText></View> : null}
      </Pressable>
    </View>
    <View style={styles.greetingRow}>
      <View style={styles.greetingCopy}><AppText weight="bold" style={styles.greeting}>{variant.greeting}</AppText><AppText style={[styles.heroSubtitle, variant.subtitle]}>{subtitle}</AppText></View>
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
  scroll: { paddingBottom: 30 },
  hero: { backgroundColor: colors.red, paddingHorizontal: 24, paddingBottom: 87 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  bellWrap: { position: 'relative' },
  badge: { position: 'absolute', right: -6, top: -6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontSize: 10 },
  greetingRow: { marginTop: 24, flexDirection: 'row', alignItems: 'center' },
  greetingCopy: { flex: 1, paddingRight: 16 },
  greeting: { color: colors.white, fontSize: 28 },
  heroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22 },
  studentSubtitle: { marginTop: 5 },
  avatarCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  featured: { minHeight: 150, backgroundColor: colors.white, padding: 20, marginTop: -42, marginHorizontal: 24, zIndex: 1, ...shadow },
  body: { backgroundColor: colors.white, paddingHorizontal: contentPadding, marginTop: -55, borderTopLeftRadius: 42, borderTopRightRadius: 42, overflow: 'hidden' },
  clientFeatured: { borderRadius: 17 },
  clientBody: { paddingTop: 52 },
  studentFeatured: { borderRadius: 18 },
  studentBody: { paddingTop: 58 },
});

const roleStyles = {
  client: { featured: styles.clientFeatured, body: styles.clientBody },
  student: { featured: styles.studentFeatured, body: styles.studentBody },
};

const heroVariants = {
  client: { greeting: 'Hi, Mark!', emptySubtitle: 'Find the best student talent for your project.', notificationIconSize: 28, badgeColor: '#e56a6a', subtitle: undefined },
  student: { greeting: 'Hi, Alex!', emptySubtitle: 'Explore new project opportunities today.', notificationIconSize: 29, badgeColor: '#ef8585', subtitle: styles.studentSubtitle },
};
