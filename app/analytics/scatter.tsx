/**
 * Compare two numbers day by day (e.g. sleep the night before vs worst symptom): a dot per day,
 * with a plain-words rank correlation and how many days it is based on.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { FilterChip } from '../../src/components/ios/FilterChip';
import { IosSegmented } from '../../src/components/ios/IosSegmented';
import { OptionsSheet, type SheetSection } from '../../src/components/todo/OptionsSheet';
import { ScatterPlot } from '../../src/components/charts/Charts';
import { RANGES } from '../../src/components/insights/MetricsPane';
import { useAnalyticsCatalog, useScatter, type MetricRange } from '../../src/hooks/useAnalytics';
import { rhoText, SCATTER_NOTE } from '../../src/services/insights/metricsCopy';
import { createThemedStyles, useTheme } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

export default function ScatterScreen() {
  const styles = useStyles();
  const { palette } = useTheme();
  const params = useLocalSearchParams<{ range?: string; x?: string; y?: string }>();
  const [range, setRange] = useState<MetricRange>((['30d', '90d', '365d'] as const).find(r => r === params.range) ?? '90d');
  const [x, setX] = useState<string>(params.x ?? 'sleep_hours');
  const [y, setY] = useState<string>(params.y ?? 'symptom_max');
  const [lag, setLag] = useState<0 | 1>(1);
  const [picking, setPicking] = useState<'x' | 'y' | null>(null);
  const catalog = useAnalyticsCatalog();
  const { data, isLoading } = useScatter(x, y, lag, range);

  const label = (id: string) => catalog.data?.metrics.find(m => m.id === id)?.label
    ?? catalog.data?.items.find(i => id.startsWith(`item:${i.key}:`))?.label
    ?? id;

  const sections: SheetSection[] = useMemo(() => {
    const c = catalog.data;
    if (!c || !picking) return [];
    const choose = (id: string) => () => (picking === 'x' ? setX(id) : setY(id));
    const cur = picking === 'x' ? x : y;
    return [
      { title: 'Daily numbers', options: c.metrics.filter(m => m.days > 0).map(m => ({ key: m.id, label: m.label, hint: `${m.days} days`, selected: cur === m.id, onPress: choose(m.id) })) },
      { title: 'Things you log (times per day)', options: c.items.filter(i => !i.archived).slice(0, 40).map(i => ({ key: i.key, label: i.label, hint: `${i.days} days`, selected: cur === `item:${i.key}:count`, onPress: choose(`item:${i.key}:count`) })) },
      { title: 'Severity', options: c.items.filter(i => i.hasSev && !i.archived).slice(0, 30).map(i => ({ key: `${i.key}-sev`, label: `${i.label} severity`, selected: cur === `item:${i.key}:sev`, onPress: choose(`item:${i.key}:sev`) })) },
    ].filter(s => s.options.length > 0);
  }, [catalog.data, picking, x, y]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenTopBar title="Compare two numbers" fallbackRoute="/(tabs)/insights" />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.picker} onPress={() => setPicking('x')} accessibilityRole="button" accessibilityLabel={`First number: ${label(x)}. Change`}>
          <View style={{ flex: 1 }}><Text style={styles.hint}>First (across)</Text><Text style={styles.value}>{label(x)}</Text></View>
          <ChevronDown size={18} color={palette.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.picker} onPress={() => setPicking('y')} accessibilityRole="button" accessibilityLabel={`Second number: ${label(y)}. Change`}>
          <View style={{ flex: 1 }}><Text style={styles.hint}>Second (up)</Text><Text style={styles.value}>{label(y)}</Text></View>
          <ChevronDown size={18} color={palette.textSecondary} />
        </TouchableOpacity>
        <IosSegmented
          options={[{ key: '0', label: 'Same day' }, { key: '1', label: 'First one the day before' }]}
          value={String(lag) as '0' | '1'}
          onChange={(k) => setLag(k === '1' ? 1 : 0)}
        />
        <View style={styles.chips}>
          {RANGES.filter(r => r.key !== '7d').map(r => <FilterChip key={r.key} label={r.label} selected={range === r.key} onPress={() => setRange(r.key)} />)}
        </View>

        <View style={styles.card}>
          {isLoading || !data ? <ActivityIndicator color={palette.primaryText} /> : (
            <>
              <ScatterPlot points={data.points} color={palette.tint} xLabel={data.x.label} yLabel={data.y.label} />
              <Text style={styles.body}>{rhoText(data.rho, data.n)}</Text>
            </>
          )}
        </View>
        <Text style={styles.hint}>{SCATTER_NOTE}</Text>
      </ScrollView>
      <OptionsSheet visible={picking !== null} onClose={() => setPicking(null)} title={picking === 'x' ? 'First number' : 'Second number'} sections={sections} />
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, gap: 12, paddingBottom: 60 },
  picker: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: palette.surface, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, minHeight: 52 },
  hint: { ...typography.footnote, color: palette.textSecondary },
  value: { ...typography.headline, color: palette.text },
  chips: { flexDirection: 'row' as const, gap: 8, flexWrap: 'wrap' as const },
  card: { backgroundColor: palette.surface, borderRadius: 22, padding: 16, gap: 10 },
  body: { ...typography.body, color: palette.text },
}));
