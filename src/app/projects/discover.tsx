import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding, font } from '@/constants/theme';
import { formatPeso } from '@/data/fixtures';
import { ProjectPost, useSession } from '@/context/session.remote';

export default function DiscoverProjectsScreen() {
  const { projectPosts } = useSession();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const categories = useMemo(() => ['All', ...Array.from(new Set(projectPosts.filter((item) => item.status === 'open').map((item) => item.category)))], [projectPosts]);
  const normalizedQuery = query.trim().toLowerCase();
  const visible = useMemo(() => projectPosts.filter((item) => {
    if (item.status !== 'open' || (category !== 'All' && item.category !== category)) return false;
    const haystack = `${item.title} ${item.description} ${item.category} ${item.skills.join(' ')}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  }), [category, normalizedQuery, projectPosts]);
  const renderItem = useCallback(({ item }: { item: ProjectPost }) => <PostRow post={item} />, []);
  return <MobilePage><StatusBar style="light" /><AppHeader title="Discover Projects" onBack={() => router.back()} />
    <View style={styles.search}><Ionicons name="search" size={20} color={colors.muted} /><TextInput accessibilityLabel="Search projects" value={query} onChangeText={setQuery} placeholder="Search title, category, or skill" placeholderTextColor={colors.muted} style={styles.input} /></View>
    <View style={styles.filterRow}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipActive]}><AppText weight="medium" style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</AppText></Pressable>)}</ScrollView></View>
    <FlatList data={visible} keyExtractor={postKeyExtractor} renderItem={renderItem} initialNumToRender={6} maxToRenderPerBatch={6} windowSize={5} removeClippedSubviews={Platform.OS === 'android'} contentContainerStyle={styles.list} ListEmptyComponent={DiscoverEmptyState} />
  </MobilePage>;
}

function postKeyExtractor(item: ProjectPost) {
  return item.id;
}

function DiscoverEmptyState() {
  return <View style={styles.empty}><Ionicons name="search-circle-outline" size={55} color={colors.muted} /><AppText weight="semibold" style={styles.emptyTitle}>No matching open projects</AppText><AppText style={styles.emptyText}>Try a different search or category.</AppText></View>;
}

const PostRow = memo(function PostRow({ post }: { post: ProjectPost }) { return <Pressable onPress={() => router.push({ pathname: '/project-posts/[postId]', params: { postId: post.id } })} style={styles.row}><View style={styles.icon}><Ionicons name="document-text" size={26} color={colors.red} /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={styles.title}>{post.title}</AppText><AppText style={styles.description} numberOfLines={2}>{post.description}</AppText><View style={styles.meta}><AppText weight="semibold">{formatPeso(post.budget)}</AppText><AppText style={styles.deadline}>Due {post.deadline}</AppText></View><View style={styles.skills}>{post.skills.slice(0, 3).map((skill) => <View key={skill} style={styles.skill}><AppText style={styles.skillText}>{skill}</AppText></View>)}</View></View><Ionicons name="chevron-forward" size={21} color={colors.muted} /></Pressable>; });

const styles = StyleSheet.create({
  search: { marginHorizontal: contentPadding, marginTop: 14, height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 }, input: { flex: 1, fontFamily: font.regular, color: colors.ink },
  filterRow: { height: 54, flexGrow: 0, flexShrink: 0 }, filters: { paddingHorizontal: contentPadding, paddingVertical: 12, gap: 8, alignItems: 'center' }, chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 7 }, chipActive: { backgroundColor: colors.red, borderColor: colors.red }, chipText: { fontSize: 10, color: colors.muted }, chipTextActive: { color: colors.white },
  list: { flexGrow: 1, paddingHorizontal: contentPadding, paddingBottom: 28 }, row: { flexDirection: 'row', gap: 12, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' }, icon: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 15 }, description: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }, meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }, deadline: { color: colors.muted, fontSize: 9 }, skills: { flexDirection: 'row', gap: 5, marginTop: 7, flexWrap: 'wrap' }, skill: { backgroundColor: colors.blush, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }, skillText: { color: colors.burgundy, fontSize: 8 }, empty: { alignItems: 'center', paddingTop: 80 }, emptyTitle: { marginTop: 12 }, emptyText: { color: colors.muted, fontSize: 11, marginTop: 4 },
});
