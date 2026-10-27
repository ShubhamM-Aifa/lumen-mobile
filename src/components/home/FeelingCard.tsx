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
  firstName?: string;
  boundaryHour: number;
}

interface Saved {
  label: string;
  at: string;
}

const storageKey = (day: string) => `lumen:feeling:${day}`;

/** "How are you feeling?" one-tap check-in. Logs a check_in entry with no category. */
export function FeelingCard({ firstName, boundaryHour }: Props) {
  const styles = useStyles();
  const { palette } = useTheme();
  const s = useIosSurfaces();
  const [saved, setSaved] = useState<Saved | null>(null);

  const faces: Array<{ label: string; color: string }> = [
    { label: 'Great', color: palette.success },
    { label: 'Good', color: palette.secondary },
    { label: 'Okay', color: palette.accent },
    { label: 'Low', color: palette.warning },
    { label: 'Flare', color: palette.error },
  ];

  const dayKey = getTrackingDayDateString(new Date(), boundaryHour);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey(dayKey))
      .then(raw => { if (active) setSaved(raw ? (JSON.parse(raw) as Saved) : null); })
      .catch(() => {});
    return () => { active = false; };
  }, [dayKey]);

  const choose = useCallback(async (label: string) => {
    const previous = saved;
    const at = new Date().toISOString();
    setSaved({ label, at });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await api.post('/logs', {
        clientId: uuidv4(),
        source: 'check_in',
        occurredAt: at,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        answers: [{
          optionId: `feeling:${label.toLowerCase()}`,
          optionLabelSnapshot: `Feeling ${label.toLowerCase()}`,
          values: [],
        }],
      });
      AsyncStorage.setItem(storageKey(dayKey), JSON.stringify({ label, at })).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['today-logs'] });
      queryClient.invalidateQueries({ queryKey: ['day-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
    } catch (err) {
      setSaved(previous);
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    }
  }, [saved, dayKey]);

  const note = saved
    ? `Feeling ${saved.label.toLowerCase()} · ${new Date(saved.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : 'One tap logs it. Add details later.';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          {firstName ? `How are you feeling, ${firstName}?` : 'How are you feeling?'}
        </Text>
        <Text style={styles.note}>{note}</Text>
      </View>
      <View style={styles.row} accessibilityRole="radiogroup">
        {faces.map(f => {
          const selected = saved?.label === f.label;
          return (
            <TouchableOpacity
              key={f.label}
              style={styles.face}
              onPress={() => choose(f.label)}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Feeling ${f.label.toLowerCase()}`}
            >
              <View style={[styles.circle, { backgroundColor: selected ? f.color + '26' : s.fill }]}>
                <View style={[styles.dot, { backgroundColor: f.color }, selected && { borderWidth: 3, borderColor: f.color + '55' }]} />
              </View>
              <Text style={styles.label} maxFontSizeMultiplier={1.2} numberOfLines={1}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: { marginHorizontal: 16, backgroundColor: palette.surface, borderRadius: 26, padding: 16, gap: 14 },
  head: { gap: 2 },
  title: { ...typography.headline, color: palette.text },
  note: { ...typography.footnote, color: palette.textSecondary },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  face: { width: 64, alignItems: 'center', gap: 6, minHeight: 84 },
  circle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9 },
  label: { ...typography.footnote, fontWeight: '500', color: palette.text },
}));
