import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { api } from '../../api/client';
import { queryClient } from '../../api/queryClient';
import { uuidv4 } from '../../utils/uuid';
import { getTrackingDayDateString } from '../../utils/dayBoundary';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useIosSurfaces } from '../ios/iosTheme';

interface Props {
  boundaryHour: number;
}

interface Saved {
  noSymptoms: boolean;
  score: number | null;
  energy?: number | null;
  stress?: number | null;
}

/** Option ids Insights reads: a day with one of these is a day the member was really watching. */
export const NO_SYMPTOMS_OPTION_ID = 'checkin:no_symptoms';
export const PATIENT_GLOBAL_OPTION_ID = 'checkin:global';
/** Optional 0-10 scales for Metrics and Explore: energy (10 = most energy), stress (10 = most stressed). */
export const ENERGY_OPTION_ID = 'checkin:energy';
export const STRESS_OPTION_ID = 'checkin:stress';

const SCORES = Array.from({ length: 11 }, (_, i) => i);
const storageKey = (day: string) => `lumen:day_checkin:${day}`;

/**
 * End-of-day check-in: "No symptoms today" and an overall 0-10 score. Silence in the log is
 * ambiguous (nothing happened, or I did not log), so this turns it into a recorded answer.
 */
export function DayCheckInCard({ boundaryHour }: Props) {
  const styles = useStyles();
  const { palette } = useTheme();
  const s = useIosSurfaces();
  const [saved, setSaved] = useState<Saved>({ noSymptoms: false, score: null });

  const dayKey = getTrackingDayDateString(new Date(), boundaryHour);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey(dayKey))
      .then(raw => { if (active) setSaved(raw ? (JSON.parse(raw) as Saved) : { noSymptoms: false, score: null }); })
      .catch(() => {});
    return () => { active = false; };
  }, [dayKey]);

  const post = useCallback(async (optionId: string, label: string, score?: number) => {
    await api.post('/logs', {
      clientId: uuidv4(),
      source: 'check_in',
      occurredAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      answers: [{
        optionId,
        optionLabelSnapshot: label,
        values: score === undefined ? [] : [{ fieldKey: 'score', dataType: 'range', value: score }],
      }],
    });
    queryClient.invalidateQueries({ queryKey: ['today-logs'] });
    queryClient.invalidateQueries({ queryKey: ['day-entries'] });
    queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
  }, []);

  const save = useCallback(async (next: Saved, send: () => Promise<void>) => {
    const previous = saved;
    setSaved(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await send();
      AsyncStorage.setItem(storageKey(dayKey), JSON.stringify(next)).catch(() => {});
    } catch (err) {
      setSaved(previous);
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    }
  }, [saved, dayKey]);

  const chooseNoSymptoms = () => {
    if (saved.noSymptoms) return;
    save({ ...saved, noSymptoms: true }, () => post(NO_SYMPTOMS_OPTION_ID, 'No symptoms today'));
  };

  const chooseScore = (score: number) => {
    if (saved.score === score) return;
    save({ ...saved, score }, () => post(PATIENT_GLOBAL_OPTION_ID, 'Overall today', score));
  };

  const chooseEnergy = (energy: number) => {
    if (saved.energy === energy) return;
    save({ ...saved, energy }, () => post(ENERGY_OPTION_ID, 'Energy today', energy));
  };

  const chooseStress = (stress: number) => {
    if (saved.stress === stress) return;
    save({ ...saved, stress }, () => post(STRESS_OPTION_ID, 'Stress today', stress));
  };

  const [showMore, setShowMore] = useState(false);
  const scale = (label: string, value: number | null | undefined, onPick: (n: number) => void, a11y: (n: number) => string) => (
    <View>
      <Text style={styles.scoreLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      <View style={styles.scores} accessibilityRole="radiogroup">
        {SCORES.map(n => {
          const selected = value === n;
          return (
            <TouchableOpacity
              key={n}
              style={[styles.score, { backgroundColor: selected ? palette.primary : s.fill }]}
              onPress={() => onPick(n)}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={a11y(n)}
            >
              <Text style={[styles.scoreText, selected && styles.scoreTextOn]} maxFontSizeMultiplier={1.2}>{n}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const note = saved.score !== null
    ? `Overall ${saved.score} of 10${saved.noSymptoms ? ' · no symptoms' : ''}${saved.energy != null ? ` · energy ${saved.energy}` : ''}${saved.stress != null ? ` · stress ${saved.stress}` : ''}`
    : saved.noSymptoms
      ? 'Marked: no symptoms today'
      : 'Takes a few seconds. It helps your patterns make sense.';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>Close out today</Text>
        <Text style={styles.note}>{note}</Text>
      </View>

      <TouchableOpacity
        style={[styles.noSymptoms, { backgroundColor: saved.noSymptoms ? palette.success + '26' : s.fill }]}
        onPress={chooseNoSymptoms}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ selected: saved.noSymptoms }}
        accessibilityLabel="No symptoms today"
      >
        <Text style={styles.noSymptomsText} maxFontSizeMultiplier={1.3}>
          {saved.noSymptoms ? '✓ No symptoms today' : 'No symptoms today'}
        </Text>
      </TouchableOpacity>

      {scale('How was today overall? 0 is great, 10 is worst.', saved.score, chooseScore, n => `Overall today ${n} of 10`)}

      {showMore || saved.energy != null || saved.stress != null ? (
        <>
          {scale('Energy today? 0 is none, 10 is plenty.', saved.energy, chooseEnergy, n => `Energy today ${n} of 10`)}
          {scale('Stress today? 0 is calm, 10 is very stressed.', saved.stress, chooseStress, n => `Stress today ${n} of 10`)}
        </>
      ) : (
        <TouchableOpacity onPress={() => setShowMore(true)} accessibilityRole="button" accessibilityLabel="Add energy and stress" hitSlop={8}>
          <Text style={styles.more}>+ Energy and stress (optional)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: { marginHorizontal: 16, backgroundColor: palette.surface, borderRadius: 26, padding: 16, gap: 14 },
  head: { gap: 2 },
  title: { ...typography.headline, color: palette.text },
  note: { ...typography.footnote, color: palette.textSecondary },
  noSymptoms: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  noSymptomsText: { ...typography.body, fontWeight: '600', color: palette.text },
  scoreLabel: { ...typography.footnote, color: palette.textSecondary, marginBottom: 8 },
  scores: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  score: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  scoreText: { ...typography.body, fontWeight: '600', color: palette.text },
  scoreTextOn: { color: '#FFFFFF' },
  more: { ...typography.footnote, color: palette.primaryText, fontWeight: '600' },
}));
