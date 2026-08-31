import { router } from 'expo-router';
import { memo, ReactNode, useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { BottomNav } from '@/components/ui';
import { UserRole } from '@/context/session';

export type PrimaryTabKey = 'home' | 'projects' | 'portfolio' | 'messages' | 'saved' | 'profile';
export type PrimaryNavActive = PrimaryTabKey | 'none';
type PrimaryRoute = '/student-home' | '/client-home' | '/projects' | '/portfolio' | '/messages' | '/profile'
  | { pathname: '/marketplace'; params: { saved: 'true' } };

const TAB_ORDER: Record<UserRole, PrimaryTabKey[]> = {
  student: ['home', 'projects', 'messages', 'profile'],
  client: ['home', 'projects', 'messages', 'profile'],
};

const ACTIVE_BY_PATH: Record<UserRole, Record<string, PrimaryNavActive>> = {
  student: { '/student-home': 'home', '/projects': 'projects', '/messages': 'messages', '/profile': 'profile', '/notifications': 'none' },
  client: { '/client-home': 'home', '/projects': 'projects', '/messages': 'messages', '/profile': 'profile', '/marketplace': 'none', '/notifications': 'none' },
};

let pendingTransition: { target: PrimaryTabKey; direction: -1 | 1 } | null = null;

export function primaryTabOrder(role: UserRole) {
  return TAB_ORDER[role];
}

export function primaryTabRoute(role: UserRole, target: PrimaryTabKey): PrimaryRoute {
  if (target === 'home') return role === 'client' ? '/client-home' : '/student-home';
  if (target === 'saved') return { pathname: '/marketplace', params: { saved: 'true' } };
  return `/${target}` as PrimaryRoute;
}

export function primaryTabDirection(role: UserRole, current: PrimaryTabKey, target: PrimaryTabKey) {
  const currentIndex = TAB_ORDER[role].indexOf(current);
  const targetIndex = TAB_ORDER[role].indexOf(target);
  if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) return 0;
  return targetIndex > currentIndex ? 1 : -1;
}

export function primaryNavActiveForPath(pathname: string, role: UserRole, saved?: string | string[]): PrimaryNavActive | null {
  const active = ACTIVE_BY_PATH[role][pathname] ?? null;
  const savedOnly = Array.isArray(saved) ? saved.includes('true') : saved === 'true';
  return pathname === '/marketplace' && active !== null && savedOnly ? 'saved' : active;
}

export function replacePrimaryTab(
  role: UserRole,
  current: PrimaryNavActive,
  target: PrimaryTabKey,
  replace: (route: PrimaryRoute) => void = (route) => router.replace(route),
) {
  if (current === target) return false;
  const direction = current === 'none' ? 0 : primaryTabDirection(role, current, target);
  pendingTransition = direction ? { target, direction } : null;
  replace(primaryTabRoute(role, target));
  return true;
}

function consumeTransition(target: PrimaryTabKey) {
  if (pendingTransition?.target !== target) return 0;
  const direction = pendingTransition.direction;
  pendingTransition = null;
  return direction;
}

export function PrimaryTabScene({ active, children }: { active: PrimaryTabKey; children: ReactNode }) {
  const [direction] = useState(() => consumeTransition(active));
  const [translateX] = useState(() => new Animated.Value(direction * 28));
  const [opacity] = useState(() => new Animated.Value(direction ? 0.96 : 1));
  useEffect(() => {
    if (!direction) return;
    const animation = Animated.parallel([
      Animated.timing(translateX, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [direction, opacity, translateX]);
  return <Animated.View testID={`primary-tab-scene-${active}`} style={{ flex: 1, opacity, transform: [{ translateX }] }}>{children}</Animated.View>;
}

export const PrimaryBottomNav = memo(function PrimaryBottomNav({ active, role, messageUnread = false }: { active: PrimaryNavActive; role: UserRole; messageUnread?: boolean }) {
  const go = (target: PrimaryTabKey) => () => replacePrimaryTab(role, active, target);
  const isClient = role === 'client';
  return <BottomNav
    active={active}
    onHome={go('home')}
    onProjects={go('projects')}
    onPortfolio={!isClient ? go('portfolio') : undefined}
    onMessages={go('messages')}
    onCreate={isClient ? () => router.push('/project-posts/new') : () => router.push('/projects/discover')}
    onProfile={go('profile')}
    messageUnread={messageUnread}
    variant={isClient ? 'client' : 'student'}
  />;
});
