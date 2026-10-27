/**
 * The early-warning card: "higher than your usual" or "resembles your pre-flare days", with its
 * own track record and three feedback buttons. Shown only once the server has something to say.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AlertCircle, TrendingUp } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import type { WarningData } from '../../hooks/useWarning';
import { useWarningFeedback } from '../../hooks/useWarning';
import {
  DISCLAIMER_LINE, level1GateLine, trackRecordLine, warningBody, warningHeadline,
} from '../../services/insights/warningCopy';

export function WarningCard({ warning }: { warning: WarningData }) {
  const { palette } = useTheme();
  const styles = useStyles();
  const feedback = useWarningFeedback();

  if (!warning.ready || warning.disabled) return null;

  const active = !!warning.alert;
  const tone = active ? (warning.alertLevel === 1 ? palette.warning : palette.textSecondary) : palette.success;
  const track = trackRecordLine(warning);
  const gate = level1GateLine(warning);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: tone + '1A' }]}>
          {active ? <AlertCircle size={20} color={tone} strokeWidth={2.2} /> : <TrendingUp size={20} color={tone} strokeWidth={2.2} />}
        </View>
        <Text style={styles.headline} maxFontSizeMultiplier={1.3}>{warningHeadline(warning)}</Text>
      </View>

      <Text style={styles.body} maxFontSizeMultiplier={1.3}>{warningBody(warning)}</Text>
      {track && <Text style={styles.track} maxFontSizeMultiplier={1.3}>{track}</Text>}
      {gate && <Text style={styles.gate} maxFontSizeMultiplier={1.3}>{gate}</Text>}
      <Text style={styles.disclaimer} maxFontSizeMultiplier={1.3}>{DISCLAIMER_LINE}</Text>

      {active && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.action}
            onPress={() => feedback.mutate('helpful')}
            disabled={feedback.isPending}
            accessibilityRole="button"
            accessibilityLabel="Helpful"
          >
            <Text style={styles.actionText} maxFontSizeMultiplier={1.3}>Helpful</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            onPress={() => feedback.mutate('not_this_time')}
            disabled={feedback.isPending}
            accessibilityRole="button"
            accessibilityLabel="Not this time"
          >
            <Text style={styles.actionText} maxFontSizeMultiplier={1.3}>Not this time</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            onPress={() => feedback.mutate('stop')}
            disabled={feedback.isPending}
            accessibilityRole="button"
            accessibilityLabel="Stop these"
          >
            {feedback.isPending ? <ActivityIndicator size="small" color={palette.textSecondary} /> : (
              <Text style={[styles.actionText, styles.stopText]} maxFontSizeMultiplier={1.3}>Stop these</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: { backgroundColor: palette.surface, borderRadius: 26, padding: 16, gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headline: { ...typography.headline, color: palette.text, flex: 1 },
  body: { ...typography.body, color: palette.textSecondary, lineHeight: 22 },
  track: { ...typography.body, fontWeight: '600', color: palette.text, lineHeight: 22 },
  gate: { ...typography.footnote, color: palette.textSecondary, lineHeight: 19 },
  disclaimer: { ...typography.footnote, color: palette.textSecondary, lineHeight: 19 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  action: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
  actionText: { ...typography.body, color: palette.primaryText },
  stopText: { color: palette.textDisabled },
}));
