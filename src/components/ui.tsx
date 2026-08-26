import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps, ReactNode, useState } from 'react';
import {
  Pressable, StyleProp, StyleSheet,
  Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserRole } from '@/context/session';
import { colors, font, MAX_PHONE_WIDTH, shadow } from '@/constants/theme';
import { OptimizedArtwork, optimizedArtwork } from '@/components/optimized-artwork';

type IconName = ComponentProps<typeof Ionicons>['name'];

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

export function PrimaryButton({ title, onPress, style }: { title: string; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, style, pressed && onPress ? { opacity: 0.85 } : null]}>
      <AppText weight="semibold" style={styles.primaryButtonText}>{title}</AppText>
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

export function BottomNav({ active, onHome, onProjects, onPortfolio, onMessages, onCreate, onSaved, onProfile, messageUnread = false, variant = 'student' }: {
  active: 'home' | 'projects' | 'portfolio' | 'messages' | 'saved' | 'profile' | 'none';
  onHome: () => void; onProjects?: () => void; onPortfolio?: () => void; onMessages?: () => void; onCreate?: () => void; onSaved?: () => void; onProfile?: () => void; messageUnread?: boolean; variant?: 'student' | 'client' | 'marketplace' | 'compact';
}) {
  const insets = useSafeAreaInsets();
  const items: { key: typeof active; label: string; icon: IconName; action?: () => void; dot?: boolean }[] = variant === 'client'
    ? [
        { key: 'home', label: 'Home', icon: 'home', action: onHome },
        { key: 'projects', label: 'Projects', icon: 'briefcase-outline', action: onProjects },
        { key: 'messages', label: 'Messages', icon: 'chatbubble-outline', action: onMessages },
        { key: 'saved', label: 'Saved', icon: 'heart-outline', action: onSaved },
        { key: 'profile', label: 'Profile', icon: 'person-circle-outline', action: onProfile },
      ]
    : variant === 'compact'
      ? [
          { key: 'home', label: 'Home', icon: 'home-outline', action: onHome },
          { key: 'projects', label: 'Projects', icon: 'briefcase-outline', action: onProjects },
          { key: 'messages', label: 'Messages', icon: 'chatbubble-outline', action: onMessages },
          { key: 'profile', label: 'Profile', icon: 'person', action: onProfile },
        ]
      : [
          { key: 'home', label: 'Home', icon: 'home', action: onHome },
          { key: 'projects', label: 'Projects', icon: 'briefcase-outline', action: onProjects },
          ...(variant === 'marketplace' ? [{ key: 'none' as const, label: '', icon: 'add' as IconName, action: onCreate }] : [{ key: 'portfolio' as const, label: 'Portfolio', icon: 'folder-outline' as IconName, action: onPortfolio }]),
          { key: 'messages', label: 'Messages', icon: 'chatbubble-outline', action: onMessages, dot: messageUnread },
          { key: 'profile', label: 'Profile', icon: 'person-circle-outline', action: onProfile },
        ];

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8), height: 62 + Math.max(insets.bottom, 8) }]}> 
      {items.map((item, index) => {
        const selected = item.key === active;
        const plus = variant === 'marketplace' && item.key === 'none';
        return (
          <Pressable
            key={`${item.key}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={plus ? 'Create' : item.label}
            accessibilityState={{ disabled: !item.action, selected }}
            disabled={!item.action}
            onPress={item.action}
            style={styles.navItem}
          >
            <View>
              <View style={plus ? styles.plusButton : undefined}>
                <Ionicons name={item.icon} size={plus ? 32 : 25} color={plus ? colors.white : selected ? colors.red : '#555'} />
              </View>
              {item.dot ? <View style={styles.messageDot} /> : null}
            </View>
            {!plus ? <AppText weight={selected ? 'medium' : 'regular'} style={[styles.navLabel, selected && { color: colors.red }]}>{item.label}</AppText> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} accessibilityState={{ disabled: !onPress }} onPress={onPress} style={styles.quickAction}>
      <View style={styles.quickIcon}><Ionicons name={icon} size={27} color={colors.burgundy} /></View>
      <AppText weight="medium" style={styles.quickLabel}>{label}</AppText>
    </Pressable>
  );
}

export function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.logoRow, compact && { gap: 8 }]}> 
      <OptimizedArtwork source={optimizedArtwork.loginLogo} style={{ width: compact ? 43 : 57, aspectRatio: 1, borderRadius: 9 }} />
      <View>
        <AppText weight="bold" style={{ fontSize: compact ? 20 : 27 }}>Skill Flow</AppText>
        {!compact ? <AppText style={{ fontSize: 8, color: colors.muted }}>Showcase Your Skills, Connect with Clients.</AppText> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  phone: { flex: 1, width: '100%', maxWidth: MAX_PHONE_WIDTH, backgroundColor: colors.white },
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
  bottomNav: { backgroundColor: colors.white, flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, ...shadow },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navLabel: { color: '#555', fontSize: 10 },
  plusButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', marginTop: -19, ...shadow },
  messageDot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red, right: -1, top: 0 },
  quickAction: { flex: 1, alignItems: 'center', minWidth: 66 },
  quickIcon: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11, textAlign: 'center', marginTop: 7, lineHeight: 15 },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
