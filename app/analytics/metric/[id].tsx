/**
 * One number in detail: daily line (gaps where nothing was recorded, goal line), how many days
 * it is based on, change from the period before, trend, weekday pattern, spread, best/worst days.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenTopBar } from '../../../src/components/ios/ScreenTopBar';
import { FilterChip } from '../../../src/components/ios/FilterChip';
import { LineChart, BarChart } from '../../../src/components/charts/Charts';
import { RANGES } from '../../../src/components/insights/MetricsPane';
import { useMetricDetail, type MetricRange } from '../../../src/hooks/useAnalytics';
import {
  changeText, changeTone, coverageText, goalText, METRICS_NOTE, shareLabel, trendText, valueText, WEEKDAY_SHORT,
} from '../../../src/services/insights/metricsCopy';
import { formatValue } from '../../../src/utils/charts/chartScale';
import { createThemedStyles, useTheme } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';

const prettyDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function MetricDetailScreen() {
  const styles = useStyles();
  const { palette } = useTheme();
  const params = useLocalSearchParams<{ id: string; range?: string }>();
  const [range, setRange] = useState<MetricRange>((['7d', '30d', '90d', '365d'] as const).find(r => r === params.range) ?? '90d');
  const { data, isLoading, isError, refetch } = useMetricDetail(params.id, range);
  const m = data?.metric;
  const tone = m ? changeTone(m.change, m.better) : 'neutral';
  const toneColor = tone === 'good' ? palette.successText : tone === 'bad' ? palette.warningText : palette.textSecondary;
  const unit = m?.unit && !m.unit.startsWith('/') ? m.unit : '';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenTopBar title={m?.label ?? 'Metric'} subtitle={m?.scaleNote} fallbackRoute="/(tabs)/insights" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.chips}>
          {RANGES.map(r => <FilterChip key={r.key} label={r.label} selected={range === r.key} onPress={() => setRange(r.key)} />)}
        </View>

        {isLoading ? <ActivityIndicator color={palette.primaryText} /> : isError || !m ? (
          <TouchableOpacity style={styles.card} onPress={() => refetch()} accessibilityRole="button"><Text style={styles.body}>Could not load this. Tap to try again.</Text></TouchableOpacity>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.big} accessibilityRole="header">{valueText(m)}</Text>
              <Text style={styles.sub}>{shareLabel(m)} · {coverageText(m.covered, m.total)}</Text>
              <Text style={[styles.body, { color: toneColor }]}>{changeText(m.change, m.prev, m)}</Text>
              <Text style={styles.sub}>{trendText(m.trend)}</Text>
              {goalText(m.goalRate, m.goal, m) ? <Text style={styles.sub}>{goalText(m.goalRate, m.goal, m)}</Text> : null}
              {m.median !== null && m.summary === 'average' ? (
                <Text style={styles.sub}>Middle day {formatValue(m.median, m.decimals)}{unit ? ` ${unit}` : ''} · range {formatValue(m.min, m.decimals)} to {formatValue(m.max, m.decimals)}{unit ? ` ${unit}` : ''}</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.section}>Day by day</Text>
              <LineChart series={m.series} color={palette.tint} goal={m.goal} decimals={m.decimals} unit={unit} zeroBased={m.summary === 'share' || unit === 'ml' || unit === 'min' || unit === 'steps'} />
              <Text style={styles.sub}>Gaps are days with nothing recorded.</Text>
            </View>

            {m.weekday ? (
              <View style={styles.card}>
                <Text style={styles.section}>By weekday</Text>
                <BarChart values={m.weekday} labels={WEEKDAY_SHORT} color={palette.tint} decimals={m.decimals} unit={unit} />
              </View>
            ) : null}

            {m.histogram.length > 0 && m.summary === 'average' ? (
              <View style={styles.card}>
                <Text style={styles.section}>How often each level came up</Text>
                <BarChart values={m.histogram.map(h => h.count)} labels={m.histogram.map(h => formatValue(h.from, m.decimals))} color={palette.catVitals ?? palette.tint} unit="days" />
              </View>
            ) : null}

            {m.best.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.section}>Days that stood out</Text>
                {m.best.map(b => (
                  <TouchableOpacity key={`b${b.day}`} style={styles.row} onPress={() => router.push(`/(tabs)/timeline?date=${b.day}` as never)} accessibilityRole="button">
                    <Text style={styles.body}>{prettyDay(b.day)}</Text>
                    <Text style={styles.value}>{formatValue(b.v, m.decimals)} {unit}</Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.divider} />
                {m.worst.map(b => (
                  <TouchableOpacity key={`w${b.day}`} style={styles.row} onPress={() => router.push(`/(tabs)/timeline?date=${b.day}` as never)} accessibilityRole="button">
                    <Text style={styles.body}>{prettyDay(b.day)}</Text>
                    <Text style={styles.value}>{formatValue(b.v, m.decimals)} {unit}</Text>
                  </TouchableOpacity>
                ))}
                <Text style={styles.sub}>Best first, then hardest. Tap a day to open it.</Text>
              </View>
            ) : null}

            <Text style={styles.sub}>{METRICS_NOTE}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, gap: 14, paddingBottom: 60 },
  chips: { flexDirection: 'row' as const, gap: 8, flexWrap: 'wrap' as const },
  card: { backgroundColor: palette.surface, borderRadius: 22, padding: 16, gap: 8 },
  big: { ...typography.largeTitle, color: palette.text },
  section: { ...typography.headline, color: palette.text },
  body: { ...typography.body, color: palette.text },
  sub: { ...typography.footnote, color: palette.textSecondary },
  row: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, minHeight: 40, alignItems: 'center' as const },
  value: { ...typography.body, color: palette.text, fontWeight: '600' as const },
  divider: { height: 1, backgroundColor: palette.divider },
}));
