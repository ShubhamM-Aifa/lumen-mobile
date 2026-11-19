/**
 * Insights › Explore: pick one thing — a symptom (any, or only bad days, or "higher than
 * usual"), a flare, a skipped medicine, a number over/under a value, or a stretch of days — and
 * see what tends to come before it or follow it across everything you log.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ChevronDown, Sparkles, Search } from 'lucide-react-native';
import {
  useAnalyticsCatalog, useExplore,
  type AnalyticsCatalog, type BinaryFinding, type ExploreDirection, type ExploreQuestion, type ExploreRange, type ExploreTarget,
} from '../../hooks/useAnalytics';
import { useAskLumenAi } from '../../hooks/useAskLumenAi';
import {
  brainstormPrompt, caveatText, checkedText, findingCounts, findingTitle, flagText, headerText, notEnoughText,
  numericSentence, tierHelp, tierLabel, TOGETHER_NOT_CAUSE,
} from '../../services/insights/exploreCopy';
import { encodeQuestion, decodeQuestion } from '../../utils/ai/questionToken';
import { IosSegmented } from '../ios/IosSegmented';
import { FilterChip } from '../ios/FilterChip';
import { OptionsSheet, type SheetSection } from '../todo/OptionsSheet';
import AppDateTimePicker from '../common/AppDateTimePicker';
import { RateBars } from './RateBars';
import { createThemedStyles, useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

const RANGES: Array<{ key: ExploreRange; label: string }> = [
  { key: '90d', label: '90 days' }, { key: '180d', label: '6 months' }, { key: '365d', label: '1 year' }, { key: 'all', label: 'All' },
];

/** Ready-made "number over/under" questions. */
const METRIC_PRESETS: Array<{ id: string; op: 'lt' | 'gt'; value: number; label: string }> = [
  { id: 'sleep_hours', op: 'lt', value: 6, label: 'Slept under 6 hours' },
  { id: 'steps', op: 'lt', value: 3000, label: 'Under 3,000 steps' },
  { id: 'water_ml', op: 'lt', value: 1500, label: 'Under 1.5 L water' },
  { id: 'energy', op: 'lt', value: 4, label: 'Energy 3 or less' },
  { id: 'stress', op: 'gt', value: 6, label: 'Stress 7 or more' },
  { id: 'temp_max', op: 'gt', value: 35, label: 'Hot day (over 35 °C)' },
  { id: 'pressure_change', op: 'lt', value: -5, label: 'Air pressure dropped 5+ hPa' },
  { id: 'humidity', op: 'gt', value: 80, label: 'Humid day (over 80%)' },
];

const dayStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftDays = (key: string, delta: number) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10); };

/** Short label for the current target (shown on the picker button). */
export function targetLabel(t: ExploreTarget, catalog: AnalyticsCatalog | undefined): string {
  const item = (key: string) => catalog?.items.find(i => i.key === key)?.label ?? 'Item';
  const med = (id: string) => catalog?.medications.find(m => m.id === id)?.name ?? 'medicine';
  switch (t.kind) {
    case 'item': return t.minSev !== undefined ? `${item(t.key)} (severity ${t.minSev}+)` : item(t.key);
    case 'flare': return 'Flare days';
    case 'dose': return t.status === 'skipped' ? `Skipped ${med(t.medicationId)}` : `Took all of ${med(t.medicationId)}`;
    case 'metric': return METRIC_PRESETS.find(p => p.id === t.id && p.op === t.op && p.value === t.value)?.label ?? t.id;
    case 'rise': return t.key === 'symptom_max' ? 'Symptoms higher than usual' : `${item(t.key)} higher than usual`;
    case 'period': return `${t.from} to ${t.to}`;
  }
}

export function ExplorePane({ initialToken }: { initialToken?: string | null }) {
  const styles = useStyles();
  const { palette } = useTheme();
  const catalog = useAnalyticsCatalog();
  const { ask, fullAccess } = useAskLumenAi();
  const initial = useMemo(() => decodeQuestion(initialToken), [initialToken]);
  const [target, setTarget] = useState<ExploreTarget | null>(initial?.target ?? null);
  const [direction, setDirection] = useState<ExploreDirection>(initial?.direction ?? 'before');
  const [range, setRange] = useState<ExploreRange>(initial?.range ?? '365d');
  const [picking, setPicking] = useState(false);
  const [sevFor, setSevFor] = useState<string | null>(null);
  const [periodPick, setPeriodPick] = useState<'from' | 'to' | null>(null);
  const [period, setPeriod] = useState<{ from: Date; to: Date }>(() => { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 13); return { from, to }; });
  const [showUnclear, setShowUnclear] = useState(false);

  useEffect(() => {
    if (initial) { setTarget(initial.target); setDirection(initial.direction); setRange(initial.range); }
  }, [initial]);

  // Default: the member's most-logged symptom, so the pane is useful at first sight.
  useEffect(() => {
    if (target || !catalog.data) return;
    const first = catalog.data.items.find(i => i.outcome && !i.archived && i.kind !== 'category');
    if (first) setTarget({ kind: 'item', key: first.key });
  }, [catalog.data, target]);

  const question: ExploreQuestion | null = target ? { target, direction: target.kind === 'period' ? 'before' : direction, range } : null;
  const answer = useExplore(question);
  const label = target ? targetLabel(target, catalog.data) : 'Choose something to explore';

  const sections: SheetSection[] = useMemo(() => {
    const c = catalog.data;
    if (!c) return [];
    const pick = (t: ExploreTarget) => () => { setTarget(t); setShowUnclear(false); };
    const symptoms = c.items.filter(i => i.outcome && !i.archived);
    const others = c.items.filter(i => !i.outcome && !i.archived);
    const out: SheetSection[] = [];
    if (symptoms.length) {
      out.push({
        title: 'Symptoms',
        options: symptoms.flatMap(i => [
          { key: `i-${i.key}`, label: i.label, hint: `${i.days} days${i.groupLabel ? ` · ${i.groupLabel}` : ''}`, onPress: pick({ kind: 'item', key: i.key }) },
          ...(i.hasSev ? [{ key: `s-${i.key}`, label: `${i.label} · only bad days`, hint: 'Pick a severity', keepOpen: true, onPress: () => setSevFor(i.key) }] : []),
          { key: `r-${i.key}`, label: `${i.label} · higher than usual`, hint: 'Compared with your own last 2 weeks', onPress: pick({ kind: 'rise', key: i.key }) },
        ]),
      });
    }
    out.push({
      title: 'Flares',
      options: [
        { key: 'flare', label: 'Flare days', onPress: pick({ kind: 'flare' }) },
        { key: 'rise-all', label: 'Symptoms higher than usual', hint: 'Any day clearly worse than your recent level', onPress: pick({ kind: 'rise', key: 'symptom_max' }) },
      ],
    });
    const meds = c.medications.filter(m => !m.prn);
    if (meds.length) {
      out.push({
        title: 'Medicines',
        options: meds.flatMap(m => [
          { key: `ms-${m.id}`, label: `Skipped ${m.name}`, hint: m.plannedDoses ? `${m.skippedDoses} skipped of ${m.plannedDoses} planned` : 'Add dose times and mark doses to use this', onPress: pick({ kind: 'dose', medicationId: m.id, status: 'skipped' }) },
        ]),
      });
    }
    out.push({
      title: 'Daily numbers',
      options: METRIC_PRESETS.filter(p => (c.metrics.find(m => m.id === p.id)?.days ?? 0) > 0)
        .map(p => ({ key: `m-${p.id}-${p.op}-${p.value}`, label: p.label, onPress: pick({ kind: 'metric', id: p.id, op: p.op, value: p.value }) })),
    });
    if (others.length) {
      out.push({ title: 'Food, habits and everything else', options: others.slice(0, 80).map(i => ({ key: `o-${i.key}`, label: i.label, hint: `${i.days} days${i.groupLabel ? ` · ${i.groupLabel}` : ''}`, onPress: pick({ kind: 'item', key: i.key }) })) });
    }
    out.push({
      title: 'A stretch of days',
      options: [
        { key: 'p-7', label: 'Last 7 days vs the 7 before', onPress: pick({ kind: 'period', from: shiftDays(c.today, -6), to: c.today }) },
        { key: 'p-14', label: 'Last 14 days vs the 14 before', onPress: pick({ kind: 'period', from: shiftDays(c.today, -13), to: c.today }) },
        { key: 'p-30', label: 'Last 30 days vs the 30 before', onPress: pick({ kind: 'period', from: shiftDays(c.today, -29), to: c.today }) },
        { key: 'p-custom', label: 'Pick dates…', opensModal: true, onPress: () => setPeriodPick('from') },
      ],
    });
    return out.filter(s => s.options.length > 0);
  }, [catalog.data]);

  const sevSections: SheetSection[] = sevFor ? [{
    title: 'Only days at or above',
    options: [3, 5, 7, 9].map(n => ({ key: `sev-${n}`, label: `Severity ${n} or more`, onPress: () => { setTarget({ kind: 'item', key: sevFor, minSev: n }); setSevFor(null); setPicking(false); } })),
  }] : [];

  const a = answer.data;
  const tLabel = a?.target.label ?? label;
  const isPeriod = target?.kind === 'period';

  const openFinding = (f: BinaryFinding) => {
    if (!question || !a) return;
    router.push({ pathname: '/analytics/finding', params: { q: encodeQuestion(question), key: f.key, lag: String(f.lag) } } as never);
  };

  const brainstorm = () => {
    if (!question) return;
    ask({ kind: 'analysis', id: a?.token ?? encodeQuestion(question), title: `Explore: ${tLabel} (${isPeriod ? 'vs before' : direction === 'before' ? 'before' : 'after'})` }, brainstormPrompt(tLabel, direction));
  };

  return (
    <View style={styles.pane}>
      <TouchableOpacity style={styles.picker} onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel={`Explore: ${label}. Change`}>
        <Search size={18} color={palette.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pickerHint}>Explore</Text>
          <Text style={styles.pickerValue} numberOfLines={2}>{label}</Text>
        </View>
        <ChevronDown size={18} color={palette.textSecondary} />
      </TouchableOpacity>

      {!isPeriod ? (
        <IosSegmented
          options={[{ key: 'before', label: 'What came before' }, { key: 'after', label: 'What followed' }]}
          value={direction}
          onChange={(d) => setDirection(d as ExploreDirection)}
        />
      ) : null}

      <View style={styles.chips}>
        {RANGES.map(r => <FilterChip key={r.key} label={r.label} selected={range === r.key} onPress={() => setRange(r.key)} />)}
      </View>

      {!target ? (
        <View style={styles.card}><Text style={styles.body}>{catalog.isLoading ? 'Loading what you log…' : 'Log for a few days, then pick a symptom, medicine or habit here to see what tends to happen around it.'}</Text></View>
      ) : answer.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={palette.primaryText} /><Text style={styles.sub}>Comparing your days…</Text></View>
      ) : answer.isError || !a ? (
        <TouchableOpacity style={styles.card} onPress={() => answer.refetch()} accessibilityRole="button"><Text style={styles.body}>Could not run this. Tap to try again.</Text></TouchableOpacity>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.headline} accessibilityRole="header">
              {a.period ? `${a.period.from} to ${a.period.to} compared with ${a.period.prevFrom} to ${a.period.prevTo}` : headerText(a.target.label, a.target.days, a.target.observedDays)}
            </Text>
            <Text style={styles.sub}>{checkedText(a.checkedCount, a.findings.length + a.numeric.filter(n => n.tier !== 'none').length)}</Text>
          </View>

          {a.findings.length > 0 ? <Text style={styles.section}>Stands out</Text> : null}
          {a.findings.map(f => (
            <TouchableOpacity key={`${f.key}-${f.lag}`} style={styles.card} onPress={() => openFinding(f)} accessibilityRole="button"
              accessibilityLabel={`${findingTitle(f, direction)}. ${tierLabel(f.tier)}. ${isPeriod ? '' : findingCounts(f, a.target.label, direction)} Open details.`}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle} numberOfLines={2}>{isPeriod ? `${f.way === 'less' ? 'Less often: ' : 'More often: '}${f.label}` : findingTitle(f, direction)}</Text>
                <View style={[styles.badge, { backgroundColor: f.tier === 'consistent' ? `${palette.success}26` : `${palette.tint}1F` }]}>
                  <Text style={[styles.badgeText, { color: f.tier === 'consistent' ? palette.successText : palette.primaryText }]}>{tierLabel(f.tier)}</Text>
                </View>
              </View>
              <Text style={styles.body}>
                {isPeriod
                  ? `${f.label} on ${f.a} of ${f.a + f.b} logged days in this stretch, compared with ${f.c} of ${f.c + f.d} before it.`
                  : findingCounts(f, a.target.label, direction)}
              </Text>
              <RateBars
                withRate={f.rateWith}
                otherRate={f.rateOther}
                withLabel={isPeriod ? 'This stretch' : direction === 'before' ? `With ${f.label}` : `After ${a.target.label}`}
                otherLabel={isPeriod ? 'Before it' : 'Other days'}
              />
              {f.flags.map(fl => <Text key={fl} style={styles.flag}>• {flagText(fl)}</Text>)}
              <Text style={styles.sub}>{tierHelp(f.tier)}</Text>
            </TouchableOpacity>
          ))}

          {a.numeric.filter(n => n.tier !== 'none').length > 0 ? <Text style={styles.section}>Numbers around these days</Text> : null}
          {a.numeric.filter(n => n.tier !== 'none').map(n => (
            <View key={n.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{n.label}</Text>
                <Text style={styles.badgeText}>{tierLabel(n.tier)}</Text>
              </View>
              <Text style={styles.body}>{isPeriod ? `${n.label}: typically ${n.medianWith}${n.unit ? ` ${n.unit}` : ''} in this stretch, compared with ${n.medianOther}${n.unit ? ` ${n.unit}` : ''} before it.` : numericSentence(n, a.target.label, direction)}</Text>
            </View>
          ))}

          {a.unclear.length > 0 ? (
            <TouchableOpacity onPress={() => setShowUnclear(v => !v)} style={styles.more} accessibilityRole="button" accessibilityState={{ expanded: showUnclear }}>
              <Text style={styles.moreText}>{showUnclear ? 'Hide' : 'Show'} {a.unclear.length} checked with no clear difference</Text>
            </TouchableOpacity>
          ) : null}
          {showUnclear ? (
            <View style={styles.card}>
              {a.unclear.map(u => (
                <Text key={`${u.key}-${u.lag}`} style={styles.small}>
                  {u.label}: {u.a} of {u.a + u.b} vs {u.c} of {u.c + u.d}
                </Text>
              ))}
            </View>
          ) : null}

          {a.notEnough.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Not enough days yet</Text>
              <Text style={styles.sub}>Needs at least 4–5 days each to compare.</Text>
              {a.notEnough.slice(0, 8).map(x => <Text key={x.key} style={styles.small}>{notEnoughText(x.label, x.days)}</Text>)}
            </View>
          ) : null}

          <View style={styles.card}>
            {a.caveats.map(c => caveatText(c, { checked: a.checkedCount, days: a.target.days })).filter(Boolean).map(t => <Text key={t!} style={styles.small}>{t}</Text>)}
            {!a.caveats.includes('together_not_cause') ? <Text style={styles.small}>{TOGETHER_NOT_CAUSE}</Text> : null}
          </View>

          {fullAccess ? (
            <TouchableOpacity style={styles.ai} onPress={brainstorm} accessibilityRole="button" accessibilityLabel="Find what's linked with Lumen AI">
              <Sparkles size={18} color="#FFFFFF" />
              <Text style={styles.aiText}>Find what’s linked</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.more]} onPress={brainstorm} accessibilityRole="button">
              <Text style={styles.moreText}>Turn on Lumen AI to talk these results through</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <OptionsSheet visible={picking && !sevFor} onClose={() => setPicking(false)} title="Explore" subtitle="What do you want to look at?" sections={sections} />
      <OptionsSheet visible={!!sevFor} onClose={() => setSevFor(null)} title="Only bad days" sections={sevSections} />
      <AppDateTimePicker
        visible={periodPick !== null}
        mode="date"
        title={periodPick === 'from' ? 'First day' : 'Last day'}
        value={periodPick === 'to' ? period.to : period.from}
        maximumDate={new Date()}
        onClose={() => setPeriodPick(null)}
        onChange={(d) => {
          if (periodPick === 'from') { setPeriod(p => ({ from: d, to: p.to < d ? d : p.to })); setPeriodPick('to'); return; }
          const from = period.from;
          const to = d < from ? from : d;
          setPeriod({ from, to });
          setPeriodPick(null);
          setPicking(false);
          setTarget({ kind: 'period', from: dayStr(from), to: dayStr(to) });
        }}
      />
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  pane: { gap: 12 },
  picker: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, backgroundColor: palette.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
  pickerHint: { ...typography.caption, color: palette.textSecondary },
  pickerValue: { ...typography.headline, color: palette.text },
  chips: { flexDirection: 'row' as const, gap: 8, flexWrap: 'wrap' as const },
  center: { alignItems: 'center' as const, paddingVertical: 30, gap: 8 },
  card: { backgroundColor: palette.surface, borderRadius: 22, padding: 16, gap: 8 },
  headline: { ...typography.headline, color: palette.text },
  section: { ...typography.title2, color: palette.text, marginTop: 4 },
  cardTitle: { ...typography.headline, color: palette.text, flex: 1 },
  rowBetween: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const, gap: 8 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { ...typography.caption, fontWeight: '700' as const, color: palette.textSecondary },
  body: { ...typography.body, color: palette.text },
  sub: { ...typography.footnote, color: palette.textSecondary },
  small: { ...typography.footnote, color: palette.textSecondary },
  flag: { ...typography.footnote, color: palette.warningText },
  more: { minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
  moreText: { ...typography.body, color: palette.primaryText },
  ai: { flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const, justifyContent: 'center' as const, minHeight: 50, borderRadius: 25, backgroundColor: palette.primary },
  aiText: { ...typography.headline, color: '#FFFFFF' },
}));
