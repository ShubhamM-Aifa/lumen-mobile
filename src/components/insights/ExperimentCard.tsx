/**
 * The current or most recent "test it for 6 weeks" experiment: which week it is, which kind
 * (without revealing the schedule in advance), and the result once the six weeks are done.
 */
import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import type { ExperimentData } from '../../hooks/useExperiments';
import { useEndExperiment } from '../../hooks/useExperiments';
import {
  EXPERIMENT_DISCLAIMER, MEDICINE_LINE, resultLine, scheduleLine, significanceLine, thinDataLine,
} from '../../services/insights/experimentCopy';

export function ExperimentCard({ experiment }: { experiment: ExperimentData }) {
  const { palette } = useTheme();
  const styles = useStyles();
  const end = useEndExperiment();
  const done = !!experiment.result;

  const confirmStop = () => {
    Alert.alert(
      'Stop this experiment?',
      'Your logs so far are kept, but the schedule will end early.',
      [{ text: 'Keep going', style: 'cancel' }, { text: 'Stop', style: 'destructive', onPress: () => end.mutate({ id: experiment.id, status: 'abandoned' }) }],
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title} maxFontSizeMultiplier={1.3}>
        Testing {experiment.exposureLabel} → {experiment.outcomeLabel}
      </Text>
      <Text style={styles.body} maxFontSizeMultiplier={1.3}>{scheduleLine(experiment)}</Text>

      {experiment.isMedicineRelated && (
        <Text style={styles.medicine} maxFontSizeMultiplier={1.3}>{MEDICINE_LINE}</Text>
      )}

      {done && (
        <View style={styles.result}>
          <Text style={styles.resultLine} maxFontSizeMultiplier={1.3}>{resultLine(experiment)}</Text>
          <Text style={styles.significance} maxFontSizeMultiplier={1.3}>{significanceLine(experiment)}</Text>
          {thinDataLine(experiment) && (
            <Text style={styles.thin} maxFontSizeMultiplier={1.3}>{thinDataLine(experiment)}</Text>
          )}
          <Text style={styles.disclaimer} maxFontSizeMultiplier={1.3}>{EXPERIMENT_DISCLAIMER}</Text>
        </View>
      )}

      {experiment.status === 'active' && !done && (
        <TouchableOpacity
          style={styles.stopBtn}
          onPress={confirmStop}
          disabled={end.isPending}
          accessibilityRole="button"
          accessibilityLabel="Stop this experiment"
        >
          <Text style={styles.stopText} maxFontSizeMultiplier={1.3}>Stop early</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: { backgroundColor: palette.surface, borderRadius: 26, padding: 16, gap: 8 },
  title: { ...typography.headline, color: palette.text },
  body: { ...typography.body, color: palette.textSecondary, lineHeight: 22 },
  medicine: { ...typography.footnote, fontWeight: '600', color: palette.warning, lineHeight: 19 },
  result: { gap: 6, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10, marginTop: 2 },
  resultLine: { ...typography.body, color: palette.text, lineHeight: 22 },
  significance: { ...typography.body, fontWeight: '600', color: palette.text, lineHeight: 22 },
  thin: { ...typography.footnote, color: palette.warning, lineHeight: 19 },
  disclaimer: { ...typography.footnote, color: palette.textSecondary, lineHeight: 19 },
  stopBtn: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  stopText: { ...typography.body, color: palette.textDisabled },
}));
