import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { ImageUploader } from '@/components/image-uploader';
import { contentPadding } from '@/constants/theme';
import { useSession } from '@/context/session.remote';
import { mediaInputs, type UploadedImage } from '@/media/types';

export default function NewCertificationScreen() {
  const { addCertification } = useSession();
  const [name, setName] = useState(''); const [issuer, setIssuer] = useState(''); const [year, setYear] = useState(String(new Date().getFullYear()));
  const [images, setImages] = useState<UploadedImage[]>([]);
  const save = async () => { if (images.length !== 1) return Alert.alert('Evidence required', 'Add exactly one certification image.'); const result = await addCertification({ name, issuer, year: Number(year), evidenceImage: mediaInputs(images) }); if (!result.ok) Alert.alert('Unable to add certification', result.message); else { Alert.alert('Certification added', 'The credential was saved to your SkillFlow profile.'); router.back(); } };
  return <MobilePage><StatusBar style="light" /><AppHeader title="Add Certification" onBack={() => router.back()} /><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Label text="Certification Name" /><FormField icon="ribbon-outline" value={name} onChangeText={setName} placeholder="Certification Name" /><Label text="Issuer" /><FormField icon="business-outline" value={issuer} onChangeText={setIssuer} placeholder="Issuer" /><Label text="Year" /><FormField icon="calendar-outline" value={year} onChangeText={setYear} placeholder="Year" keyboardType="number-pad" /><ImageUploader purpose="certification_evidence" value={images} onChange={setImages} max={1} required label="Certification Evidence" defaultAltText={name ? `${name} certification evidence` : 'Certification evidence'} /><PrimaryButton title="Add Certification" onPress={save} style={{ marginTop: 24 }} /></ScrollView></MobilePage>;
}
function Label({ text }: { text: string }) { return <AppText weight="semibold" style={styles.label}>{text}</AppText>; }
const styles = StyleSheet.create({ content: { padding: contentPadding }, label: { fontSize: 14, marginTop: 17, marginBottom: 7 } });
