import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppText, MobilePage, PrimaryButton, ReferenceCrop } from '@/components/ui';
import { colors, contentPadding, font } from '@/constants/theme';
import { formatPeso } from '@/data/fixtures';
import { useSession } from '@/context/session';

const marketReference = require('../../../../references/student_marketplace_page.jpg');

type SelectorKey = 'delivery' | 'budget';
type SelectorOption = { label: string; value: number };
type KeyboardActivationEvent = { key: string; preventDefault: () => void };
type KeyboardPressableProps = { onKeyDown?: (event: KeyboardActivationEvent) => void };

const activationKeys = new Set(['Enter', ' ', 'Spacebar']);

export default function BookServiceScreen() {
  const insets = useSafeAreaInsets();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { createBooking, currentAccount, services } = useSession();
  const service = services.find((item) => item.id === serviceId);
  const [description, setDescription] = useState('');
  const [deliveryDays, setDeliveryDays] = useState(service?.deliveryDays ?? 3);
  const [budget, setBudget] = useState(service?.price ?? 1500);
  const [openSelector, setOpenSelector] = useState<SelectorKey | null>(null);

  if (!service) return <MobilePage><StatusBar style="light" /><AppHeader title="Book Service" onBack={() => router.back()} /><View style={styles.missing}><AppText weight="semibold">Service not found.</AppText></View></MobilePage>;

  const toggleSelector = (selector: SelectorKey) => setOpenSelector((current) => current === selector ? null : selector);
  const chooseDelivery = (value: number) => { setDeliveryDays(value); setOpenSelector(null); };
  const chooseBudget = (value: number) => { setBudget(value); setOpenSelector(null); };
  const deliveryOptions = [3, 5, 7].map((value) => ({ value, label: `${value} Days` }));
  const budgetOptions = [service.price, service.price + 500, service.price + 1000].map((value) => ({ value, label: formatPeso(value) }));
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
          <AppText weight="semibold" style={styles.label}>Delivery Time</AppText>
          <SelectRow
            testID="delivery-selector"
            label="Delivery Time"
            value={`${deliveryDays} Days`}
            selectedValue={deliveryDays}
            options={deliveryOptions}
            isOpen={openSelector === 'delivery'}
            onToggle={() => toggleSelector('delivery')}
            onSelect={chooseDelivery}
          />
          <AppText weight="semibold" style={styles.label}>Budget</AppText>
          <SelectRow
            testID="budget-selector"
            label="Budget"
            value={formatPeso(budget)}
            selectedValue={budget}
            options={budgetOptions}
            isOpen={openSelector === 'budget'}
            onToggle={() => toggleSelector('budget')}
            onSelect={chooseBudget}
          />
          <AppText style={styles.demoNote}>Demo only — no real payment will be collected.</AppText>
          <PrimaryButton title="Send Request" onPress={submit} style={{ marginTop: 18 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </MobilePage>
  );
}

function SelectRow({ testID, label, value, selectedValue, options, isOpen, onToggle, onSelect }: {
  testID: string;
  label: string;
  value: string;
  selectedValue: number;
  options: readonly SelectorOption[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: number) => void;
}) {
  const triggerRef = useRef<ComponentRef<typeof Pressable>>(null);
  const pendingFocus = useRef(false);

  const focusTrigger = () => {
    if (Platform.OS !== 'web') return;
    const trigger = triggerRef.current;
    if (trigger && 'focus' in trigger && typeof trigger.focus === 'function') trigger.focus();
  };
  useEffect(() => {
    if (!isOpen && pendingFocus.current) {
      pendingFocus.current = false;
      focusTrigger();
    }
  }, [isOpen]);
  const closeSelector = (restoreFocus: boolean) => {
    if (restoreFocus) pendingFocus.current = true;
    onToggle();
  };
  const handleOptionKeyDown = (event: KeyboardActivationEvent, option: SelectorOption) => {
    if (!activationKeys.has(event.key)) return;
    event.preventDefault();
    pendingFocus.current = true;
    onSelect(option.value);
  };
  const handleCloseKeyDown = (event: KeyboardActivationEvent) => {
    if (!activationKeys.has(event.key)) return;
    event.preventDefault();
    closeSelector(true);
  };

  return (
    <View style={styles.selectorGroup}>
      <Pressable
        ref={triggerRef}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityValue={{ text: value }}
        accessibilityState={{ expanded: isOpen }}
        aria-expanded={isOpen}
        onPress={onToggle}
        style={[styles.select, isOpen && styles.selectOpen]}
      >
        <AppText weight="medium" style={{ fontSize: 15 }}>{value}</AppText>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={23} color={colors.ink} />
      </Pressable>
      {isOpen ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={`${label} options`} style={styles.optionList}>
          {options.map((option) => {
            const selected = option.value === selectedValue;
            return (
              <Pressable
                key={option.value}
                testID={`${testID}-option-${option.value}`}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                {...(Platform.OS === 'web' ? { onKeyDown: (event: KeyboardActivationEvent) => handleOptionKeyDown(event, option) } satisfies KeyboardPressableProps : {})}
                onPress={() => onSelect(option.value)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <AppText weight={selected ? 'semibold' : 'regular'}>{option.label}</AppText>
                <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={colors.burgundy} />
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${label} options`}
            {...(Platform.OS === 'web' ? { onKeyDown: handleCloseKeyDown } satisfies KeyboardPressableProps : {})}
            onPress={() => closeSelector(false)}
            style={styles.closeOptions}
          >
            <AppText weight="medium" style={styles.closeOptionsText}>Close</AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: contentPadding }, summary: { flexDirection: 'row', alignItems: 'center', gap: 17, marginBottom: 22 }, thumb: { width: 112, borderRadius: 12 }, title: { fontSize: 21 }, byline: { color: colors.muted, fontSize: 14, marginTop: 3 }, price: { fontSize: 21, marginTop: 7 }, label: { fontSize: 17, marginTop: 19, marginBottom: 10 },
  textArea: { minHeight: 160, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 }, multiline: { flex: 1, textAlignVertical: 'top', fontFamily: font.regular, color: colors.ink, fontSize: 14 }, counter: { alignSelf: 'flex-end', color: colors.muted, fontSize: 12 }, selectorGroup: { gap: 8 }, select: { minHeight: 58, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, selectOpen: { borderColor: colors.red, backgroundColor: colors.blush }, optionList: { borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 6, gap: 4, backgroundColor: colors.white }, option: { minHeight: 48, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, optionSelected: { backgroundColor: colors.blush }, closeOptions: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 12 }, closeOptionsText: { color: colors.burgundy, fontSize: 13 }, demoNote: { color: colors.muted, fontSize: 11, marginTop: 14 }, missing: { flex: 1, padding: contentPadding, justifyContent: 'center' },
});
