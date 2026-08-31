import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps, ReactNode, useState } from 'react';
import {
  Pressable, StyleProp, StyleSheet,
  Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { Svg, Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { UserRole } from '@/context/session';
import { colors, font, MAX_PHONE_WIDTH, shadow } from '@/constants/theme';
import { OptimizedArtwork, optimizedArtwork } from '@/components/optimized-artwork';

type IconName = ComponentProps<typeof Ionicons>['name'];
type BottomNavProps = {
  active: 'home' | 'projects' | 'portfolio' | 'messages' | 'saved' | 'profile' | 'none';
  onHome: () => void; onProjects?: () => void; onPortfolio?: () => void; onMessages?: () => void; onCreate?: () => void; onSaved?: () => void; onProfile?: () => void; messageUnread?: boolean; variant?: 'student' | 'client' | 'marketplace' | 'compact';
};
type BottomNavItem = { key: BottomNavProps['active']; label: string; icon: IconName; action?: () => void; dot?: boolean };

export function AppText({ children, weight = 'regular', style, ...props }: ComponentProps<typeof Text> & { weight?: keyof typeof font }) {
  return <Text maxFontSizeMultiplier={1.5} {...props} style={[{ color: colors.ink, fontFamily: font[weight] }, style]}>{children}</Text>;
}

export function MobilePage({ children, backgroundColor = colors.white }: { children: ReactNode; backgroundColor?: string }) {
  return (
    <View style={[styles.outer, { backgroundColor }]}> 
      <View style={styles.phone}>{children}</View>
    </View>
  );
}

export function HeroDecor() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Circle cx="85%" cy="18%" r={130} fill="rgba(255,255,255,0.07)" />
      <Circle cx="10%" cy="85%" r={70} fill="rgba(255,255,255,0.05)" />
    </Svg>
  );
}

export function BottomWaveDecor() {
  return (
    <View style={styles.bottomWave} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="none">
        <Path
          d="M0,50 C60,80 140,20 220,65 C300,95 360,30 400,55"
          fill="none"
          stroke={colors.red}
          strokeWidth={2.5}
          opacity={0.35}
        />
        <Path
          d="M0,75 C100,40 200,95 300,60 C360,40 390,75 400,55 L400,100 L0,100 Z"
          fill={colors.red}
        />
      </Svg>
    </View>
  );
}

export function TopCornerDecor() {
  return (
    <View style={styles.topCorner} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 250" preserveAspectRatio="none">
        <Path
          d="M0,0 C160,60 300,10 400,80"
          fill="none"
          stroke={colors.red}
          strokeWidth={2.5}
          opacity={0.35}
        />
        <Path
          d="M0,0 C140,50 280,5 400,65 L400,0 Z"
          fill={colors.red}
        />
      </Svg>
    </View>
  );
}

export function AppHeader({ title, onBack, right, red = true }: { title: string; onBack?: () => void; right?: ReactNode; red?: boolean }) {
  const insets = useSafeAreaInsets();
  const color = red ? colors.white : colors.ink;
  return (
    <View style={[styles.header, { paddingTop: insets.top, height: 58 + insets.top, backgroundColor: red ? colors.red : colors.white }]}> 
      <View style={styles.headerSide}>
        {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} hitSlop={12}><Ionicons name="arrow-back" size={29} color={color} /></Pressable> : null}
      </View>
      <AppText weight="semibold" style={[styles.headerTitle, { color }]}>{title}</AppText>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function PrimaryButton({ title, onPress, style, textStyle, disabled = false }: { title: string; onPress?: () => void | Promise<void>; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<import('react-native').TextStyle>; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, style, disabled ? { opacity: 0.55 } : null, pressed && onPress ? { opacity: 0.85 } : null]}>
      <AppText weight="semibold" style={[styles.primaryButtonText, textStyle]}>{title}</AppText>
    </Pressable>
  );
}

export function FormField({ icon, secureTextEntry, style, ...props }: TextInputProps & { icon: IconName; style?: StyleProp<ViewStyle> }) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  return (
    <View style={[styles.field, style]}>
      <Ionicons name={icon} size={18} color={colors.burgundy} />
      <TextInput
        {...props}
        placeholderTextColor="#9b9b9b"
        secureTextEntry={secureTextEntry ? hidden : false}
        style={styles.input}
        selectionColor={colors.red}
      />
      {secureTextEntry ? (
        <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'} onPress={() => setHidden((value) => !value)} hitSlop={10}>
          <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function RoleSelector({ value, onChange }: { value: UserRole; onChange: (value: UserRole) => void }) {
  return (
    <View style={styles.roleSelector}>
      <RoleButton label="Student Designer" icon="school" active={value === 'student'} onPress={() => onChange('student')} />
      <RoleButton label="Client" icon="people-outline" active={value === 'client'} onPress={() => onChange('client')} />
    </View>
  );
}

function RoleButton({ label, icon, active, onPress }: { label: string; icon: IconName; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.roleButton, active && styles.roleButtonActive]}>
      <Ionicons name={icon} size={17} color={active ? colors.white : colors.burgundy} />
      <AppText weight="medium" style={{ color: active ? colors.white : colors.burgundy, fontSize: 11 }}>{label}</AppText>
    </Pressable>
  );
}

function buildBottomNavItems({ onHome, onProjects, onPortfolio, onMessages, onCreate, onSaved, onProfile, messageUnread = false, variant = 'student' }: BottomNavProps): BottomNavItem[] {
  const common = { home: { key: 'home' as const, label: 'Home', icon: 'home' as IconName, action: onHome }, projects: { key: 'projects' as const, label: 'Projects', icon: 'briefcase' as IconName, action: onProjects } };
  if (variant === 'client') { const center: BottomNavItem = { key: 'none', label: '', icon: 'add', action: onCreate }; return [common.home, common.projects, center, { key: 'messages', label: 'Messages', icon: 'chatbubble', action: onMessages, dot: messageUnread }, { key: 'profile', label: 'Profile', icon: 'person-circle', action: onProfile }]; }
  if (variant === 'compact') return [common.home, common.projects, { key: 'messages', label: 'Messages', icon: 'chatbubble', action: onMessages }, { key: 'profile', label: 'Profile', icon: 'person', action: onProfile }];
  const center: BottomNavItem = variant === 'marketplace' ? { key: 'none', label: '', icon: 'add', action: onCreate } : { key: 'none', label: '', icon: 'search', action: onCreate };
  return [common.home, common.projects, center, { key: 'messages', label: 'Messages', icon: 'chatbubble', action: onMessages, dot: messageUnread }, { key: 'profile', label: 'Profile', icon: 'person-circle', action: onProfile }];
}

export function BottomNav(props: BottomNavProps) {
  const { active, variant = 'student' } = props;
  const insets = useSafeAreaInsets();
  const items = buildBottomNavItems(props);

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8), height: 76 + Math.max(insets.bottom, 8) }]}> 
      {items.map((item, index) => <BottomNavButton key={`${item.key}-${index}`} item={item} selected={item.key === active} plus={(variant === 'marketplace' || variant === 'client' || variant === 'student') && item.key === 'none'} />)}
    </View>
  );
}

function BottomNavButton({ item, selected, plus }: { item: BottomNavItem; selected: boolean; plus: boolean }) {
  const iconColor = plus ? colors.white : selected ? colors.red : '#555';
  return <Pressable accessibilityRole="button" accessibilityLabel={plus ? (item.icon === 'search' ? 'Discover' : 'Create') : item.label} accessibilityState={{ disabled: !item.action, selected }} disabled={!item.action} onPress={item.action} style={styles.navItem}><View style={styles.navIconWrap}>{plus ? <View style={styles.plusOuter}><View style={styles.plusButton}><Ionicons name={item.icon} size={item.icon === 'search' ? 28 : 40} color={colors.white} /></View></View> : <><View style={undefined}><Ionicons name={item.icon} size={27} color={iconColor} /></View>{item.dot ? <View style={styles.messageDot} /> : null}</>}</View>{plus ? null : <AppText weight={selected ? 'medium' : 'regular'} style={[styles.navLabel, selected && { color: colors.red }]}>{item.label}</AppText>}</Pressable>;
}

export function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} accessibilityState={{ disabled: !onPress }} onPress={onPress} style={styles.quickAction}>
      <View style={styles.quickIcon}><Ionicons name={icon} size={27} color={colors.red} style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }} /></View>
      <AppText weight="medium" style={styles.quickLabel}>{label}</AppText>
    </Pressable>
  );
}

export function AppLogo({ compact = false }: { compact?: boolean }) {
  const logoSize = compact ? 43 : 110;
  return (
    <View style={[compact ? styles.logoRow : styles.logoStack, compact && { gap: 4 }]}>
      <OptimizedArtwork source={optimizedArtwork.skillflowLogo} style={{ width: logoSize, height: logoSize, borderRadius: compact ? 10 : 14 }} />
      <View style={{ alignItems: 'center' }}>
        <AppText weight="bold" style={{ fontSize: compact ? 20 : 32, color: colors.ink }}>Skill Flow</AppText>
        {!compact ? <AppText weight="medium" style={{ fontSize: 11, color: colors.muted }}>Showcase Your Skills, Connect with Clients.</AppText> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  phone: { flex: 1, width: '100%', maxWidth: MAX_PHONE_WIDTH, backgroundColor: colors.white, overflow: 'hidden' },
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  headerSide: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 19 },
  primaryButton: { minHeight: 52, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red, ...shadow },
  primaryButtonText: { color: colors.white, fontSize: 15 },
  field: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white },
  input: { flex: 1, minHeight: 50, color: colors.ink, fontFamily: font.regular, fontSize: 13, paddingVertical: 0 },
  roleSelector: { flexDirection: 'row', borderWidth: 1, borderColor: '#e3a9ae', borderRadius: 20, overflow: 'hidden', minHeight: 39 },
  roleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  roleButtonActive: { backgroundColor: colors.red },
  bottomNav: { backgroundColor: colors.white, flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, borderTopLeftRadius: 20, borderTopRightRadius: 20, ...shadow },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navIconWrap: { height: 30, alignItems: 'center', justifyContent: 'center' },
  navLabel: { color: '#555', fontSize: 10 },
  plusOuter: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', marginTop: -33, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
  plusButton: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  messageDot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red, right: -1, top: 0 },
  quickAction: { flex: 1, alignItems: 'center', minWidth: 66 },
  quickIcon: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11, textAlign: 'center', marginTop: 7, lineHeight: 15 },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  logoStack: { alignItems: 'center', gap: 10 },
  bottomWave: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 },
  topCorner: { position: 'absolute', top: 0, right: 0, width: '70%', height: 250 },
});
