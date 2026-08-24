import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, FormField, PrimaryButton } from '@/components/ui';
import { colors, contentPadding, font } from '@/constants/theme';
import { ProjectPostInput, useSession } from '@/context/session';

export function ProjectPostForm({ postId }: { postId?: string }) {
  const { currentAccount, projectPosts, saveProjectPost, setProjectPostStatus } = useSession();
  const existing = postId ? projectPosts.find((item) => item.id === postId) : undefined;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState(existing?.category ?? 'Graphics & Design');
  const [budget, setBudget] = useState(existing ? String(existing.budget) : '1500');
  const [deadline, setDeadline] = useState(existing?.deadline ?? '2026-09-30');
  const [skills, setSkills] = useState(existing?.skills.join(', ') ?? '');

  if (!currentAccount || currentAccount.role !== 'client') return <View style={styles.blocked}><AppText>Only Clients can create project posts.</AppText></View>;
  if (existing && existing.clientId !== currentAccount.id) return <View style={styles.blocked}><AppText>You can only edit your own project posts.</AppText></View>;

  const input: ProjectPostInput = { title, description, category, budget: Number(budget), deadline, skills: skills.split(',') };
  const save = (publish: boolean) => {
    const result = saveProjectPost(input, publish, existing?.id);
    if (!result.ok) return Alert.alert('Unable to save project', result.message);
    Alert.alert(publish ? 'Project published' : 'Draft saved', publish ? 'Verified Student Designers can now submit proposals.' : 'You can return and publish this project later.');
    router.replace({ pathname: '/project-posts/[postId]', params: { postId: result.projectPost.id } });
  };
  const archive = () => {
    if (!existing) return;
    const result = setProjectPostStatus(existing.id, 'archived');
    Alert.alert(result.ok ? 'Project archived' : 'Unable to archive', result.ok ? 'The project is retained in your local history.' : result.message);
    if (result.ok) router.replace('/projects/index');
  };

  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.note}><AppText weight="semibold" style={styles.noteTitle}>Client project brief</AppText><AppText style={styles.noteText}>Publishing opens this brief for local demo proposals. No real payment or external posting is involved.</AppText></View>
    <Label text="Project Title" /><FormField icon="briefcase-outline" value={title} onChangeText={setTitle} placeholder="Project title" />
    <Label text="Category" /><FormField icon="grid-outline" value={category} onChangeText={setCategory} placeholder="Category" />
    <Label text="Project Description" /><TextInput value={description} onChangeText={setDescription} placeholder="Describe the goal, deliverables, and expectations…" placeholderTextColor={colors.muted} multiline style={styles.textArea} />
    <Label text="Budget" /><FormField icon="cash-outline" value={budget} onChangeText={setBudget} placeholder="Budget" keyboardType="number-pad" />
    <Label text="Deadline (YYYY-MM-DD)" /><FormField icon="calendar-outline" value={deadline} onChangeText={setDeadline} placeholder="2026-09-30" />
    <Label text="Required Skills (comma separated)" /><FormField icon="sparkles-outline" value={skills} onChangeText={setSkills} placeholder="UI/UX, Prototyping" />
    <PrimaryButton title="Publish Project" onPress={() => save(true)} style={{ marginTop: 24 }} />
    <Pressable onPress={() => save(false)} style={styles.secondary}><AppText weight="semibold" style={{ color: colors.burgundy }}>Save Draft</AppText></Pressable>
    {existing ? <Pressable onPress={archive} style={styles.archive}><AppText weight="semibold" style={{ color: colors.red }}>Archive Project</AppText></Pressable> : null}
  </ScrollView>;
}

function Label({ text }: { text: string }) { return <AppText weight="semibold" style={styles.label}>{text}</AppText>; }
const styles = StyleSheet.create({
  content: { padding: contentPadding, paddingBottom: 38 }, blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: contentPadding },
  note: { backgroundColor: colors.blush, borderRadius: 12, padding: 14 }, noteTitle: { fontSize: 13 }, noteText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 3 },
  label: { fontSize: 13, marginTop: 16, marginBottom: 7 }, textArea: { minHeight: 140, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 13, fontFamily: font.regular, fontSize: 13, color: colors.ink, textAlignVertical: 'top' },
  secondary: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, archive: { minHeight: 45, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
