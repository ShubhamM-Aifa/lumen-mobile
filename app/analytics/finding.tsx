/**
 * One Explore finding: the two rows of days side by side, the days they lined up (tap to open
 * the day), the counts again, and "Test it" / "Ask Lumen AI".
 */
import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { FlaskConical, Sparkles } from 'lucide-react-native';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { DayStrip } from '../../src/components/charts/Charts';
import { useExplore, useFindingDays, useAnalyticsCatalog } from '../../src/hooks/useAnalytics';
import { useStartExperiment } from '../../src/hooks/useExperiments';
import { useAskLumenAi } from '../../src/hooks/useAskLumenAi';
import { decodeQuestion } from '../../src/utils/ai/questionToken';
import { findingCounts, findingTitle, flagText, lagPhrase, tierHelp, tierLabel, TOGETHER_NOT_CAUSE } from '../../src/services/insights/exploreCopy';
import { createThemedStyles, useTheme } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

const prettyDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function FindingScreen() {
  const styles = useStyles();
  const { palette } = useTheme();
  const params = useLocalSearchParams<{ q: string; key: string; lag: string }>();
  const question = decodeQuestion(params.q);
  const answer = useExplore(question);
  const days = useFindingDays(params.q, params.key, params.lag);
  const catalog = useAnalyticsCatalog();
  const startExperiment = useStartExperiment();
  const { ask, fullAccess } = useAskLumenAi();

  const a = answer.data;
  const f = a?.findings.find(x => x.key === params.key && String(x.lag) === params.lag) ?? a?.findings.find(x => x.key === params.key);
  const direction = question?.direction ?? 'before';
  const targetLabel = a?.target.label ?? '';

  // A 6-week experiment fits "this item before this symptom".
  const canTest = !!f && f.type === 'item' && f.way === 'more' && direction === 'before' && question?.target.kind === 'item' && /^(opt|qa|cat)_/.test(f.key);
  const testIt = () => {
    if (!f || !question || question.target.kind !== 'item') return;
    const outcomeKey = question.target.key;
    Alert.alert(
      'Test it for 6 weeks?',
      `Lumen will randomly schedule six 7-day blocks — three with ${f.label}, three without — in an order it won't tell you in advance. Keep logging as usual.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => startExperiment.mutate(
            { exposureKey: f.key, exposureLabel: f.label, outcomeKey, outcomeLabel: catalog.data?.items.find(i => i.key === outcomeKey)?.label ?? targetLabel },
            {
              onSuccess: () => router.push('/(tabs)/insights' as never),
              onError: (err) => Alert.alert('Could not start', err instanceof Error ? err.message : 'Please try again.'),
            },
          ),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenTopBar title={f ? f.label : 'Finding'} subtitle={f ? lagPhrase(f.lag, direction) : undefined} fallbackRoute="/(tabs)/insights" />
      <ScrollView contentContainerStyle={styles.content}>
        {answer.isLoading ? <ActivityIndicator color={palette.primaryText} /> : !f || !a ? (
          <View style={styles.card}><Text style={styles.body}>This finding isn’t in the latest results any more (new logs can change them).</Text></View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.title} accessibilityRole="header">{findingTitle(f, direction)}</Text>
              <Text style={styles.badge}>{tierLabel(f.tier)}</Text>
              <Text style={styles.body}>{findingCounts(f, targetLabel, direction)}</Text>
              <Text style={styles.sub}>{tierHelp(f.tier)}</Text>
              {f.flags.map(fl => <Text key={fl} style={styles.flag}>• {flagText(fl)}</Text>)}
            </View>

            <View style={styles.card}>
              <Text style={styles.section}>Day by day</Text>
              {days.isLoading ? <ActivityIndicator color={palette.primaryText} /> : days.data ? (
                <DayStrip
                  days={days.data.days}
                  rows={[
                    { label: targetLabel, color: palette.error, state: days.data.target },
                    { label: f.label, color: palette.tint, state: days.data.item },
                  ]}
                />
              ) : <Text style={styles.sub}>Could not load the days.</Text>}
              <Text style={styles.sub}>Coloured: logged. Grey: a day you were logging without it. Blank: not logged.</Text>
            </View>

            {days.data && days.data.matches.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.section}>When they lined up</Text>
                {days.data.matches.slice(0, 20).map(m => (
                  <TouchableOpacity key={`${m.targetDay}-${m.itemDay}`} style={styles.row} onPress={() => router.push(`/(tabs)/timeline?date=${m.targetDay}` as never)} accessibilityRole="button"
                    accessibilityLabel={`${targetLabel} on ${prettyDay(m.targetDay)}, ${f.label} on ${prettyDay(m.itemDay)}. Open the day.`}
                  >
                    <Text style={styles.body}>{prettyDay(direction === 'before' ? m.itemDay : m.targetDay)}</Text>
                    <Text style={styles.sub}>→ {prettyDay(direction === 'before' ? m.targetDay : m.itemDay)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={styles.sub}>{TOGETHER_NOT_CAUSE}</Text>

            {canTest ? (
              <TouchableOpacity style={styles.action} onPress={testIt} accessibilityRole="button">
                <FlaskConical size={18} color={palette.primaryText} />
                <Text style={styles.actionText}>Test it for 6 weeks</Text>
              </TouchableOpacity>
            ) : null}
            {fullAccess && question ? (
              <TouchableOpacity style={styles.action} onPress={() => ask({ kind: 'analysis', id: a.token, title: `Explore: ${targetLabel}` }, `In the attached Explore results, what could explain “${f.label}” ${lagPhrase(f.lag, direction)} ${targetLabel}, and how could I check it?`)} accessibilityRole="button">
                <Sparkles size={18} color={palette.primaryText} />
                <Text style={styles.actionText}>Ask Lumen AI about this</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, gap: 14, paddingBottom: 60 },
  card: { backgroundColor: palette.surface, borderRadius: 22, padding: 16, gap: 8 },
  title: { ...typography.title2, color: palette.text },
  badge: { ...typography.footnote, color: palette.primaryText, fontWeight: '700' as const },
  section: { ...typography.headline, color: palette.text },
  body: { ...typography.body, color: palette.text },
  sub: { ...typography.footnote, color: palette.textSecondary },
  flag: { ...typography.footnote, color: palette.warningText },
  row: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, minHeight: 40 },
  action: { flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const, justifyContent: 'center' as const, minHeight: 48, borderRadius: 24, backgroundColor: palette.surface },
  actionText: { ...typography.headline, color: palette.primaryText },
}));
