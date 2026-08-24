import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding, font } from '@/constants/theme';
import { useSession } from '@/context/session';

export default function NewPortfolioItemScreen() {
  const { addPortfolioItem } = useSession();
  const [title, setTitle] = useState(''); const [category, setCategory] = useState(''); const [description, setDescription] = useState('');
  const save = () => { const result = addPortfolioItem({ title, category, description }); if (!result.ok) Alert.alert('Unable to add item', result.message); else { Alert.alert('Portfolio updated', 'The work sample was added locally.'); router.back(); } };
  return <MobilePage><StatusBar style="light" /><AppHeader title="Add Portfolio Item" onBack={() => router.back()} /><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Label text="Project Title" /><FormField icon="images-outline" value={title} onChangeText={setTitle} placeholder="Project Title" /><Label text="Category" /><FormField icon="grid-outline" value={category} onChangeText={setCategory} placeholder="e.g. Graphics & Design" /><Label text="Description" /><TextInput value={description} onChangeText={setDescription} placeholder="Describe the work, skills, and outcome…" placeholderTextColor={colors.muted} multiline style={styles.textArea} /><AppText style={styles.note}>Use sample work only. File uploads will be added with later AI and media improvements.</AppText><PrimaryButton title="Add to Portfolio" onPress={save} style={{ marginTop: 22 }} /></ScrollView></MobilePage>;
}
function Label({ text }: { text: string }) { return <AppText weight="semibold" style={styles.label}>{text}</AppText>; }
const styles = StyleSheet.create({ content: { padding: contentPadding }, label: { fontSize: 14, marginTop: 17, marginBottom: 7 }, textArea: { minHeight: 140, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 13, fontFamily: font.regular, fontSize: 13, color: colors.ink, textAlignVertical: 'top' }, note: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 10 } });
