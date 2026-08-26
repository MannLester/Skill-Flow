import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { colors } from '@/constants/theme';
import { UserRole } from '@/context/session';
import { PrimaryTabKey, primaryTabOrder, replacePrimaryTab } from '@/navigation/primary-navigation';

type DrawerItem = { key: PrimaryTabKey | 'settings'; label: string; icon: keyof typeof Ionicons.glyphMap };

const LABELS: Record<PrimaryTabKey, string> = {
  home: 'Home', projects: 'Projects', portfolio: 'Portfolio', messages: 'Messages', saved: 'Saved', profile: 'Profile',
};

const ICONS: Record<PrimaryTabKey, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline', projects: 'briefcase-outline', portfolio: 'folder-outline', messages: 'chatbubble-outline', saved: 'heart-outline', profile: 'person-circle-outline',
};

export function navigationDrawerItems(role: UserRole): DrawerItem[] {
  return [
    ...primaryTabOrder(role).map((key) => ({ key, label: LABELS[key], icon: ICONS[key] })),
    { key: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];
}

export function NavigationDrawer({ visible, role, onClose }: { visible: boolean; role: UserRole; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.82, 340);
  const [mounted, setMounted] = useState(visible);
  const translateX = useRef(new Animated.Value(-drawerWidth)).current;

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;
    translateX.stopAnimation();
    if (visible) {
      translateX.setValue(-drawerWidth);
      Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      return;
    }
    Animated.timing(translateX, { toValue: -drawerWidth, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [drawerWidth, mounted, translateX, visible]);

  const select = (key: DrawerItem['key']) => {
    onClose();
    if (key === 'settings') router.push('/settings');
    else replacePrimaryTab(role, 'home', key);
  };

  if (!mounted) return null;
  return <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
    <View style={styles.modal}>
      <Pressable testID="navigation-drawer-scrim" accessibilityRole="button" accessibilityLabel="Close navigation menu" onPress={onClose} style={styles.scrim} />
      <Animated.View accessibilityViewIsModal importantForAccessibility="yes" style={[styles.drawer, { width: drawerWidth, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 18, transform: [{ translateX }] }]}>
        <View style={styles.heading}>
          <View><AppText weight="bold" style={styles.brand}>SkillFlow</AppText><AppText style={styles.role}>{role === 'client' ? 'Client workspace' : 'Student Designer workspace'}</AppText></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close navigation menu" hitSlop={12} onPress={onClose}><Ionicons name="close" size={29} color={colors.ink} /></Pressable>
        </View>
        <View accessibilityRole="menu" style={styles.items}>
          {navigationDrawerItems(role).map((item) => {
            const selected = item.key === 'home';
            return <Pressable key={item.key} accessibilityRole="menuitem" accessibilityState={{ selected }} disabled={selected} onPress={() => select(item.key)} style={[styles.item, selected && styles.itemSelected]}>
              <Ionicons name={item.icon} size={23} color={selected ? colors.red : colors.burgundy} />
              <AppText weight={selected ? 'semibold' : 'medium'} style={[styles.itemLabel, selected && styles.itemLabelSelected]}>{item.label}</AppText>
            </Pressable>;
          })}
        </View>
      </Animated.View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  modal: { flex: 1, flexDirection: 'row' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  drawer: { height: '100%', backgroundColor: colors.white, paddingHorizontal: 20, shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 18, elevation: 18 },
  heading: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
  brand: { color: colors.red, fontSize: 24 }, role: { color: colors.muted, fontSize: 11, marginTop: 2 },
  items: { paddingTop: 14, gap: 5 }, item: { minHeight: 52, borderRadius: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 14 },
  itemSelected: { backgroundColor: colors.blush }, itemLabel: { fontSize: 15 }, itemLabelSelected: { color: colors.red },
});
