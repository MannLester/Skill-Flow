import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding, font } from '@/constants/theme';
import { useSession } from '@/context/session';

export default function EditProfileScreen() {
  const { currentAccount, profiles, updateProfile } = useSession();
  const profile = profiles.find((item) => item.accountId === currentAccount?.id);
  const [name, setName] = useState(currentAccount?.name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [location, setLocation] = useState(profile?.location ?? '');
  const [organization, setOrganization] = useState(profile?.organization ?? '');
  const [school, setSchool] = useState(profile?.school ?? '');
  const [program, setProgram] = useState(profile?.program ?? '');
  const [gradeLevel, setGradeLevel] = useState(profile?.gradeLevel ?? '');
  const [graduationYear, setGraduationYear] = useState(profile?.graduationYear ? String(profile.graduationYear) : '');
  const [skills, setSkills] = useState(profile?.skills.join(', ') ?? '');
  if (!currentAccount) return <MobilePage><AppHeader title="Edit Profile" onBack={() => router.back()} /><AppText>Please log in.</AppText></MobilePage>;
  const save = () => {
    const result = updateProfile({ name, bio, location, organization: currentAccount.role === 'client' ? organization : undefined, school: currentAccount.role === 'student' ? school : undefined, program: currentAccount.role === 'student' ? program : undefined, gradeLevel: currentAccount.role === 'student' ? gradeLevel : undefined, graduationYear: graduationYear ? Number(graduationYear) : undefined, skills: skills.split(',') });
    if (!result.ok) Alert.alert('Unable to save', result.message); else { Alert.alert('Profile saved', 'Your local demo profile was updated.'); router.back(); }
  };
  return <MobilePage><StatusBar style="light" /><AppHeader title="Edit Profile" onBack={() => router.back()} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Label text="Display Name" /><FormField icon="person-outline" value={name} onChangeText={setName} placeholder="Display Name" /><Label text="Bio" /><TextInput value={bio} onChangeText={setBio} placeholder="Tell clients or students about yourself…" placeholderTextColor={colors.muted} multiline style={styles.textArea} /><Label text="Location" /><FormField icon="location-outline" value={location} onChangeText={setLocation} placeholder="Location" />{currentAccount.role === 'client' ? <><Label text="Organization" /><FormField icon="business-outline" value={organization} onChangeText={setOrganization} placeholder="Organization" /></> : <><Label text="School" /><FormField icon="school-outline" value={school} onChangeText={setSchool} placeholder="School" /><Label text="Program or Strand" /><FormField icon="book-outline" value={program} onChangeText={setProgram} placeholder="Program or Strand" /><Label text="Grade Level" /><FormField icon="ribbon-outline" value={gradeLevel} onChangeText={setGradeLevel} placeholder="Grade Level" /><Label text="Graduation Year" /><FormField icon="calendar-outline" value={graduationYear} onChangeText={setGraduationYear} placeholder="Graduation Year" keyboardType="number-pad" /><Label text="Skills" /><FormField icon="sparkles-outline" value={skills} onChangeText={setSkills} placeholder="Comma-separated skills" /></>}<PrimaryButton title="Save Profile" onPress={save} style={{ marginTop: 23 }} /></ScrollView></KeyboardAvoidingView></MobilePage>;
}
function Label({ text }: { text: string }) { return <AppText weight="semibold" style={styles.label}>{text}</AppText>; }
const styles = StyleSheet.create({ content: { padding: contentPadding, paddingBottom: 36 }, label: { fontSize: 13, marginTop: 15, marginBottom: 7 }, textArea: { minHeight: 105, borderWidth: 1, borderColor: colors.border, borderRadius: 9, padding: 13, fontFamily: font.regular, fontSize: 13, color: colors.ink, textAlignVertical: 'top' } });
