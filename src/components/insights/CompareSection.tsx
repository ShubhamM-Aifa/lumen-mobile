/**
 * "Did this change help?": pick a date (when a medicine started, a food was cut out, anything),
 * and compare the 28 days before it with the 28 days after a washout period. The server does the
 * statistics; this only collects the date and lays out the result.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { AppDateTimePicker } from '../common/AppDateTimePicker';
import { useCompare } from '../../hooks/useCompare';
import {
  compareCaveats, compareFlareLine, compareNotReadyText, compareSeverityLine, compareSymptomRateLine,
} from '../../services/insights/progressCopy';

function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function CompareSection() {
  const { palette } = useTheme();
  const styles = useStyles();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chosen, setChosen] = useState<Date | null>(null);
  const compare = useCompare();

  const runCompare = (date: Date) => {
    setChosen(date);
    compare.mutate({ day: toDayKey(date) });
  };

  const result = compare.data;

  return (
    <View style={styles.card}>
      <Text style={styles.title} maxFontSizeMultiplier={1.3}>Did a change help?</Text>
      <Text style={styles.body} maxFontSizeMultiplier={1.3}>
        Pick the day something changed — a new medicine, cutting out a food, anything — and compare the 4 weeks before with the 4 weeks after (plus a week to let things settle).
      </Text>

      <TouchableOpacity
        style={styles.dateBtn}
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={chosen ? `Change date, currently ${toDayKey(chosen)}` : 'Pick the date something changed'}
      >
        <Calendar size={16} color={palette.primaryText} strokeWidth={2.2} />
        <Text style={styles.dateBtnText} maxFontSizeMultiplier={1.3}>
          {chosen ? toDayKey(chosen) : 'Pick a date'}
        </Text>
      </TouchableOpacity>

      {compare.isPending && (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.primaryText} />
        </View>
      )}

      {result && !result.ready && (
        <Text style={styles.notReady} maxFontSizeMultiplier={1.3}>{compareNotReadyText(result)}</Text>
      )}

      {result && result.ready && (
        <View style={styles.result}>
          {[compareSeverityLine(result), compareSymptomRateLine(result), compareFlareLine(result)]
            .filter((l): l is string => !!l)
            .map(line => <Text key={line} style={styles.resultLine} maxFontSizeMultiplier={1.3}>{line}</Text>)}
          {compareCaveats(result).map(line => (
            <Text key={line} style={styles.caveat} maxFontSizeMultiplier={1.3}>{line}</Text>
          ))}
          <Text style={styles.together} maxFontSizeMultiplier={1.3}>
            This compares two periods in your own logs. It is not a controlled test, and many things can change at once.
          </Text>
        </View>
      )}

      <AppDateTimePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={chosen ?? new Date()}
        onChange={d => { setPickerOpen(false); runCompare(d); }}
        maximumDate={new Date()}
        mode="date"
        title="When did it change?"
      />
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: { backgroundColor: palette.surface, borderRadius: 26, padding: 16, gap: 10 },
  title: { ...typography.headline, color: palette.text },
  body: { ...typography.body, color: palette.textSecondary, lineHeight: 22 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: palette.primary + '14', borderRadius: 16, paddingHorizontal: 14, minHeight: 44,
  },
  dateBtnText: { ...typography.body, fontWeight: '600', color: palette.primaryText },
  loading: { paddingVertical: 8, alignItems: 'center' },
  notReady: { ...typography.body, color: palette.textSecondary, lineHeight: 22 },
  result: { gap: 8, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10, marginTop: 2 },
  resultLine: { ...typography.body, color: palette.text, lineHeight: 22 },
  caveat: { ...typography.footnote, color: palette.warning, lineHeight: 19 },
  together: { ...typography.footnote, color: palette.textSecondary, lineHeight: 19 },
}));
