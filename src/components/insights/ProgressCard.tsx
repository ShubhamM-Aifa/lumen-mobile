/**
 * "Am I getting better?": the weekly trend, a good/bad-day count, and a regime-shift note if there
 * is one. All words come from progressCopy.ts; this component only lays them out.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { MiniBar } from './MiniBar';
import { GoodBadDayBar } from './GoodBadDayBar';
import type { ProgressData } from '../../hooks/useProgress';
import { goodBadSummary, regimeShiftLine, trendBody, trendHeadline } from '../../services/insights/progressCopy';

const TONE: Record<ProgressData['trend']['state'], 'success' | 'warning' | 'neutral'> = {
  improving: 'success',
  worsening: 'warning',
  steady: 'neutral',
  mixed: 'neutral',
  not_enough_data: 'neutral',
};

export function ProgressCard({ progress }: { progress: ProgressData }) {
  const { palette } = useTheme();
  const styles = useStyles();
  const { trend, goodBadDays, recentShift } = progress;
  const tone = TONE[trend.state];
  const color = tone === 'success' ? palette.success : tone === 'warning' ? palette.warning : palette.textSecondary;
  const shiftLine = regimeShiftLine(recentShift);

  return (
    <View style={styles.card}>
      <Text style={styles.title} maxFontSizeMultiplier={1.3}>Your progress</Text>
      <Text style={[styles.headline, { color }]} maxFontSizeMultiplier={1.3}>{trendHeadline(trend)}</Text>
      <Text style={styles.body} maxFontSizeMultiplier={1.3}>{trendBody(trend)}</Text>

      {trend.weeklyValues.length > 1 && (
        <View style={styles.spark}>
          <MiniBar values={trend.weeklyValues.map(w => w.value)} color={color} height={36} />
        </View>
      )}

      {shiftLine && <Text style={styles.shift} maxFontSizeMultiplier={1.3}>{shiftLine}</Text>}

      <View style={styles.divider} />

      <Text style={styles.body} maxFontSizeMultiplier={1.3}>{goodBadSummary(goodBadDays)}</Text>
      {goodBadDays.observed > 0 && <GoodBadDayBar data={goodBadDays} />}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: { backgroundColor: palette.surface, borderRadius: 26, padding: 16, gap: 10 },
  title: { ...typography.headline, color: palette.text },
  headline: { ...typography.bodyBold, fontSize: 17 },
  body: { ...typography.body, color: palette.textSecondary, lineHeight: 22 },
  spark: { marginTop: 2 },
  shift: { ...typography.footnote, color: palette.textSecondary, lineHeight: 19, fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: 2 },
}));
