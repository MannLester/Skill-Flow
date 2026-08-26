import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BottomNav, MobilePage, ReferenceCrop } from '@/components/ui';
import { colors, font, shadow } from '@/constants/theme';
import { formatPeso, Service } from '@/data/fixtures';
import { useSession } from '@/context/session';

const marketReference = require('../../references/student_marketplace_page.jpg');
export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const { currentAccount, homeRoute, services, savedServiceIds, toggleSavedService } = useSession();
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [maximumBudget, setMaximumBudget] = useState(0);
  const [minimumRating, setMinimumRating] = useState(0);
  const [maximumDelivery, setMaximumDelivery] = useState(0);
  const [savedOnly, setSavedOnly] = useState(saved === 'true');
  const categories = ['All', ...Array.from(new Set(services.filter((service) => service.status === 'published').map((service) => service.category)))];
  const filtered = useMemo(() => services.filter((service) => {
    const term = query.trim().toLowerCase();
    const matchesTerm = `${service.title} ${service.subtitle} ${service.provider} ${service.category}`.toLowerCase().includes(term);
    return service.status === 'published' && (category === 'All' || service.category === category) && matchesTerm && (!maximumBudget || service.price <= maximumBudget) && (!minimumRating || service.rating >= minimumRating) && (!maximumDelivery || service.deliveryDays <= maximumDelivery) && (!savedOnly || savedServiceIds.includes(service.id));
  }), [category, maximumBudget, maximumDelivery, minimumRating, query, savedOnly, savedServiceIds, services]);
  const clearFilters = () => { setCategory('All'); setMaximumBudget(0); setMinimumRating(0); setMaximumDelivery(0); setSavedOnly(false); };

  return (
    <MobilePage>
      <StatusBar style="light" />
      <MarketplaceHeader insetsTop={insets.top} query={query} filtersOpen={filtersOpen} onQueryChange={setQuery} onToggleFilters={() => setFiltersOpen((value) => !value)} />
      <MarketplaceFilters open={filtersOpen} maximumBudget={maximumBudget} minimumRating={minimumRating} maximumDelivery={maximumDelivery} savedOnly={savedOnly} onBudgetChange={setMaximumBudget} onRatingChange={setMinimumRating} onDeliveryChange={setMaximumDelivery} onSavedOnlyChange={setSavedOnly} onClear={clearFilters} />
      <MarketplaceCategories categories={categories} category={category} onCategoryChange={setCategory} />
      <MarketplaceList filtered={filtered} savedOnly={savedOnly} savedServiceIds={savedServiceIds} onToggleFavorite={toggleSavedService} />
      <MarketplaceBottomNav savedOnly={savedOnly} homeRoute={homeRoute} currentAccountRole={currentAccount?.role} />
    </MobilePage>
  );
}

function MarketplaceHeader({ insetsTop, query, filtersOpen, onQueryChange, onToggleFilters }: { insetsTop: number; query: string; filtersOpen: boolean; onQueryChange: (value: string) => void; onToggleFilters: () => void }) {
  return <View style={[styles.header, { paddingTop: insetsTop + 8 }]}>
    <View style={styles.titleRow}><Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push('/settings')}><Ionicons name="menu" size={30} color={colors.white} /></Pressable><AppText weight="semibold" style={styles.title}>Marketplace</AppText><View style={{ width: 30 }} /></View>
    <View style={styles.searchRow}>
      <View style={styles.search}><Ionicons name="search-outline" size={22} color={colors.muted} /><TextInput accessibilityLabel="Search marketplace services" value={query} onChangeText={onQueryChange} placeholder="Search services…" placeholderTextColor="#858585" style={styles.searchInput} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open marketplace filters" onPress={onToggleFilters} style={[styles.filter, filtersOpen && styles.filterActive]}><Ionicons name="filter-outline" size={25} color={filtersOpen ? colors.white : colors.burgundy} /></Pressable>
    </View>
  </View>;
}

function MarketplaceFilters({ open, maximumBudget, minimumRating, maximumDelivery, savedOnly, onBudgetChange, onRatingChange, onDeliveryChange, onSavedOnlyChange, onClear }: { open: boolean; maximumBudget: number; minimumRating: number; maximumDelivery: number; savedOnly: boolean; onBudgetChange: (value: number) => void; onRatingChange: (value: number) => void; onDeliveryChange: (value: number) => void; onSavedOnlyChange: (value: boolean | ((current: boolean) => boolean)) => void; onClear: () => void }) {
  if (!open) return null;
  return <View style={styles.filterPanel}><View style={styles.filterHeading}><AppText weight="semibold">Filters</AppText><Pressable onPress={onClear}><AppText weight="medium" style={styles.clear}>Clear all</AppText></Pressable></View><FilterRow label="Budget" values={[{ label: 'Any', value: 0 }, { label: 'Up to ₱1,000', value: 1000 }, { label: 'Up to ₱1,500', value: 1500 }]} selected={maximumBudget} onSelect={onBudgetChange} /><FilterRow label="Rating" values={[{ label: 'Any', value: 0 }, { label: '4.8+', value: 4.8 }, { label: '4.9+', value: 4.9 }]} selected={minimumRating} onSelect={onRatingChange} /><FilterRow label="Delivery" values={[{ label: 'Any', value: 0 }, { label: '3 days', value: 3 }, { label: '5 days', value: 5 }]} selected={maximumDelivery} onSelect={onDeliveryChange} /><Pressable onPress={() => onSavedOnlyChange((value) => !value)} style={[styles.savedFilter, savedOnly && styles.optionActive]}><Ionicons name={savedOnly ? 'heart' : 'heart-outline'} size={18} color={savedOnly ? colors.white : colors.burgundy} /><AppText weight="medium" style={[styles.optionText, savedOnly && { color: colors.white }]}>Saved services only</AppText></Pressable></View>;
}

function MarketplaceCategories({ categories, category, onCategoryChange }: { categories: string[]; category: string; onCategoryChange: (value: string) => void }) {
  return <View style={styles.categories}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContent}>{categories.map((item) => <Pressable key={item} onPress={() => onCategoryChange(item)} style={[styles.chip, category === item && styles.chipActive]}><AppText weight="medium" style={[styles.chipText, category === item && { color: colors.white }]}>{item}</AppText></Pressable>)}</ScrollView></View>;
}

function MarketplaceList({ filtered, savedOnly, savedServiceIds, onToggleFavorite }: { filtered: Service[]; savedOnly: boolean; savedServiceIds: string[]; onToggleFavorite: (serviceId: string) => void }) {
  return <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={({ item }) => <ServiceRow service={item} favorite={savedServiceIds.includes(item.id)} onToggleFavorite={() => onToggleFavorite(item.id)} />} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} ListHeaderComponent={<AppText style={styles.results}>{filtered.length} service{filtered.length === 1 ? '' : 's'} found</AppText>} ListEmptyComponent={<AppText style={styles.empty}>{savedOnly ? 'No saved services match these filters.' : 'No matching services.'}</AppText>} />;
}

function MarketplaceBottomNav({ savedOnly, homeRoute, currentAccountRole }: { savedOnly: boolean; homeRoute: '/student-home' | '/client-home'; currentAccountRole?: 'student' | 'client' }) {
  return <BottomNav active={savedOnly ? 'saved' : 'none'} onHome={() => router.replace(homeRoute)} onProjects={() => router.push('/projects')} onMessages={() => router.push('/messages')} onCreate={currentAccountRole === 'student' ? () => router.push('/services/new') : () => router.push('/project-posts/new')} onProfile={() => router.push('/profile')} variant="marketplace" />;
}

function ServiceRow({ service, favorite, onToggleFavorite }: { service: Service; favorite: boolean; onToggleFavorite: () => void }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/services/[serviceId]', params: { serviceId: service.id } })} style={styles.serviceRow}>
      <ReferenceCrop source={marketReference} sourceSize={{ width: 1920, height: 1080 }} crop={service.crop} style={styles.thumb} />
      <View style={{ flex: 1 }}>
        <AppText weight="semibold" style={styles.serviceTitle}>{service.title}</AppText><AppText style={styles.serviceSubtitle}>{service.subtitle}</AppText><Pressable accessibilityRole="link" onPress={(event) => { event.stopPropagation(); router.push({ pathname: '/profiles/[userId]', params: { userId: service.providerId } }); }}><AppText weight="medium" style={styles.provider}>By {service.provider}</AppText></Pressable>
      </View>
      <View style={styles.serviceRight}><Pressable accessibilityRole="button" accessibilityLabel={favorite ? 'Remove from saved services' : 'Save service'} hitSlop={10} onPress={(event) => { event.stopPropagation(); onToggleFavorite(); }}><Ionicons name={favorite ? 'heart' : 'heart-outline'} size={25} color={favorite ? colors.red : '#777'} /></Pressable><View style={styles.rating}><Ionicons name="star" size={17} color={colors.gold} /><AppText style={{ fontSize: 12 }}>{service.rating} ({service.reviews})</AppText></View><AppText weight="semibold" style={{ fontSize: 12 }}>From {formatPeso(service.price)}</AppText></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.red, paddingHorizontal: 17, paddingBottom: 14 }, titleRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: colors.white, fontSize: 20 },
  searchRow: { flexDirection: 'row', gap: 9 }, search: { flex: 1, height: 50, borderRadius: 8, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13 }, searchInput: { flex: 1, fontFamily: font.regular, fontSize: 13, color: colors.ink }, filter: { width: 50, height: 50, borderRadius: 8, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, filterActive: { backgroundColor: colors.burgundy }, filterPanel: { paddingHorizontal: 17, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white, gap: 10 }, filterHeading: { flexDirection: 'row', justifyContent: 'space-between' }, clear: { color: colors.burgundy, fontSize: 11 }, filterLabel: { fontSize: 10, marginBottom: 5 }, options: { flexDirection: 'row', gap: 6 }, option: { flex: 1, minHeight: 34, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, optionActive: { backgroundColor: colors.red, borderColor: colors.red }, optionText: { fontSize: 9 }, savedFilter: { minHeight: 38, borderWidth: 1, borderColor: colors.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  categories: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border }, categoryContent: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 }, chip: { paddingHorizontal: 15, height: 38, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, chipActive: { backgroundColor: colors.red, ...shadow }, chipText: { fontSize: 12 },
  list: { paddingHorizontal: 17, paddingBottom: 22 }, results: { color: colors.muted, fontSize: 9, marginTop: 10 }, serviceRow: { minHeight: 145, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border }, thumb: { width: 82, borderRadius: 8 }, serviceTitle: { fontSize: 17 }, serviceSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 }, provider: { fontSize: 12, marginTop: 7, color: colors.burgundy }, serviceRight: { width: 105, alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 98 }, rating: { flexDirection: 'row', alignItems: 'center', gap: 5 }, empty: { textAlign: 'center', color: colors.muted, marginTop: 50 },
});

function FilterRow({ label, values, selected, onSelect }: { label: string; values: { label: string; value: number }[]; selected: number; onSelect: (value: number) => void }) { return <View><AppText weight="medium" style={styles.filterLabel}>{label}</AppText><View style={styles.options}>{values.map((item) => <Pressable key={item.label} onPress={() => onSelect(item.value)} style={[styles.option, selected === item.value && styles.optionActive]}><AppText style={[styles.optionText, selected === item.value && { color: colors.white }]}>{item.label}</AppText></Pressable>)}</View></View>; }
