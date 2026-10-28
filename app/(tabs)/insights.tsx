/**
 * Insights tab: patterns found in the member's own logs, plus descriptive stats.
 * At most three patterns are shown at a time, with the counts behind each one.
 * Medical-safety: observation language only; the disclaimer and a "not a cause" line are always visible.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrendingUp, Sparkles, Download, RefreshCw } from 'lucide-react-native';
import { useInsights, useRecomputeInsights, InsightFinding } from '../../src/hooks/useInsights';
import { useProgress } from '../../src/hooks/useProgress';
import { useWarning } from '../../src/hooks/useWarning';
import { useExperiments, useStartExperiment } from '../../src/hooks/useExperiments';
import { useAuthStore } from '../../src/store/authStore';
import { DisclaimerBanner } from '../../src/components/insights/DisclaimerBanner';
import { InsightCard } from '../../src/components/insights/InsightCard';
import { StatCard } from '../../src/components/insights/StatCard';
import { ProgressCard } from '../../src/components/insights/ProgressCard';
import { WarningCard } from '../../src/components/insights/WarningCard';
import { ExperimentCard } from '../../src/components/insights/ExperimentCard';
import { CompareSection } from '../../src/components/insights/CompareSection';
import { AskLumenBox } from '../../src/components/insights/AskLumenBox';
import { progressText } from '../../src/services/insights/insightCopy';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { FilterChip } from '../../src/components/ios/FilterChip';
import { TAB_BAR_CLEARANCE } from '../../src/components/ios/iosTheme';

const MIN_DAYS_FOR_STATS = 14;
/** One tired glance should be enough, so only this many patterns show before "See more". */
const VISIBLE_AT_FIRST = 3;
export const HIDDEN_FINDINGS_KEY = 'lumen:insight_hidden_v1';

type TierFilter = 'All' | 'Consistent' | 'Possible';

export default function InsightsScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { data, isLoading, refetch, isRefetching } = useInsights();
  const { data: progressData } = useProgress();
  const { data: warningData } = useWarning();
  const { data: experiments } = useExperiments();
  const startExperiment = useStartExperiment();
  const aiExplanationsEnabled = !!useAuthStore(s => s.user?.preferences?.aiExplanations);
  const recompute = useRecomputeInsights();
  const [tierFilter, setTierFilter] = useState<TierFilter>('All');
  const [showAll, setShowAll] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(HIDDEN_FINDINGS_KEY)
      .then(raw => { if (raw) setHidden(JSON.parse(raw) as string[]); })
      .catch(() => {});
  }, []);

  const dismiss = useCallback((finding: InsightFinding) => {
    setHidden(prev => {
      const next = prev.includes(finding.id) ? prev : [...prev, finding.id];
      AsyncStorage.setItem(HIDDEN_FINDINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const activeExperiment = (experiments ?? []).find(e => e.status === 'active');
  const mostRecentExperiment = activeExperiment ?? (experiments ?? [])[0];

  const testIt = useCallback((finding: InsightFinding) => {
    Alert.alert(
      'Test it for 6 weeks?',
      `Lumen will randomly schedule six 7-day blocks — three with ${finding.exposure.optionLabel}, three without — in an order it won't tell you in advance. Keep logging as usual; the schedule stays private so it can't bias what you report.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => startExperiment.mutate({
            exposureKey: finding.exposureKey, exposureLabel: finding.exposure.optionLabel,
            outcomeKey: finding.outcomeKey, outcomeLabel: finding.outcome.optionLabel,
          }, {
            onError: (err) => Alert.alert('Could not start', err instanceof Error ? err.message : 'Please try again.'),
          }),
        },
      ],
    );
  }, [startExperiment]);

  const daysOfData = data?.daysOfData ?? 0;
  const progress = data?.progress ?? { observedDays: 0, daysNeeded: 30 };
  const buildingUp = progress.observedDays < progress.daysNeeded;

  const all = (data?.findings ?? []).filter(f => !hidden.includes(f.id));
  const current = all.filter(f => !f.noLongerSeen);
  const earlier = all.filter(f => f.noLongerSeen);
  const filtered = current.filter(f => tierFilter === 'All' || (tierFilter === 'Consistent' ? f.tier === 'consistent' : f.tier === 'possible'));
  const shown = showAll ? filtered : filtered.slice(0, VISIBLE_AT_FIRST);
  const hiddenCount = filtered.length - shown.length;
  const empty = progressText(progress.observedDays, progress.daysNeeded);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.primary} />}
      >
        <View style={styles.flush}>
          <LargeTitleHeader
            title="Insights"
            subtitle="Patterns from your own logs. They show what tends to happen together, not what causes what."
            actions={
              <GlassCircleButton accessibilityLabel="Export report" onPress={() => router.push('/reports')}>
                <Download size={20} color={palette.text} strokeWidth={2.2} />
              </GlassCircleButton>
            }
          />
        </View>

        <DisclaimerBanner />

        {!isLoading && warningData?.ready && <WarningCard warning={warningData} />}

        {!isLoading && mostRecentExperiment && <ExperimentCard experiment={mostRecentExperiment} />}

        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator color={palette.primaryText} size="large" />
            <Text style={styles.loadingText}>Analysing your data…</Text>
          </View>
        )}

        {!isLoading && buildingUp && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <View style={styles.emptyIconBadge}>
                <TrendingUp size={36} color={palette.primaryText} strokeWidth={2.4} />
              </View>
              <View style={styles.sparkleBadge}>
                <Sparkles size={12} color="#F59E0B" strokeWidth={2.4} />
              </View>
            </View>
            <Text style={styles.emptyTitle}>{empty.title}</Text>
            <Text style={styles.emptyBody}>{empty.body}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min((progress.observedDays / progress.daysNeeded) * 100, 100)}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{progress.observedDays} / {progress.daysNeeded} logged days</Text>
          </View>
        )}

        {!isLoading && daysOfData >= MIN_DAYS_FOR_STATS && (data?.stats?.length ?? 0) > 0 && (
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

        {!isLoading && !buildingUp && progressData && <ProgressCard progress={progressData} />}

        {!isLoading && (current.length > 0 || !buildingUp) && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Patterns in your logs</Text>
              <Text style={styles.sectionSub}>{current.length} {current.length === 1 ? 'pattern' : 'patterns'}</Text>
            </View>

            {current.length > 1 && (
              <View style={styles.filterRow}>
                {(['All', 'Consistent', 'Possible'] as const).map(f => (
                  <FilterChip
                    key={f}
                    label={f}
                    selected={tierFilter === f}
                    onPress={() => { setTierFilter(f); setShowAll(false); }}
                  />
                ))}
              </View>
            )}

            {current.length === 0 ? (
              <View style={styles.noInsights}>
                <Text style={styles.noInsightsTitle}>{empty.title}</Text>
                <Text style={styles.noInsightsText}>{empty.body}</Text>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.noInsights}>
                <Text style={styles.noInsightsText}>No {tierFilter.toLowerCase()} patterns right now.</Text>
              </View>
            ) : (
              shown.map(f => (
                <InsightCard
                  key={f.id}
                  finding={f}
                  onDismiss={dismiss}
                  onTestIt={testIt}
                  testItDisabled={!!activeExperiment}
                  aiExplanationsEnabled={aiExplanationsEnabled}
                />
              ))
            )}

            {hiddenCount > 0 && (
              <TouchableOpacity style={styles.moreBtn} onPress={() => setShowAll(true)} accessibilityRole="button">
                <Text style={styles.moreText}>See {hiddenCount} more</Text>
              </TouchableOpacity>
            )}
            {showAll && filtered.length > VISIBLE_AT_FIRST && (
              <TouchableOpacity style={styles.moreBtn} onPress={() => setShowAll(false)} accessibilityRole="button">
                <Text style={styles.moreText}>Show fewer</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {!isLoading && earlier.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.earlierHeader}
              onPress={() => setShowEarlier(v => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showEarlier }}
            >
              <Text style={styles.sectionLabel}>Not seen lately</Text>
              <Text style={styles.sectionSub}>{earlier.length} · {showEarlier ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
            {showEarlier && earlier.map(f => (
              <InsightCard key={f.id} finding={f} onDismiss={dismiss} aiExplanationsEnabled={aiExplanationsEnabled} />
            ))}
          </>
        )}

        {!isLoading && !buildingUp && <CompareSection />}

        {aiExplanationsEnabled && <AskLumenBox />}

        {!isLoading && (
          <View style={styles.recomputeSection}>
            {data?.lastComputedAt && (
              <Text style={styles.recomputeMeta}>
                Last analysed: {new Date(data.lastComputedAt).toLocaleDateString()}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.recomputeBtn, recompute.isPending && styles.dim]}
              onPress={() => recompute.mutate(undefined, { onSuccess: () => refetch() })}
              disabled={recompute.isPending}
              accessibilityRole="button"
            >
              {recompute.isPending
                ? <ActivityIndicator size="small" color={palette.primaryText} />
                : <>
                    <RefreshCw size={15} color={palette.primaryText} strokeWidth={2.2} />
                    <Text style={styles.recomputeText}>Reanalyse now</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  safe: { flex: 1, backgroundColor: palette.background },
  scroll: { paddingHorizontal: 16, paddingTop: 6, gap: 14, paddingBottom: TAB_BAR_CLEARANCE },
  flush: { marginHorizontal: -16 },
  center: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { ...typography.body, color: palette.textSecondary },
  emptyState: { backgroundColor: palette.surface, borderRadius: 26, padding: 24, gap: 10, alignItems: 'center' },
  emptyIconContainer: { position: 'relative', marginTop: 4, marginBottom: 4 },
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
  progressTrack: { width: '100%', height: 8, backgroundColor: palette.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: palette.primary, borderRadius: 4 },
  progressLabel: { ...typography.caption, color: palette.textDisabled },
  sectionLabel: { ...typography.title2, color: palette.text, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionSub: { ...typography.footnote, color: palette.textSecondary },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  noInsights: { backgroundColor: palette.surface, borderRadius: 26, padding: 18, gap: 6, alignItems: 'center' },
  noInsightsTitle: { ...typography.headline, color: palette.text },
  noInsightsText: { ...typography.body, color: palette.textSecondary, textAlign: 'center', lineHeight: 22 },
  moreBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  moreText: { ...typography.body, color: palette.primaryText },
  earlierHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', minHeight: 44 },
  recomputeSection: { alignItems: 'center', gap: 6, marginTop: 8 },
  recomputeMeta: { ...typography.footnote, color: palette.textSecondary },
  recomputeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.surface, borderRadius: 22, paddingHorizontal: 20, minHeight: 44 },
  recomputeText: { ...typography.body, color: palette.primaryText },
  dim: { opacity: 0.5 },
}));
