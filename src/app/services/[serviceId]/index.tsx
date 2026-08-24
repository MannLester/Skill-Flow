import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, MobilePage, PrimaryButton, ReferenceCrop } from '@/components/ui';
import { colors, contentPadding } from '@/constants/theme';
import { formatPeso, Service } from '@/data/fixtures';
import { useSession } from '@/context/session';

const serviceReference = require('../../../../references/service_details_and_project_booking_page.jpg');
const marketReference = require('../../../../references/student_marketplace_page.jpg');

export default function ServiceDetailsScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { currentAccount, savedServiceIds, services, toggleSavedService } = useSession();
  const service = services.find((item) => item.id === serviceId);

  if (!service) {
    return <MobilePage><StatusBar style="light" /><AppHeader title="Service" onBack={() => router.back()} /><View style={styles.missing}><AppText weight="semibold">Service not found.</AppText><PrimaryButton title="Back to Marketplace" onPress={() => router.replace('/marketplace')} /></View></MobilePage>;
  }

  const favorite = savedServiceIds.includes(service.id);
  const requestService = () => {
    if (currentAccount?.role !== 'client') {
      Alert.alert('Client action', 'Switch to the Mark demo account to request a student service.');
      return;
    }
    router.push({ pathname: '/services/[serviceId]/request', params: { serviceId: service.id } });
  };

  return (
    <MobilePage>
      <StatusBar style="light" />
      <AppHeader title="" onBack={() => router.back()} right={<View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel={favorite ? 'Remove from saved services' : 'Save service'} onPress={() => toggleSavedService(service.id)}><Ionicons name={favorite ? 'heart' : 'heart-outline'} size={29} color={colors.white} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="More service actions" onPress={() => Alert.alert('Service actions', 'Sharing and reporting are simulated in this demo.')}><Ionicons name="ellipsis-vertical" size={25} color={colors.white} /></Pressable></View>} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ServiceArtwork service={service} />
        <View style={styles.content}>
          <View style={styles.titleRow}><AppText weight="bold" style={styles.title}>{service.title}</AppText><AppText weight="bold" style={styles.price}>{formatPeso(service.price)}</AppText></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${service.provider} profile`} onPress={() => router.push({ pathname: '/profiles/[userId]', params: { userId: service.providerId } })} style={styles.providerRow}>
            <View style={styles.avatar}><Ionicons name="person" size={29} color={colors.burgundy} /></View>
            <View style={{ flex: 1 }}><AppText weight="semibold" style={styles.provider}>by {service.provider}</AppText><AppText style={styles.role}>{service.category}</AppText></View>
            <Ionicons name="star" size={20} color={colors.gold} /><AppText style={{ fontSize: 14 }}>{service.rating} ({service.reviews})</AppText>
          </Pressable>
          <AppText style={styles.description}>{service.description}</AppText>
          <View style={styles.divider} />
          <View style={styles.features}>
            <Feature icon="alarm-outline" title={`${service.deliveryDays} Days`} detail="Delivery" />
            <Feature icon="refresh-outline" title={service.revisions} detail="Revisions" />
          </View>
          <PrimaryButton title="Request This Service" onPress={requestService} style={styles.button} />
        </View>
      </ScrollView>
    </MobilePage>
  );
}

function ServiceArtwork({ service }: { service: Service }) {
  if (service.id === 'logo') return <ReferenceCrop source={serviceReference} sourceSize={{ width: 1920, height: 1080 }} crop={{ x: 459, y: 129, width: 468, height: 294 }} style={styles.hero} />;
  return <View style={styles.altHero}><ReferenceCrop source={marketReference} sourceSize={{ width: 1920, height: 1080 }} crop={service.crop} style={styles.altArtwork} /></View>;
}

function Feature({ icon, title, detail }: { icon: 'alarm-outline' | 'refresh-outline'; title: string; detail: string }) {
  return <View style={styles.feature}><Ionicons name={icon} size={27} color={colors.burgundy} /><View><AppText weight="medium" style={{ fontSize: 14 }}>{title}</AppText><AppText weight="medium" style={{ fontSize: 14 }}>{detail}</AppText></View></View>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, scroll: { paddingBottom: 28 }, hero: { width: '100%' }, altHero: { height: 260, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, altArtwork: { width: 190, borderRadius: 18 }, content: { padding: contentPadding }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { fontSize: 25, flex: 1 }, price: { fontSize: 24 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 }, avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, provider: { fontSize: 16 }, role: { color: colors.muted, fontSize: 13, marginTop: 2 }, description: { fontSize: 15, lineHeight: 25, marginTop: 25 }, divider: { height: 1, backgroundColor: colors.border, marginVertical: 23 }, features: { flexDirection: 'row', justifyContent: 'space-between' }, feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, width: '46%' }, button: { marginTop: 38 }, missing: { flex: 1, padding: contentPadding, justifyContent: 'center', gap: 20 },
});
