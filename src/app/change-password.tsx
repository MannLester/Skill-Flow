import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppHeader, AppText, FormField, MobilePage, PrimaryButton } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';
import { useSession } from '@/context/session';

export default function ChangePasswordScreen() { const { changePassword } = useSession(); const [current, setCurrent] = useState(''); const [next, setNext] = useState(''); const [confirm, setConfirm] = useState(''); const save = () => { if (next !== confirm) return Alert.alert('Passwords do not match', 'Confirm the same new password.'); const result = changePassword(current, next); Alert.alert(result.ok ? 'Password updated' : 'Unable to update password', result.ok ? 'Your local demo password has changed.' : result.message); if (result.ok) router.back(); }; return <MobilePage><StatusBar style="light" /><AppHeader title="Change Password" onBack={() => router.back()} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content}><AppText style={styles.note}>This changes only the locally stored demonstration account.</AppText><FormField icon="lock-closed-outline" value={current} onChangeText={setCurrent} placeholder="Current password" secureTextEntry /><FormField icon="key-outline" value={next} onChangeText={setNext} placeholder="New password" secureTextEntry /><FormField icon="checkmark-circle-outline" value={confirm} onChangeText={setConfirm} placeholder="Confirm new password" secureTextEntry /><PrimaryButton title="Update Password" onPress={save} /></ScrollView></KeyboardAvoidingView></MobilePage>; }
const styles = StyleSheet.create({ content: { padding: contentPadding, gap: 13 }, note: { color: colors.muted, fontSize: 11, lineHeight: 18, marginBottom: 5 } });
