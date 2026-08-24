import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppText, MobilePage, PrimaryButton, ReferenceCrop } from '@/components/ui';
import { colors, contentPadding, font } from '@/constants/theme';
import { formatPeso } from '@/data/fixtures';
import { useSession } from '@/context/session';

const marketReference = require('../../../../references/student_marketplace_page.jpg');

export default function BookServiceScreen() {
  const insets = useSafeAreaInsets();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { createBooking, currentAccount, services } = useSession();
  const service = services.find((item) => item.id === serviceId);
  const [description, setDescription] = useState('');
  const [deliveryDays, setDeliveryDays] = useState(service?.deliveryDays ?? 3);
  const [budget, setBudget] = useState(service?.price ?? 1500);

  if (!service) return <MobilePage><StatusBar style="light" /><AppHeader title="Book Service" onBack={() => router.back()} /><View style={styles.missing}><AppText weight="semibold">Service not found.</AppText></View></MobilePage>;

  const chooseDelivery = () => Alert.alert('Delivery Time', 'Select a demo delivery target.', [3, 5, 7].map((days) => ({ text: `${days} Days`, onPress: () => setDeliveryDays(days) })));
  const chooseBudget = () => Alert.alert('Budget', 'Select a simulated project budget.', [service.price, service.price + 500, service.price + 1000].map((value) => ({ text: formatPeso(value), onPress: () => setBudget(value) })));
  const submit = () => {
    if (currentAccount?.role !== 'client') {
      Alert.alert('Client action', 'Log in with the Mark demo account to send a service request.');
      return;
    }
    if (description.trim().length < 10) {
      Alert.alert('Add project details', 'Please enter at least 10 characters so the student understands the request.');
      return;
    }
    const booking = createBooking({ serviceId: service.id, studentId: service.providerId, title: service.title, description: description.trim(), deliveryDays, budget });
    router.replace({ pathname: '/projects/[projectId]', params: { projectId: booking.id } });
  };

  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title="Book Service" onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.summary}>
            <ReferenceCrop source={marketReference} sourceSize={{ width: 1920, height: 1080 }} crop={service.crop} style={styles.thumb} />
            <View><AppText weight="semibold" style={styles.title}>{service.title}</AppText><AppText style={styles.byline}>by {service.provider}</AppText><AppText weight="bold" style={styles.price}>{formatPeso(service.price)}</AppText></View>
          </View>
          <AppText weight="semibold" style={styles.label}>Project Details</AppText>
          <View style={styles.textArea}><TextInput value={description} onChangeText={setDescription} placeholder="Describe your project…" placeholderTextColor={colors.muted} multiline maxLength={500} style={styles.multiline} /><AppText style={styles.counter}>{description.length}/500</AppText></View>
          <AppText weight="semibold" style={styles.label}>Delivery Time</AppText><SelectRow value={`${deliveryDays} Days`} onPress={chooseDelivery} />
          <AppText weight="semibold" style={styles.label}>Budget</AppText><SelectRow value={formatPeso(budget)} onPress={chooseBudget} />
          <AppText style={styles.demoNote}>Demo only — no real payment will be collected.</AppText>
          <PrimaryButton title="Send Request" onPress={submit} style={{ marginTop: 18 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </MobilePage>
  );
}

function SelectRow({ value, onPress }: { value: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.select}><AppText weight="medium" style={{ fontSize: 15 }}>{value}</AppText><Ionicons name="chevron-down" size={23} color={colors.ink} /></Pressable>; }

const styles = StyleSheet.create({
  scroll: { padding: contentPadding }, summary: { flexDirection: 'row', alignItems: 'center', gap: 17, marginBottom: 22 }, thumb: { width: 112, borderRadius: 12 }, title: { fontSize: 21 }, byline: { color: colors.muted, fontSize: 14, marginTop: 3 }, price: { fontSize: 21, marginTop: 7 }, label: { fontSize: 17, marginTop: 19, marginBottom: 10 },
  textArea: { minHeight: 160, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 }, multiline: { flex: 1, textAlignVertical: 'top', fontFamily: font.regular, color: colors.ink, fontSize: 14 }, counter: { alignSelf: 'flex-end', color: colors.muted, fontSize: 12 }, select: { minHeight: 58, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, demoNote: { color: colors.muted, fontSize: 11, marginTop: 14 }, missing: { flex: 1, padding: contentPadding, justifyContent: 'center' },
});
