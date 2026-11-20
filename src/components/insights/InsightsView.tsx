/**
 * Insights view: patterns found in the member's own logs, plus descriptive stats.
 * At most three patterns are shown at a time, with the counts behind each one.
 * Medical-safety: observation language only; the disclaimer and a "not a cause" line are always visible.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrendingUp, Sparkles, Download, RefreshCw } from 'lucide-react-native';
import { useInsights, useRecomputeInsights, InsightFinding } from '../../hooks/useInsights';
import { useProgress } from '../../hooks/useProgress';
import { useWarning } from '../../hooks/useWarning';
import { useExperiments, useStartExperiment } from '../../hooks/useExperiments';
import { useAuthStore } from '../../store/authStore';
import { DisclaimerBanner } from './DisclaimerBanner';
import { InsightCard } from './InsightCard';
import { StatCard } from './StatCard';
import { ProgressCard } from './ProgressCard';
import { WarningCard } from './WarningCard';
import { ExperimentCard } from './ExperimentCard';
import { CompareSection } from './CompareSection';
import { LumenAiCard } from './LumenAiCard';
import { useAskLumenAi } from '../../hooks/useAskLumenAi';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { LargeTitleHeader } from '../ios/LargeTitleHeader';
import { GlassCircleButton } from '../ios/GlassCircleButton';
import { FilterChip } from '../ios/FilterChip';
import { TAB_BAR_CLEARANCE } from '../ios/iosTheme';
import { IosSegmented } from '../ios/IosSegmented';
import { ExplorePane } from './ExplorePane';
import { MetricsPane } from './MetricsPane';
import { useQueryClient } from '@tanstack/react-query';

type Pane = 'overview' | 'explore' | 'metrics';
const PANES: Array<{ key: Pane; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'explore', label: 'Explore' },
  { key: 'metrics', label: 'Metrics' },
];

/** One tired glance should be enough, so only this many patterns show before "See more". */
const VISIBLE_AT_FIRST = 3;
export const HIDDEN_FINDINGS_KEY = 'lumen:insight_hidden_v1';

type TierFilter = 'All' | 'Consistent' | 'Possible';

export interface InsightsViewProps {
  hideHeader?: boolean;
}

export function InsightsView({ hideHeader = false }: InsightsViewProps) {
  const { palette } = useTheme();
  const styles = useStyles();
  const { data, isLoading, refetch, isRefetching } = useInsights();
  const { data: progressData } = useProgress();
  const { data: warningData } = useWarning();
  const { data: experiments } = useExperiments();
  const startExperiment = useStartExperiment();
  const aiExplanationsEnabled = !!useAuthStore(s => s.user?.preferences?.aiExplanations);
  const { ask, fullAccess: aiOn } = useAskLumenAi();
  const askPattern = useCallback((f: InsightFinding) => {
    ask({ kind: 'pattern', id: `${f.exposureKey}|${f.outcomeKey}|${f.lagDays}`, title: `${f.exposure.optionLabel} → ${f.outcome.optionLabel}` });
  }, [ask]);
  const recompute = useRecomputeInsights();
  const params = useLocalSearchParams<{ tab?: string; q?: string }>();
  const [pane, setPane] = useState<Pane>(PANES.some(p => p.key === params.tab) ? (params.tab as Pane) : 'overview');
  useEffect(() => { if (PANES.some(p => p.key === params.tab)) setPane(params.tab as Pane); }, [params.tab, params.q]);
  const qc = useQueryClient();
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
          onPress: () => {
            startExperiment.mutate(
              {
                exposureKey: finding.exposureKey,
                exposureLabel: finding.exposure.optionLabel,
                outcomeKey: finding.outcomeKey,
                outcomeLabel: finding.outcome.optionLabel,
              },
              {
                onSuccess: () => {
                  refetch();
                },
              },
            );
          },
        },
      ]
    );
  }, [startExperiment]);

  const onRefresh = useCallback(async () => {
    await refetch();
    await qc.invalidateQueries({ queryKey: ['progress'] });
    await qc.invalidateQueries({ queryKey: ['earlyWarning'] });
    await qc.invalidateQueries({ queryKey: ['experiments'] });
  }, [refetch, qc]);

  const findings = data?.findings ?? [];
  const activeFindings = findings.filter(f => !hidden.includes(f.id));
  const current = activeFindings.filter(f => !f.noLongerSeen);
  const earlier = activeFindings.filter(f => f.noLongerSeen);

  const filtered = current.filter(f => {
    if (tierFilter === 'Consistent') return f.tier === 'consistent';
    if (tierFilter === 'Possible') return f.tier === 'possible';
    return true;
  });

  const shown = showAll ? filtered : filtered.slice(0, VISIBLE_AT_FIRST);
  const hiddenCount = Math.max(0, filtered.length - VISIBLE_AT_FIRST);

  const stats = data?.stats ?? [];
  const progress = data?.progress ?? { observedDays: 0, daysNeeded: 30 };
  const buildingUp = (data?.daysOfData ?? 0) < progress.daysNeeded && findings.length === 0;

  const empty = {
    title: 'No patterns yet',
    body: 'Lumen looks for habits that change your symptoms over time. Having no patterns is not a sign anything is wrong.',
  };

  const Container = hideHeader ? View : SafeAreaView;
  const containerProps = hideHeader ? { style: { flex: 1 } } : { style: styles.safe, edges: ['top' as const] };

  return (
    <Container {...containerProps}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={palette.tint} />}
      >
        {!hideHeader && (
          <LargeTitleHeader
            title="Insights"
            subtitle="Patterns and trends from your logs"
            actions={
              <GlassCircleButton
                accessibilityLabel="Export report as PDF or CSV"
                onPress={() => router.push('/reports')}
              >
                <Download size={20} color={palette.text} />
              </GlassCircleButton>
            }
          />
        )}

        {/* 3-way toggle: Overview (classic), Explore (word pairs / correlation), Metrics (distribution) */}
        <View style={styles.flush}>
          <IosSegmented
            options={PANES}
            value={pane}
            onChange={setPane}
          />
        </View>

        {pane === 'explore' ? (
          <ExplorePane initialToken={typeof params.q === 'string' ? params.q : null} />
        ) : null}

        {pane === 'metrics' ? (
          <MetricsPane />
        ) : null}

        {pane === 'overview' ? (<>

        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={styles.loadingText}>Looking for patterns in your logs...</Text>
          </View>
        )}

        {!isLoading && buildingUp && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <View style={styles.emptyIconBadge}>
                <TrendingUp size={36} color={palette.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.sparkleBadge}>
                <Sparkles size={14} color={palette.tint} />
              </View>
            </View>
            <Text style={styles.emptyTitle}>Building your picture</Text>
            <Text style={styles.emptyBody}>
              {`You've logged ${progress.observedDays} of the ${progress.daysNeeded} days needed for statistical patterns. Every log helps uncover what works for your body.`}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, (progress.observedDays / progress.daysNeeded) * 100)}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{`${progress.observedDays} / ${progress.daysNeeded} logged days`}</Text>
          </View>
        )}

        {!isLoading && warningData && (
          <WarningCard warning={warningData} />
        )}

        {!isLoading && mostRecentExperiment && (
          <ExperimentCard experiment={mostRecentExperiment} />
        )}

        {!isLoading && progressData && (
          <ProgressCard progress={progressData} />
        )}

        {!isLoading && !buildingUp && stats.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>At a glance</Text>
            <View style={styles.statsGrid}>
              {stats.map(s => (
                <StatCard
                  key={s.key}
                  icon={s.icon}
                  title={s.title}
                  value={s.value}
                  sub={s.sub}
                  trend={s.trend}
                  trendGoodDirection={s.trendGoodDirection}
                  sparkValues={s.sparkValues}
                  accentColor={s.accentColor}
                />
              ))}
            </View>
          </>
        )}

        {!isLoading && !buildingUp && (
          <>
            <DisclaimerBanner />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Patterns in your logs</Text>
              {current.length > 0 && (
                <Text style={styles.sectionSub}>
                  {current.length} {current.length === 1 ? 'pattern' : 'patterns'}
                </Text>
              )}
            </View>

            {current.length > 0 && (
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
                  onAsk={aiOn ? askPattern : undefined}
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

        {!isLoading && <LumenAiCard />}

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

        </>) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </Container>
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
