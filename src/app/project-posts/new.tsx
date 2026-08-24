import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppHeader, MobilePage } from '@/components/ui';
import { ProjectPostForm } from '@/components/project-post-form';

export default function NewProjectPostScreen() { return <MobilePage><StatusBar style="light" /><AppHeader title="Post a Project" onBack={() => router.back()} /><ProjectPostForm /></MobilePage>; }
