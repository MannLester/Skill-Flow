import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/ui';
import { readRuntimeConfiguration } from '@/config/runtime';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/session.remote';
import type { MediaAttachment, MediaPurpose } from '@/media/types';

export function MediaGallery({ targetType, targetId, purposes }: { targetType: string; targetId: string; purposes?: MediaPurpose[] }) {
  const { mediaAttachments } = useSession();
  const images = (mediaAttachments ?? []).filter((item) => item.targetType === targetType && item.targetId === targetId && (!purposes || purposes.includes(item.purpose))).sort((a, b) => a.position - b.position);
  if (!images.length) return null;
  return <View style={styles.gallery}>{images.map((attachment) => <MediaImage key={attachment.id} attachment={attachment} />)}</View>;
}

export function MediaAvatar({ profileId }: { profileId?: string }) {
  const { mediaAttachments } = useSession();
  const attachment = profileId ? (mediaAttachments ?? []).find((item) => item.targetType === 'profile' && item.targetId === profileId && item.purpose === 'avatar') : undefined;
  return attachment ? <MediaImage attachment={attachment} tileStyle={styles.avatarTile} /> : null;
}

export function MediaCover({ targetType, targetId, purpose, fallback, tileStyle }: { targetType: string; targetId: string; purpose: MediaPurpose; fallback: ReactNode; tileStyle?: StyleProp<ViewStyle> }) {
  const { mediaAttachments } = useSession();
  const attachment = (mediaAttachments ?? []).find((item) => item.targetType === targetType && item.targetId === targetId && item.purpose === purpose);
  return attachment ? <MediaImage attachment={attachment} tileStyle={tileStyle} /> : fallback;
}

export function MediaImage({ attachment, tileStyle }: { attachment: MediaAttachment; tileStyle?: StyleProp<ViewStyle> }) {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (attachment.publicUrl) return;
    void getToken({ template: 'convex' }).then(setToken).catch(() => setMissing(true));
  }, [attachment.publicUrl, getToken]);
  const source = useMemo(() => mediaSource(attachment, token), [attachment, token]);
  if (!source || missing) return <View accessibilityLabel="Image unavailable" style={styles.missing}><Ionicons name="image-outline" size={25} color={colors.muted} /><AppText style={styles.missingText}>Image unavailable</AppText></View>;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${attachment.altText}`} onPress={() => setExpanded(true)} style={[styles.tile, tileStyle]}>
      {loading ? <ActivityIndicator style={styles.loader} color={colors.red} /> : null}
      <Image source={source} accessibilityLabel={attachment.altText} onLoadStart={() => setLoading(true)} onLoadEnd={() => setLoading(false)} onError={() => setMissing(true)} style={styles.image} />
    </Pressable>
    <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}><View style={styles.modal}><Pressable accessibilityRole="button" accessibilityLabel="Close image" onPress={() => setExpanded(false)} style={styles.close}><Ionicons name="close" size={28} color={colors.white} /></Pressable><Image source={source} accessibilityLabel={attachment.altText} resizeMode="contain" style={styles.full} /></View></Modal>
  </>;
}

function mediaSource(attachment: MediaAttachment, token: string | null) {
  if (attachment.publicUrl) return { uri: attachment.publicUrl };
  if (!token) return null;
  const runtime = readRuntimeConfiguration();
  if (!runtime.ready) return null;
  return { uri: `${convexSiteUrl(runtime.configuration.convexUrl)}/media?attachmentId=${encodeURIComponent(attachment.id)}`, headers: { Authorization: `Bearer ${token}` } };
}

function convexSiteUrl(clientUrl: string) {
  const configured = process.env.EXPO_PUBLIC_CONVEX_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const url = new URL(clientUrl);
  if (url.hostname.endsWith('.convex.cloud')) url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site');
  else if (url.port) url.port = String(Number(url.port) + 1);
  return url.toString().replace(/\/$/, '');
}

const styles = StyleSheet.create({
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }, tile: { width: 104, height: 104, borderRadius: 9, overflow: 'hidden', backgroundColor: colors.blush }, image: { width: '100%', height: '100%' }, loader: { position: 'absolute', inset: 0 },
  avatarTile: { position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 50 },
  missing: { width: 104, height: 104, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, missingText: { color: colors.muted, fontSize: 8, marginTop: 4 },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' }, close: { position: 'absolute', zIndex: 2, right: 18, top: 45, width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }, full: { width: '100%', height: '100%' },
});
