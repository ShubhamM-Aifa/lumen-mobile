/**
 * "Counts toward" for Insights › Metrics: which daily number a question or quick tap feeds
 * (water ml, exercise minutes, walking minutes, hours slept). "Automatic" lets Lumen guess from
 * the template or name; "Nothing" opts out.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

export type MetricRole = 'water' | 'exercise' | 'walk' | 'sleep';
/** undefined = automatic, null = nothing. */
export type MetricRoleValue = MetricRole | null | undefined;

const CHOICES: Array<{ value: MetricRoleValue; label: string }> = [
  { value: undefined, label: 'Automatic' },
  { value: 'water', label: 'Water (ml)' },
  { value: 'exercise', label: 'Exercise minutes' },
  { value: 'walk', label: 'Walking minutes' },
  { value: 'sleep', label: 'Hours slept' },
  { value: null, label: 'Nothing' },
];

const ROLE_BY_TEMPLATE: Record<string, MetricRole> = { qa_water: 'water', qa_walk: 'walk', q_exercise: 'exercise', q_sleep_quality: 'sleep' };

/** Same guess the server makes when the choice is "Automatic". */
export function guessMetricRole(templateKey: string | undefined | null, label: string): MetricRole | null {
  if (templateKey && ROLE_BY_TEMPLATE[templateKey]) return ROLE_BY_TEMPLATE[templateKey];
  if (/\b(water|hydrat\w*)\b/i.test(label)) return 'water';
  if (/\bwalk(s|ing|ed)?\b/i.test(label)) return 'walk';
  if (/\b(exercise|workout|gym|yoga|running|run|cycling|swim\w*|training|physio\w*)\b/i.test(label)) return 'exercise';
  if (/\b(sleep|slept)\b/i.test(label)) return 'sleep';
  return null;
}

const ROLE_NAME: Record<MetricRole, string> = { water: 'water', exercise: 'exercise minutes', walk: 'walking minutes', sleep: 'hours slept' };

export function MetricRolePicker({ value, onChange, templateKey, label, hint }: {
  value: MetricRoleValue;
  onChange: (v: MetricRoleValue) => void;
  templateKey?: string | null;
  label: string;
  hint: string;
}) {
  const styles = useStyles();
  const guess = guessMetricRole(templateKey, label);
  const autoNote = value === undefined ? (guess ? `Automatic: counts toward ${ROLE_NAME[guess]}.` : 'Automatic: not counted toward a daily number.') : null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>{hint}</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {CHOICES.map(c => {
          const on = c.value === value;
          return (
            <TouchableOpacity
              key={String(c.value)}
              onPress={() => onChange(c.value)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Counts toward: ${c.label}`}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {autoNote ? <Text style={styles.hint}>{autoNote}</Text> : null}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  wrap: { gap: 8 },
  row: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  chip: { borderRadius: 16, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' as const, backgroundColor: palette.surfaceAlt },
  chipOn: { backgroundColor: palette.primary },
  chipText: { ...typography.small, color: palette.text, fontWeight: '600' as const },
  chipTextOn: { color: '#FFFFFF' },
  hint: { ...typography.footnote, color: palette.textSecondary },
}));
