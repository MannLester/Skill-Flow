import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding, font } from '@/constants/theme';
import { useSession } from '@/context/session.remote';
import { consumeResult } from '@/utils/consume-result';

type PortfolioFormErrors = { title?: string; category?: string; description?: string; form?: string };
type PortfolioFormValues = Pick<PortfolioFormErrors, 'title' | 'category' | 'description'>;

function validatePortfolioForm(values: PortfolioFormValues): PortfolioFormErrors {
  const errors: PortfolioFormErrors = {};
  if (!values.title?.trim()) errors.title = 'Enter a project title.';
  if (!values.category?.trim()) errors.category = 'Enter a category.';
  if (!values.description?.trim()) errors.description = 'Describe the work, skills, and outcome.';
  if (Object.keys(errors).length) errors.form = 'Complete the portfolio title, category, and description.';
  return errors;
}

export default function NewPortfolioItemScreen() {
  const { addPortfolioItem } = useSession();
  const [title, setTitle] = useState(''); const [category, setCategory] = useState(''); const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<PortfolioFormErrors>({});
  const clearError = (field: keyof PortfolioFormValues) => setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  const save = () => {
    const nextErrors = validatePortfolioForm({ title, category, description });
    if (nextErrors.form) return setErrors(nextErrors);
    consumeResult(addPortfolioItem({ title, category, description }), (result) => {
      if (!result.ok) return setErrors({ form: result.message });
      setErrors({});
      Alert.alert('Portfolio updated', 'The work sample was added to your SkillFlow profile.');
      router.back();
    });
  };
  return <MobilePage><StatusBar style="light" /><AppHeader title="Add Portfolio Item" onBack={() => router.back()} /><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Label text="Project Title" /><FormField icon="images-outline" value={title} onChangeText={(value) => { setTitle(value); clearError('title'); }} placeholder="Project Title" accessibilityLabel="Project title" accessibilityHint={errors.title ?? 'Required. Enter a project title.'} style={errors.title ? styles.fieldError : undefined} /><FieldError message={errors.title} />
    <Label text="Category" /><FormField icon="grid-outline" value={category} onChangeText={(value) => { setCategory(value); clearError('category'); }} placeholder="e.g. Graphics & Design" accessibilityLabel="Portfolio category" accessibilityHint={errors.category ?? 'Required. Enter a category.'} style={errors.category ? styles.fieldError : undefined} /><FieldError message={errors.category} />
    <Label text="Description" /><TextInput value={description} onChangeText={(value) => { setDescription(value); clearError('description'); }} placeholder="Describe the work, skills, and outcome…" placeholderTextColor={colors.muted} multiline accessibilityLabel="Portfolio description" accessibilityHint={errors.description ?? 'Required. Describe the work, skills, and outcome.'} style={[styles.textArea, errors.description ? styles.textAreaError : undefined]} /><FieldError message={errors.description} />
    <AppText style={styles.note}>Use sample work only. File uploads will be added with later AI and media improvements.</AppText><PortfolioErrorSummary errors={errors} /><PrimaryButton title="Add to Portfolio" onPress={save} style={{ marginTop: 22 }} />
  </ScrollView></MobilePage>;
}
function Label({ text }: { text: string }) { return <AppText weight="semibold" style={styles.label}>{text}</AppText>; }
function PortfolioErrorSummary({ errors }: { errors: PortfolioFormErrors }) {
  if (!errors.form) return null;
  const detail = errors.title || errors.category || errors.description ? 'Edit the highlighted fields and try again.' : 'Review the details and try again.';
  return <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorSummary}><AppText weight="semibold" style={styles.errorTitle}>Unable to add portfolio item</AppText><AppText style={styles.errorText}>{errors.form} {detail}</AppText></View>;
}
function FieldError({ message }: { message?: string }) { return message ? <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{message}</AppText> : null; }
const styles = StyleSheet.create({ content: { padding: contentPadding, paddingBottom: 34 }, label: { fontSize: 14, marginTop: 17, marginBottom: 7 }, fieldError: { borderColor: colors.red, backgroundColor: colors.blush }, textArea: { minHeight: 140, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 13, fontFamily: font.regular, fontSize: 13, color: colors.ink, textAlignVertical: 'top' }, textAreaError: { borderColor: colors.red, backgroundColor: colors.blush }, errorSummary: { borderWidth: 1, borderColor: colors.red, borderRadius: 10, backgroundColor: colors.blush, padding: 12, marginTop: 14 }, errorTitle: { color: colors.red, fontSize: 12 }, errorText: { color: colors.burgundy, fontSize: 10, lineHeight: 16, marginTop: 3 }, error: { color: colors.red, fontSize: 10, lineHeight: 15, marginTop: 5 }, note: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 10 } });
