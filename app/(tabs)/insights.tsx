/**
 * Insights tab — lag-aware pattern findings + descriptive stats.
 * Medical-safety: observation language only; disclaimer always visible.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { TrendingUp, Sparkles, Download, RefreshCw } from 'lucide-react-native';
import { useInsights, useRecomputeInsights } from '../../src/hooks/useInsights';
import { DisclaimerBanner } from '../../src/components/insights/DisclaimerBanner';
import { InsightCard } from '../../src/components/insights/InsightCard';
import { StatCard } from '../../src/components/insights/StatCard';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

const MIN_DAYS_FOR_INSIGHTS = 14;

export default function InsightsScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { data, isLoading, refetch, isRefetching } = useInsights();
  const recompute = useRecomputeInsights();
  const [confidenceFilter, setConfidenceFilter] = useState<'All' | 'High' | 'Medium'>('All');

  const daysOfData = data?.daysOfData ?? 0;
  const hasEnoughData = daysOfData >= MIN_DAYS_FOR_INSIGHTS;

  const allInsights = data?.insights ?? [];
  const filteredInsights = confidenceFilter === 'All'
    ? allInsights
    : allInsights.filter(i => i.confidence === confidenceFilter);

  const handleRecompute = () => {
    recompute.mutate(undefined, {
      onSuccess: () => refetch(),
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Insights</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={() => router.push('/reports')}
          accessibilityRole="button"
          accessibilityLabel="Export report"
        >
          <Download size={14} color={palette.primary} strokeWidth={2.4} />
          <Text style={styles.exportBtnText}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.primary} />}
      >
        <DisclaimerBanner />

        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator color={palette.primary} size="large" />
            <Text style={styles.loadingText}>Analysing your data…</Text>
          </View>
        )}

        {!isLoading && !hasEnoughData && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <View style={styles.emptyIconBadge}>
                <TrendingUp size={36} color={palette.primary} strokeWidth={2.4} />
              </View>
              <View style={styles.sparkleBadge}>
                <Sparkles size={12} color="#F59E0B" strokeWidth={2.4} />
              </View>
            </View>
            <Text style={styles.emptyTitle}>Building your picture</Text>
            <Text style={styles.emptyBody}>
              Insights appear after {MIN_DAYS_FOR_INSIGHTS} days of logging.
              You have <Text style={styles.bold}>{daysOfData} day{daysOfData !== 1 ? 's' : ''}</Text> so far.
              Keep logging — the more you track, the better the patterns.
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min((daysOfData / MIN_DAYS_FOR_INSIGHTS) * 100, 100)}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{daysOfData} / {MIN_DAYS_FOR_INSIGHTS} days</Text>
          </View>
        )}

        {!isLoading && hasEnoughData && (
          <>
            {/* Descriptive stats grid */}
            {(data?.stats?.length ?? 0) > 0 && (
              <>
                <Text style={styles.sectionLabel}>At a glance</Text>
                <View style={styles.statsGrid}>
                  {(data!.stats ?? []).map(stat => (
                    <StatCard
                      key={stat.key}
                      icon={stat.icon}
                      title={stat.title}
                      value={stat.value}
                      sub={stat.sub}
                      trend={stat.trend}
                      trendGoodDirection={stat.trendGoodDirection}
                      sparkValues={stat.sparkValues}
                      accentColor={stat.accentColor}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Pattern findings */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Observed patterns</Text>
              <Text style={styles.sectionSub}>{allInsights.length} found</Text>
            </View>

            {allInsights.length > 1 && (
              <View style={styles.filterRow}>
                {(['All', 'High', 'Medium'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, confidenceFilter === f && styles.filterChipActive]}
                    onPress={() => setConfidenceFilter(f)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: confidenceFilter === f }}
                  >
                    <Text style={[styles.filterText, confidenceFilter === f && styles.filterTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {filteredInsights.length === 0 ? (
              <View style={styles.noInsights}>
                <Text style={styles.noInsightsText}>
                  {allInsights.length === 0
                    ? 'No patterns found yet. Keep logging for a few more days.'
                    : `No ${confidenceFilter.toLowerCase()} confidence patterns found.`}
                </Text>
              </View>
            ) : (
              filteredInsights.map(insight => (
                <InsightCard key={insight._id} insight={insight} />
              ))
            )}

            {/* Recompute */}
            <View style={styles.recomputeSection}>
              {data?.lastComputedAt && (
                <Text style={styles.recomputeMeta}>
                  Last analysed: {new Date(data.lastComputedAt).toLocaleDateString()}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.recomputeBtn, recompute.isPending && styles.dim]}
                onPress={handleRecompute}
                disabled={recompute.isPending}
                accessibilityRole="button"
              >
                {recompute.isPending
                  ? <ActivityIndicator size="small" color={palette.primary} />
                  : <>
                      <RefreshCw size={15} color={palette.primary} strokeWidth={2.2} />
                      <Text style={styles.recomputeText}>Reanalyse now</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  safe: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  heading: { ...typography.h2, color: palette.text },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  exportBtnText: { ...typography.small, color: palette.primary, fontWeight: '700' },
  scroll: { padding: 16, gap: 12, paddingBottom: 125 },
  center: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { ...typography.body, color: palette.textSecondary },
  emptyState: { backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 24, gap: 10, alignItems: 'center' },
  emptyIconContainer: {
    position: 'relative',
    marginTop: 4,
    marginBottom: 4,
  },
  emptyIconBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: palette.primary + '14',
    borderWidth: 1.5,
    borderColor: palette.primary + '2B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  sparkleBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyTitle: { ...typography.h4, color: palette.text },
  emptyBody: { ...typography.body, color: palette.textSecondary, textAlign: 'center', lineHeight: 22 },
  bold: { fontWeight: '700', color: palette.text },
  progressTrack: { width: '100%', height: 8, backgroundColor: palette.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: palette.primary, borderRadius: 4 },
  progressLabel: { ...typography.caption, color: palette.textDisabled },
  sectionLabel: { ...typography.label, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionSub: { ...typography.small, color: palette.textDisabled },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: palette.border, backgroundColor: palette.surface },
  filterChipActive: { borderColor: palette.primary, backgroundColor: palette.primary + '14' },
  filterText: { ...typography.small, color: palette.textSecondary, fontWeight: '600' },
  filterTextActive: { color: palette.primary },
  noInsights: { backgroundColor: palette.surfaceAlt, borderRadius: 12, padding: 16, alignItems: 'center' },
  noInsightsText: { ...typography.body, color: palette.textSecondary, textAlign: 'center' },
  recomputeSection: { alignItems: 'center', gap: 6, marginTop: 8 },
  recomputeMeta: { ...typography.caption, color: palette.textDisabled },
  recomputeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 20, paddingVertical: 10 },
  recomputeText: { ...typography.body, color: palette.primary },
  dim: { opacity: 0.5 },
}));
