import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppHeader, AppText, MobilePage } from '@/components/ui';
import { colors, contentPadding, shadow } from '@/constants/theme';
import { formatPeso } from '@/data/fixtures';
import { DemoLedgerEntry, ProjectBooking, useSession } from '@/context/session.remote';

export function buildBookingIndex(bookings: ProjectBooking[]) {
  return new Map(bookings.map((booking) => [booking.id, booking]));
}

export function summarizeLedgerEntries(entries: DemoLedgerEntry[]) {
  return entries.reduce((summary, entry) => {
    if (entry.type === 'hold') summary.holds += entry.amount;
    else summary.releases += entry.amount;
    return summary;
  }, { holds: 0, releases: 0 });
}

function ledgerKeyExtractor(item: DemoLedgerEntry) {
  return item.id;
}

function WalletEmptyState() {
  return <View style={styles.empty}><Ionicons name="wallet-outline" size={50} color={colors.muted} /><AppText weight="semibold" style={{ marginTop: 11 }}>No demo transactions yet</AppText><AppText style={styles.detail}>Funding and approval events will create simulated cloud ledger entries.</AppText></View>;
}

export default function DemoWalletScreen() {
  const { bookings, currentAccount, ledger } = useSession();
  const accountId = currentAccount?.id;
  const entries = useMemo(() => accountId ? ledger.filter((item) => item.userId === accountId) : [], [accountId, ledger]);
  const { holds, releases } = useMemo(() => summarizeLedgerEntries(entries), [entries]);
  const bookingsById = useMemo(() => buildBookingIndex(bookings), [bookings]);
  const renderItem = useCallback(({ item }: { item: DemoLedgerEntry }) => <LedgerRow entry={item} projectTitle={bookingsById.get(item.projectId)?.title} />, [bookingsById]);
  return <MobilePage><StatusBar style="light" /><AppHeader title="Demo Wallet" onBack={() => router.back()} /><View style={styles.notice}><Ionicons name="flask-outline" size={22} color={colors.muted} /><AppText style={styles.noticeText}>Simulation only. No card, bank account, payment processor, escrow, or real money is connected.</AppText></View><View style={styles.summary}><Summary label="Demo funds reserved" value={holds} /><Summary label="Simulated earnings released" value={releases} /></View><AppText weight="semibold" style={styles.heading}>Local Ledger</AppText><FlatList data={entries} keyExtractor={ledgerKeyExtractor} contentContainerStyle={styles.list} renderItem={renderItem} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews={Platform.OS === 'android'} ListEmptyComponent={WalletEmptyState} /></MobilePage>;
}

const LedgerRow = memo(function LedgerRow({ entry, projectTitle }: { entry: DemoLedgerEntry; projectTitle?: string }) {
  return <Pressable onPress={() => router.push({ pathname: '/projects/[projectId]', params: { projectId: entry.projectId } })} style={styles.row}><View style={[styles.icon, entry.type === 'release' && { backgroundColor: colors.greenSoft }]}><Ionicons name={entry.type === 'hold' ? 'lock-closed-outline' : 'checkmark-circle-outline'} size={23} color={entry.type === 'hold' ? colors.red : colors.green} /></View><View style={{ flex: 1 }}><AppText weight="semibold">{entry.type === 'hold' ? 'Demo hold' : 'Simulated release'}</AppText><AppText style={styles.detail}>{projectTitle ?? 'Project'} · {new Date(entry.createdAt).toLocaleDateString()}</AppText></View><AppText weight="bold">{formatPeso(entry.amount)}</AppText></Pressable>;
});

function Summary({ label, value }: { label: string; value: number }) { return <View style={styles.summaryItem}><AppText weight="bold" style={styles.amount}>{formatPeso(value)}</AppText><AppText style={styles.summaryLabel}>{label}</AppText></View>; }
const styles = StyleSheet.create({ notice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, paddingVertical: 11, paddingHorizontal: contentPadding, marginBottom: 12 }, noticeText: { flex: 1, color: colors.muted, fontSize: 9, lineHeight: 15 }, summary: { flexDirection: 'row', gap: 12, paddingHorizontal: contentPadding }, summaryItem: { flex: 1, minHeight: 94, borderRadius: 13, padding: 16, justifyContent: 'center', backgroundColor: colors.white, ...shadow }, amount: { fontSize: 19 }, summaryLabel: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 5 }, heading: { fontSize: 17, marginHorizontal: contentPadding, marginTop: 20 }, list: { flexGrow: 1, paddingHorizontal: contentPadding, paddingBottom: 36 }, row: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }, icon: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush }, detail: { color: colors.muted, fontSize: 9, marginTop: 4, textAlign: 'center' }, empty: { alignItems: 'center', paddingTop: 65 } });
