import React from 'react';
import { View, Text } from 'react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { pct } from '../../services/insights/insightCopy';

interface Props {
  withRate: number;
  otherRate: number;
  withLabel: string;
  otherLabel?: string;
}

/**
 * Two bars on the same 0 to 100% scale: how often the symptom was logged on exposure days and on
 * other days. The scale is not stretched, so a small gap looks small.
 */
export function RateBars({ withRate, otherRate, withLabel, otherLabel = 'Other days' }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const bar = (label: string, rate: number, color: string) => (
    <View style={styles.row} accessible accessibilityLabel={`${label}: symptom logged on ${pct(rate)} of days`}>
      <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.3}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(2, Math.round(rate * 100))}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.value} maxFontSizeMultiplier={1.3}>{pct(rate)}</Text>
    </View>
  );
  return (
    <View style={styles.wrap}>
      {bar(withLabel, withRate, palette.primary)}
      {bar(otherLabel, otherRate, palette.textDisabled)}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { ...typography.footnote, color: palette.textSecondary, width: 96 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: palette.border, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  value: { ...typography.footnote, fontWeight: '700', color: palette.text, width: 40, textAlign: 'right' },
}));
