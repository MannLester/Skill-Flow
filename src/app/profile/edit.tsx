import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { ImageUploader } from '@/components/image-uploader';
import { colors, contentPadding, font } from '@/constants/theme';
import { ProfileInput, UserProfile, UserRole, useSession } from '@/context/session.remote';
import { consumeResult } from '@/utils/consume-result';
import { mediaInputs, type UploadedImage } from '@/media/types';

export default function EditProfileScreen() {
  const { currentAccount, profiles, updateProfile } = useSession();
  const profile = profiles.find((item) => item.accountId === currentAccount?.id);
  const fields = useProfileFields(currentAccount?.name, profile);
  const [avatar, setAvatar] = useState<UploadedImage[]>([]);
  if (!currentAccount) return <MobilePage><AppHeader title="Edit Profile" onBack={() => router.back()} /><AppText>Please log in.</AppText></MobilePage>;
  const save = () => consumeResult(updateProfile({ ...profileInput(currentAccount.role, fields.values), ...(avatar.length ? { avatar: mediaInputs(avatar) } : {}) }), (result) => {
    if (!result.ok) return Alert.alert('Unable to save', result.message);
    Alert.alert('Profile saved', 'Your SkillFlow profile was updated.');
    router.back();
  });
  return <MobilePage><StatusBar style="light" /><AppHeader title="Edit Profile" onBack={() => router.back()} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><ImageUploader purpose="avatar" value={avatar} onChange={setAvatar} max={1} label="Profile Image" defaultAltText={`${fields.values.name || 'SkillFlow user'} profile image`} /><Label text="Display Name" /><FormField icon="person-outline" value={fields.values.name} onChangeText={fields.setters.setName} placeholder="Display Name" /><Label text="Bio" /><TextInput value={fields.values.bio} onChangeText={fields.setters.setBio} placeholder="Tell clients or students about yourself…" placeholderTextColor={colors.muted} multiline style={styles.textArea} /><Label text="Location" /><FormField icon="location-outline" value={fields.values.location} onChangeText={fields.setters.setLocation} placeholder="Location" /><RoleFields role={currentAccount.role} values={fields.values} setters={fields.setters} /><PrimaryButton title="Save Profile" onPress={save} style={{ marginTop: 23 }} /></ScrollView></KeyboardAvoidingView></MobilePage>;
}

function useProfileFields(accountName: string | undefined, profile: UserProfile | undefined) {
  const value = (key: keyof UserProfile) => profileValue(profile, key);
  const [name, setName] = useState(text(accountName)); const [bio, setBio] = useState(value('bio')); const [location, setLocation] = useState(value('location'));
  const [organization, setOrganization] = useState(value('organization')); const [school, setSchool] = useState(value('school')); const [program, setProgram] = useState(value('program'));
  const [gradeLevel, setGradeLevel] = useState(value('gradeLevel')); const [graduationYear, setGraduationYear] = useState(yearValue(profile)); const [skills, setSkills] = useState(skillsValue(profile));
  return { values: { name, bio, location, organization, school, program, gradeLevel, graduationYear, skills }, setters: { setName, setBio, setLocation, setOrganization, setSchool, setProgram, setGradeLevel, setGraduationYear, setSkills } };
}

function text(value: unknown) { return typeof value === 'string' ? value : ''; }
function profileValue(profile: UserProfile | undefined, key: keyof UserProfile) { return profile ? text(profile[key]) : ''; }
function yearValue(profile: UserProfile | undefined) { return profile?.graduationYear ? String(profile.graduationYear) : ''; }
function skillsValue(profile: UserProfile | undefined) { return profile ? profile.skills.join(', ') : ''; }

type Fields = ReturnType<typeof useProfileFields>;
function profileInput(role: UserRole, values: Fields['values']): ProfileInput {
  const student = role === 'student';
  return { name: values.name, bio: values.bio, location: values.location, organization: student ? undefined : values.organization, school: student ? values.school : undefined, program: student ? values.program : undefined, gradeLevel: student ? values.gradeLevel : undefined, graduationYear: student && values.graduationYear ? Number(values.graduationYear) : undefined, skills: values.skills.split(',') };
}

function RoleFields({ role, values, setters }: { role: UserRole; values: Fields['values']; setters: Fields['setters'] }) {
  if (role === 'client') return <><Label text="Organization" /><FormField icon="business-outline" value={values.organization} onChangeText={setters.setOrganization} placeholder="Organization" /></>;
  return <><Label text="School" /><FormField icon="school-outline" value={values.school} onChangeText={setters.setSchool} placeholder="School" /><Label text="Program or Strand" /><FormField icon="book-outline" value={values.program} onChangeText={setters.setProgram} placeholder="Program or Strand" /><Label text="Grade Level" /><FormField icon="ribbon-outline" value={values.gradeLevel} onChangeText={setters.setGradeLevel} placeholder="Grade Level" /><Label text="Graduation Year" /><FormField icon="calendar-outline" value={values.graduationYear} onChangeText={setters.setGraduationYear} placeholder="Graduation Year" keyboardType="number-pad" /><Label text="Skills" /><FormField icon="sparkles-outline" value={values.skills} onChangeText={setters.setSkills} placeholder="Comma-separated skills" /></>;
}

function Label({ text }: { text: string }) { return <AppText weight="semibold" style={styles.label}>{text}</AppText>; }
const styles = StyleSheet.create({ content: { padding: contentPadding, paddingBottom: 36 }, label: { fontSize: 13, marginTop: 15, marginBottom: 7 }, textArea: { minHeight: 105, borderWidth: 1, borderColor: colors.border, borderRadius: 9, padding: 13, fontFamily: font.regular, fontSize: 13, color: colors.ink, textAlignVertical: 'top' } });
