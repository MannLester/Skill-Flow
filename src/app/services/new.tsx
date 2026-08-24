import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, MobilePage } from '@/components/ui';
import { ServiceForm } from '@/components/service-form';

export default function NewServiceScreen() { return <MobilePage><StatusBar style="light" /><AppHeader title="Create Service" onBack={() => router.back()} /><ServiceForm /></MobilePage>; }
