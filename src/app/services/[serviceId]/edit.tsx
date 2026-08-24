import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, MobilePage } from '@/components/ui';
import { ServiceForm } from '@/components/service-form';

export default function EditServiceScreen() { const { serviceId } = useLocalSearchParams<{ serviceId: string }>(); return <MobilePage><StatusBar style="light" /><AppHeader title="Edit Service" onBack={() => router.back()} /><ServiceForm serviceId={serviceId} /></MobilePage>; }
