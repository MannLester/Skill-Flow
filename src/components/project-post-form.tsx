import { router } from 'expo-router';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { AppText, FormField, PrimaryButton } from '@/components/ui';
import { ImageUploader } from '@/components/image-uploader';
import { colors, contentPadding, font } from '@/constants/theme';
import { ProjectPost, ProjectPostInput, useSession } from '@/context/session.remote';
import { consumeResult } from '@/utils/consume-result';
import { mediaInputs, type UploadedImage } from '@/media/types';

type ProjectPostField = 'title' | 'description' | 'category' | 'budget' | 'deadline' | 'skills';
type ProjectPostFormErrors = Partial<Record<ProjectPostField, string>> & { form?: string };
type ProjectPostFormValues = Record<ProjectPostField, string>;

function validateProjectPost(values: ProjectPostFormValues): ProjectPostFormErrors {
  const errors: ProjectPostFormErrors = {};
  if (!values.title.trim()) errors.title = 'Enter a project title.';
  if (!values.category.trim()) errors.category = 'Enter a category.';
  if (!values.description.trim()) errors.description = 'Describe the project goal, deliverables, and expectations.';
  if (!Number.isFinite(Number(values.budget)) || Number(values.budget) <= 0) errors.budget = 'Enter a valid budget greater than zero.';
  if (!values.deadline.trim() || Number.isNaN(new Date(values.deadline).getTime())) errors.deadline = 'Enter a valid deadline such as 2026-09-30.';
  if (!values.skills.split(',').some((skill) => skill.trim())) errors.skills = 'Add at least one required skill.';
  return errors;
}

function textValue(value: string | undefined, fallback = '') { return value ?? fallback; }
function budgetValue(existing?: ProjectPost) { return existing ? String(existing.budget) : '1500'; }

export function ProjectPostForm({ postId }: { postId?: string }) {
  const { currentAccount, projectPosts, saveProjectPost, setProjectPostStatus } = useSession();
  const existing = postId ? projectPosts.find((item) => item.id === postId) : undefined;
  const form = useProjectPostValues(existing);

  if (!currentAccount || currentAccount.role !== 'client') return <Blocked message="Only Clients can create project posts." />;
  if (existing && existing.clientId !== currentAccount.id) return <Blocked message="You can only edit your own project posts." />;

  const save = (publish: boolean) => {
    const localErrors = validateProjectPost(form.values);
    if (Object.keys(localErrors).length) {
      form.showErrors('Complete every project field with valid values.', localErrors);
      return;
    }
    consumeResult(saveProjectPost(form.input, publish, existing?.id), (result) => {
      if (!result.ok) return form.showErrors(result.message);
      form.clearErrors();
      Alert.alert(publish ? 'Project published' : 'Draft saved', publish ? 'Verified Student Designers can now submit proposals.' : 'You can return and publish this project later.');
      router.replace({ pathname: '/project-posts/[postId]', params: { postId: result.projectPost.id } });
    });
  };
  const archive = () => {
    if (!existing) return;
    consumeResult(setProjectPostStatus(existing.id, 'archived'), (result) => {
      Alert.alert(result.ok ? 'Project archived' : 'Unable to archive', result.ok ? 'The project is retained in your SkillFlow history.' : result.message);
      if (result.ok) router.replace('/projects');
    });
  };

  return <ProjectPostFields form={form} save={save} archive={archive} showArchive={Boolean(existing)} />;
}

function useProjectPostValues(existing?: ProjectPost) {
  const [title, setTitle] = useState(textValue(existing?.title));
  const [description, setDescription] = useState(textValue(existing?.description));
  const [category, setCategory] = useState(textValue(existing?.category, 'Graphics & Design'));
  const [budget, setBudget] = useState(budgetValue(existing));
  const [deadline, setDeadline] = useState(textValue(existing?.deadline, '2026-09-30'));
  const [skills, setSkills] = useState(textValue(existing?.skills.join(', ')));
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [errors, setErrors] = useState<ProjectPostFormErrors>({});
  const [errorAttempt, setErrorAttempt] = useState(0);
  const errorSummaryRef = useRef<View>(null);

  useEffect(() => {
    if (errors.form) errorSummaryRef.current?.focus?.();
  }, [errorAttempt, errors.form]);
  const values = { title, description, category, budget, deadline, skills };
  const input: ProjectPostInput = { ...values, budget: Number(budget), skills: skills.split(','), ...(images.length ? { referenceImages: mediaInputs(images) } : {}) };
  const update = (field: ProjectPostField, value: string, setter: (next: string) => void) => {
    setter(value);
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };
  const showErrors = (message: string, fieldErrors = validateProjectPost(values)) => {
    setErrors({ ...fieldErrors, form: message });
    setErrorAttempt((current) => current + 1);
  };
  return { values, input, images, setImages, errors, errorSummaryRef, update, setters: { setTitle, setDescription, setCategory, setBudget, setDeadline, setSkills }, showErrors, clearErrors: () => setErrors({}) };
}

function ProjectPostFields({ form, save, archive, showArchive }: { form: ReturnType<typeof useProjectPostValues>; save: (publish: boolean) => void | Promise<void>; archive: () => void | Promise<void>; showArchive: boolean }) {
  const { values, errors, errorSummaryRef, setters } = form;
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.note}><AppText weight="semibold" style={styles.noteTitle}>Client project brief</AppText><AppText style={styles.noteText}>Publishing opens this brief for authenticated Student Designers. Payment remains simulated.</AppText></View>
    <ProjectFormField form={form} field="title" label="Project Title" icon="briefcase-outline" value={values.title} setter={setters.setTitle} placeholder="Project title" accessibilityLabel="Project title" hint="Required. Enter a project title." />
    <ProjectFormField form={form} field="category" label="Category" icon="grid-outline" value={values.category} setter={setters.setCategory} placeholder="Category" accessibilityLabel="Project category" hint="Required. Enter a category." />
    <ProjectDescriptionField form={form} value={values.description} setter={setters.setDescription} />
    <ProjectFormField form={form} field="budget" label="Budget" icon="cash-outline" value={values.budget} setter={setters.setBudget} placeholder="Budget" accessibilityLabel="Project budget" hint="Required. Enter a budget greater than zero." keyboardType="number-pad" />
    <ProjectFormField form={form} field="deadline" label="Deadline (YYYY-MM-DD)" icon="calendar-outline" value={values.deadline} setter={setters.setDeadline} placeholder="2026-09-30" accessibilityLabel="Project deadline" hint="Required. Enter a deadline in YYYY-MM-DD format." />
    <ProjectFormField form={form} field="skills" label="Required Skills (comma separated)" icon="sparkles-outline" value={values.skills} setter={setters.setSkills} placeholder="UI/UX, Prototyping" accessibilityLabel="Required skills" hint="Required. Add at least one skill." />
    <ImageUploader purpose="project_reference" value={form.images} onChange={form.setImages} max={5} label="Reference Images" defaultAltText={values.title ? `${values.title} project reference` : 'Project reference image'} />
    <ProjectPostErrorSummary ref={errorSummaryRef} errors={errors} />
    <PrimaryButton title="Publish Project" onPress={() => save(true)} style={{ marginTop: 24 }} />
    <Pressable accessibilityRole="button" onPress={() => save(false)} style={styles.secondary}><AppText weight="semibold" style={{ color: colors.burgundy }}>Save Draft</AppText></Pressable>
    {showArchive ? <Pressable accessibilityRole="button" onPress={archive} style={styles.archive}><AppText weight="semibold" style={{ color: colors.red }}>Archive Project</AppText></Pressable> : null}
  </ScrollView>;
}

function Blocked({ message }: { message: string }) { return <View style={styles.blocked}><AppText>{message}</AppText></View>; }
function ProjectFormField({ form, field, label, icon, value, setter, placeholder, accessibilityLabel, hint, keyboardType }: { form: ReturnType<typeof useProjectPostValues>; field: ProjectPostField; label: string; icon: ComponentProps<typeof FormField>['icon']; value: string; setter: (value: string) => void; placeholder: string; accessibilityLabel: string; hint: string; keyboardType?: TextInputProps['keyboardType'] }) {
  const error = form.errors[field];
  return <><Label text={label} /><FormField icon={icon} value={value} onChangeText={(next) => form.update(field, next, setter)} placeholder={placeholder} accessibilityLabel={accessibilityLabel} accessibilityHint={error ?? hint} style={error ? styles.fieldError : undefined} keyboardType={keyboardType} /><FieldError message={error} /></>;
}
function ProjectDescriptionField({ form, value, setter }: { form: ReturnType<typeof useProjectPostValues>; value: string; setter: (value: string) => void }) {
  const error = form.errors.description;
  return <><Label text="Project Description" /><TextInput value={value} onChangeText={(next) => form.update('description', next, setter)} placeholder="Describe the goal, deliverables, and expectations…" placeholderTextColor={colors.muted} multiline accessibilityLabel="Project description" accessibilityHint={error ?? 'Required. Describe the project goal, deliverables, and expectations.'} style={[styles.textArea, error ? styles.textAreaError : undefined]} /><FieldError message={error} /></>;
}
function Label({ text }: { text: string }) { return <AppText weight="semibold" style={styles.label}>{text}</AppText>; }
function FieldError({ message }: { message?: string }) { return message ? <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{message}</AppText> : null; }
function ProjectPostErrorSummary({ ref, errors }: { ref: React.Ref<View>; errors: ProjectPostFormErrors }) {
  if (!errors.form) return null;
  const hasFieldErrors = Object.keys(errors).some((field) => field !== 'form');
  return <View ref={ref} testID="project-post-error-summary" accessible accessibilityRole="alert" accessibilityLiveRegion="assertive" focusable tabIndex={-1} style={styles.errorSummary}><AppText weight="semibold" style={styles.errorTitle}>Unable to save project</AppText><AppText style={styles.errorText}>{errors.form} {hasFieldErrors ? 'Edit the highlighted fields and try again.' : 'Review the project and try again.'}</AppText></View>;
}
const styles = StyleSheet.create({
  content: { padding: contentPadding, paddingBottom: 38 }, blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: contentPadding },
  note: { backgroundColor: colors.blush, borderRadius: 12, padding: 14 }, noteTitle: { fontSize: 13 }, noteText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 3 },
  label: { fontSize: 13, marginTop: 16, marginBottom: 7 }, textArea: { minHeight: 140, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 13, fontFamily: font.regular, fontSize: 13, color: colors.ink, textAlignVertical: 'top' },
  fieldError: { borderColor: colors.red, backgroundColor: colors.blush }, textAreaError: { borderColor: colors.red, backgroundColor: colors.blush },
  errorSummary: { borderWidth: 1, borderColor: colors.red, borderRadius: 10, backgroundColor: colors.blush, padding: 12, marginTop: 18 }, errorTitle: { color: colors.red, fontSize: 12 }, errorText: { color: colors.burgundy, fontSize: 10, lineHeight: 16, marginTop: 3 }, error: { color: colors.red, fontSize: 10, lineHeight: 15, marginTop: 5 },
  secondary: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, archive: { minHeight: 45, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
