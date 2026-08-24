import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppHeader, MobilePage } from '@/components/ui';
import { ProjectPostForm } from '@/components/project-post-form';

export default function EditProjectPostScreen() { const { postId } = useLocalSearchParams<{ postId: string }>(); return <MobilePage><StatusBar style="light" /><AppHeader title="Edit Project" onBack={() => router.back()} /><ProjectPostForm postId={postId} /></MobilePage>; }
