/**
 * Insights › Metrics: averages for the numbers you choose (sleep, steps, walking, exercise,
 * water, energy, stress, symptoms, weather, medicine doses, any logged item), each with how
 * many days it is based on, the change from the period before, and a small trend line.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { SlidersHorizontal, ScatterChart } from 'lucide-react-native';
import { useAnalyticsCatalog, useMetrics, useSetPins, type MetricRange, type MetricSummary } from '../../hooks/useAnalytics';
import { changeText, changeTone, coverageText, METRICS_NOTE, shareLabel, valueText } from '../../services/insights/metricsCopy';
import { FilterChip } from '../ios/FilterChip';
import { OptionsSheet, type SheetSection } from '../todo/OptionsSheet';
import { Sparkline } from '../charts/Charts';
import { createThemedStyles, useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

export const RANGES: Array<{ key: MetricRange; label: string }> = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '365d', label: '1 year' },
];
const MAX_PINS = 12;

export function MetricTile({ m, onPress }: { m: MetricSummary; onPress: () => void }) {
  const styles = useStyles();
  const { palette } = useTheme();
  const tone = changeTone(m.change, m.better);
  const toneColor = tone === 'good' ? palette.successText : tone === 'bad' ? palette.warningText : palette.textSecondary;
  const value = valueText(m);
  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${m.label}: ${value} ${shareLabel(m)}. ${coverageText(m.covered, m.total)}. ${changeText(m.change, m.prev, m)}. Open details.`}
    >
      <Text style={styles.tileLabel} numberOfLines={1}>{m.label}</Text>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.tileSub} numberOfLines={1}>{shareLabel(m)}{m.scaleNote ? ` · ${m.scaleNote}` : ''}</Text>
      <Sparkline values={m.series.map(p => p.v)} color={palette.tint} height={28} />
      <Text style={[styles.tileChange, { color: toneColor }]} numberOfLines={2}>{changeText(m.change, m.prev, m)}</Text>
      <Text style={styles.tileCoverage} numberOfLines={1}>{coverageText(m.covered, m.total)}</Text>
    </TouchableOpacity>
  );
}

export function MetricsPane() {
  const styles = useStyles();
  const { palette } = useTheme();
  const [range, setRange] = useState<MetricRange>('30d');
  const [editing, setEditing] = useState(false);
  const { data, isLoading, isError, refetch } = useMetrics(null, range);
  const catalog = useAnalyticsCatalog();
  const setPins = useSetPins();
  const pins = catalog.data?.pins ?? [];

  const togglePin = (id: string) => {
    const has = pins.includes(id);
    if (!has && pins.length >= MAX_PINS) {
      Alert.alert('Up to 12 numbers', 'Remove one to add another.');
      return;
    }
    setPins.mutate(has ? pins.filter(p => p !== id) : [...pins, id]);
  };

  const sections: SheetSection[] = useMemo(() => {
    const c = catalog.data;
    if (!c) return [];
    const opt = (id: string, label: string, hint?: string) => ({ key: id, label, hint, selected: pins.includes(id), keepOpen: true, onPress: () => togglePin(id) });
    const groups: Record<string, string> = { sleep: 'Sleep', activity: 'Activity', body: 'Body & mind', symptoms: 'Symptoms', weather: 'Weather' };
    const out: SheetSection[] = Object.entries(groups).map(([g, title]) => ({
      title,
      options: c.metrics.filter(m => m.group === g).map(m => opt(m.id, m.label, m.days ? `${m.days} days` : 'No values yet')),
    })).filter(s => s.options.length);
    if (c.medications.length) {
      out.push({ title: 'Medicines (doses taken)', options: c.medications.filter(m => !m.prn).map(m => opt(`dose:${m.id}`, `${m.name} taken`, m.plannedDoses ? `${m.plannedDoses} planned doses` : 'Add dose times to track')) });
    }
    const items = c.items.filter(i => !i.archived).slice(0, 60);
    if (items.length) {
      out.push({
        title: 'Things you log',
        options: items.flatMap(i => [
          opt(`item:${i.key}:count`, `${i.label} · times per day`, `${i.days} days`),
          ...(i.hasQty ? [opt(`item:${i.key}:qty`, `${i.label} · amount`, i.unit === 's' ? 'minutes' : i.unit ?? undefined)] : []),
          ...(i.hasSev ? [opt(`item:${i.key}:sev`, `${i.label} · severity`)] : []),
        ]),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.data, pins]);

  return (
    <View style={styles.pane}>
      <View style={styles.chips} accessibilityRole="tablist">
        {RANGES.map(r => <FilterChip key={r.key} label={r.label} selected={range === r.key} onPress={() => setRange(r.key)} />)}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={palette.primaryText} /></View>
      ) : isError ? (
        <TouchableOpacity style={styles.card} onPress={() => refetch()} accessibilityRole="button">
          <Text style={styles.body}>Could not load your numbers. Tap to try again.</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.grid}>
          {(data?.metrics ?? []).map(m => (
            <MetricTile key={m.id} m={m} onPress={() => router.push({ pathname: '/analytics/metric/[id]', params: { id: m.id, range } } as never)} />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Choose which numbers to show">
          <SlidersHorizontal size={16} color={palette.primaryText} />
          <Text style={styles.actionText}>Choose numbers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => router.push({ pathname: '/analytics/scatter', params: { range: range === '7d' ? '30d' : range } } as never)} accessibilityRole="button" accessibilityLabel="Compare two numbers">
          <ScatterChart size={16} color={palette.primaryText} />
          <Text style={styles.actionText}>Compare two</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.note}>{METRICS_NOTE}</Text>

      <OptionsSheet
        visible={editing}
        onClose={() => setEditing(false)}
        title="Numbers to show"
        subtitle={`${pins.length} of ${MAX_PINS} chosen`}
        sections={sections}
      />
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  pane: { gap: 14 },
  chips: { flexDirection: 'row' as const, gap: 8, flexWrap: 'wrap' as const },
  center: { paddingVertical: 40, alignItems: 'center' as const },
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 },
  tile: { width: '48.5%' as const, backgroundColor: palette.surface, borderRadius: 22, padding: 14, gap: 4 },
  tileLabel: { ...typography.footnote, color: palette.textSecondary, fontWeight: '600' as const },
  tileValue: { ...typography.title2, color: palette.text },
  tileSub: { ...typography.caption, color: palette.textSecondary },
  tileChange: { ...typography.caption, fontWeight: '600' as const },
  tileCoverage: { ...typography.caption, color: palette.textSecondary },
  card: { backgroundColor: palette.surface, borderRadius: 22, padding: 16 },
  body: { ...typography.body, color: palette.text },
  actions: { flexDirection: 'row' as const, gap: 10 },
  action: { flex: 1, flexDirection: 'row' as const, gap: 6, alignItems: 'center' as const, justifyContent: 'center' as const, minHeight: 44, borderRadius: 22, backgroundColor: palette.surface },
  actionText: { ...typography.body, color: palette.primaryText, fontWeight: '600' as const },
  note: { ...typography.footnote, color: palette.textSecondary },
}));

