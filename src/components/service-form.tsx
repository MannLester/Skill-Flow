import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, FormField, PrimaryButton } from '@/components/ui';
import { ImageUploader } from '@/components/image-uploader';
import { colors, contentPadding, font } from '@/constants/theme';
import { ServiceInput, StoreResult, useSession } from '@/context/session.remote';
import { Service } from '@/data/fixtures';
import { mediaInputs, type UploadedImage } from '@/media/types';

export function ServiceForm({ serviceId }: { serviceId?: string }) {
  const { currentAccount, saveService, services, setServiceStatus, verifications } = useSession();
  const existing = serviceId ? services.find((item) => item.id === serviceId) : undefined;
  const verification = verifications.find((item) => item.studentId === currentAccount?.id);
  const { title, setTitle, subtitle, setSubtitle, category, setCategory, description, setDescription, price, setPrice, deliveryDays, setDeliveryDays, revisions, setRevisions } = useServiceFormState(existing);
  const [cover, setCover] = useState<UploadedImage[]>([]);
  const [gallery, setGallery] = useState<UploadedImage[]>([]);
  if (!currentAccount || currentAccount.role !== 'student') return <View style={styles.blocked}><AppText>Only Student Designers can manage services.</AppText></View>;
  if (existing && existing.providerId !== currentAccount.id) return <View style={styles.blocked}><AppText>You can only edit your own services.</AppText></View>;
  const input = serviceInputWithMedia({ title, subtitle, category, description, price: Number(price), deliveryDays: Number(deliveryDays), revisions }, Boolean(existing), cover, gallery);
  const save = (publish: boolean) => saveServiceWithFeedback(saveService, input, publish, existing?.id, verification?.status === 'verified');
  const archive = () => archiveService(existing, setServiceStatus);
  return <ServiceFormContent state={{ title, setTitle, subtitle, setSubtitle, category, setCategory, description, setDescription, price, setPrice, deliveryDays, setDeliveryDays, revisions, setRevisions }} media={{ cover, setCover, gallery, setGallery }} isVerified={verification?.status === 'verified'} hasExisting={Boolean(existing)} onSave={save} onArchive={archive} />;
}

function serviceInputWithMedia(input: ServiceInput, hasExisting: boolean, cover: UploadedImage[], gallery: UploadedImage[]): ServiceInput {
  const coverInput = !hasExisting || cover.length ? { coverImage: mediaInputs(cover) } : {};
  const galleryInput = !hasExisting || gallery.length ? { galleryImages: mediaInputs(gallery) } : {};
  return { ...input, ...coverInput, ...galleryInput };
}

type ServiceFormState = {
  title: string; setTitle: (value: string) => void;
  subtitle: string; setSubtitle: (value: string) => void;
  category: string; setCategory: (value: string) => void;
  description: string; setDescription: (value: string) => void;
  price: string; setPrice: (value: string) => void;
  deliveryDays: string; setDeliveryDays: (value: string) => void;
  revisions: string; setRevisions: (value: string) => void;
};

function useServiceFormState(existing?: Service): ServiceFormState {
  const [title, setTitle] = useState(defaultServiceText(existing?.title, ''));
  const [subtitle, setSubtitle] = useState(defaultServiceText(existing?.subtitle, ''));
  const [category, setCategory] = useState(defaultServiceText(existing?.category, 'Graphics & Design'));
  const [description, setDescription] = useState(defaultServiceText(existing?.description, ''));
  const [price, setPrice] = useState(defaultServiceNumber(existing?.price, '1500'));
  const [deliveryDays, setDeliveryDays] = useState(defaultServiceNumber(existing?.deliveryDays, '3'));
  const [revisions, setRevisions] = useState(defaultServiceText(existing?.revisions, '2 revisions'));
  return { title, setTitle, subtitle, setSubtitle, category, setCategory, description, setDescription, price, setPrice, deliveryDays, setDeliveryDays, revisions, setRevisions };
}

function defaultServiceText(value: string | undefined, fallback: string) { return value ?? fallback; }
function defaultServiceNumber(value: number | undefined, fallback: string) { return value === undefined ? fallback : String(value); }

type ServiceFormContentProps = {
  state: ServiceFormState;
  media: { cover: UploadedImage[]; setCover: (images: UploadedImage[]) => void; gallery: UploadedImage[]; setGallery: (images: UploadedImage[]) => void };
  isVerified: boolean;
  hasExisting: boolean;
  onSave: (publish: boolean) => void;
  onArchive: () => void;
};

function ServiceFormContent({ state, media, isVerified, hasExisting, onSave, onArchive }: ServiceFormContentProps) {
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <ServiceVerificationBanner isVerified={isVerified} />
    <ServiceFields state={state} />
    <ImageUploader purpose="service_cover" value={media.cover} onChange={media.setCover} max={1} required={!hasExisting} label="Service Cover" defaultAltText={state.title ? `${state.title} service cover` : 'Service cover image'} />
    <ImageUploader purpose="service_gallery" value={media.gallery} onChange={media.setGallery} max={4} label="Gallery Images" defaultAltText={state.title ? `${state.title} service sample` : 'Service gallery image'} />
    <ServiceActions hasExisting={hasExisting} onSave={onSave} onArchive={onArchive} />
  </ScrollView>;
}

function ServiceVerificationBanner({ isVerified }: { isVerified: boolean }) {
  if (isVerified) return <View style={styles.verified}><Ionicons name="checkmark-circle" size={20} color={colors.green} /><AppText weight="medium" style={styles.verifiedText}>Verified Student — publishing enabled</AppText></View>;
  return <Pressable onPress={() => router.push('/verification')} style={styles.warning}><Ionicons name="shield-outline" size={23} color={colors.burgundy} /><View style={{ flex: 1 }}><AppText weight="semibold" style={{ fontSize: 12 }}>Verification required to publish</AppText><AppText style={styles.warningText}>You may save a draft now or complete the simulated verification.</AppText></View><Ionicons name="chevron-forward" size={20} color={colors.burgundy} /></Pressable>;
}

function ServiceFields({ state }: { state: ServiceFormState }) {
  return <>
    <Label text="Service Title" /><FormField icon="briefcase-outline" value={state.title} onChangeText={state.setTitle} placeholder="Service Title" />
    <Label text="Short Description" /><FormField icon="text-outline" value={state.subtitle} onChangeText={state.setSubtitle} placeholder="Short Description" />
    <Label text="Category" /><FormField icon="grid-outline" value={state.category} onChangeText={state.setCategory} placeholder="Category" />
    <Label text="Full Description" /><TextInput value={state.description} onChangeText={state.setDescription} placeholder="Describe what the client will receive…" placeholderTextColor={colors.muted} multiline style={styles.textArea} />
    <Label text="Starting Price" /><FormField icon="cash-outline" value={state.price} onChangeText={state.setPrice} placeholder="Starting Price" keyboardType="number-pad" />
    <Label text="Delivery Days" /><FormField icon="alarm-outline" value={state.deliveryDays} onChangeText={state.setDeliveryDays} placeholder="Delivery Days" keyboardType="number-pad" />
    <Label text="Revisions" /><FormField icon="refresh-outline" value={state.revisions} onChangeText={state.setRevisions} placeholder="e.g. 2 revisions" />
  </>;
}

function ServiceActions({ hasExisting, onSave, onArchive }: Omit<ServiceFormContentProps, 'state' | 'media' | 'isVerified'>) {
  return <>
    <PrimaryButton title="Publish Service" onPress={() => onSave(true)} style={{ marginTop: 24 }} />
    <Pressable onPress={() => onSave(false)} style={styles.secondary}><AppText weight="semibold" style={{ color: colors.burgundy }}>Save Draft</AppText></Pressable>
    {hasExisting ? <Pressable onPress={onArchive} style={styles.archive}><AppText weight="semibold" style={{ color: colors.red }}>Archive Service</AppText></Pressable> : null}
  </>;
}

function saveServiceWithFeedback(
  saveService: (input: ServiceInput, publish: boolean, serviceId?: string) => Promise<{ ok: true; service: Service } | { ok: false; message: string }>,
  input: ServiceInput,
  publish: boolean,
  serviceId: string | undefined,
  isVerified: boolean,
) {
  return saveService(input, publish, serviceId).then((result) => {
  if (!result.ok) {
    const needsVerification = publish && !isVerified;
    Alert.alert(
      needsVerification ? 'Verification required' : 'Unable to save service',
      result.message,
      needsVerification ? [{ text: 'Cancel', style: 'cancel' as const }, { text: 'Verify Student Status', onPress: () => router.push('/verification') }] : undefined,
    );
    return;
  }
  Alert.alert(publish ? 'Service published' : 'Draft saved', `${result.service.title} was saved to SkillFlow.`);
  router.replace('/profile');
  });
}

async function archiveService(existing: Service | undefined, setServiceStatus: (serviceId: string, status: Service['status']) => Promise<StoreResult>) {
  if (!existing) return;
  const result = await setServiceStatus(existing.id, 'archived');
  Alert.alert(result.ok ? 'Service archived' : 'Unable to archive', result.ok ? 'The service is no longer visible in the marketplace.' : result.message);
  if (result.ok) router.replace('/profile');
}

function Label({ text }: { text: string }) { return <AppText weight="semibold" style={styles.label}>{text}</AppText>; }
const styles = StyleSheet.create({ content: { padding: contentPadding, paddingBottom: 38 }, blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: contentPadding }, warning: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.blush, borderRadius: 12, padding: 13 }, warningText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 2 }, verified: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.greenSoft, borderRadius: 11, padding: 12 }, verifiedText: { color: colors.green, fontSize: 11 }, label: { fontSize: 13, marginTop: 16, marginBottom: 7 }, textArea: { minHeight: 130, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 13, fontFamily: font.regular, fontSize: 13, color: colors.ink, textAlignVertical: 'top' }, secondary: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, archive: { minHeight: 45, alignItems: 'center', justifyContent: 'center', marginTop: 8 } });
