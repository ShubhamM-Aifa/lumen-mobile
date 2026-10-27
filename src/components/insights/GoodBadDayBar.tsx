import React from 'react';
import { View } from 'react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import type { GoodBadDaysData } from '../../hooks/useProgress';

/** A single segmented bar: good days, days in between, and harder days, as a share of the window. */
export function GoodBadDayBar({ data }: { data: GoodBadDaysData }) {
  const { palette } = useTheme();
  const styles = useStyles();
  const total = Math.max(1, data.observed);
  const neutral = Math.max(0, data.observed - data.good - data.bad);

  const segment = (count: number, color: string, label: string) => count > 0 && (
    <View
      style={{ flex: count / total, backgroundColor: color }}
      accessible
      accessibilityLabel={`${count} ${label} of ${data.observed} logged days`}
    />
  );

  return (
    <View style={styles.track}>
      {segment(data.good, palette.success, 'good')}
      {segment(neutral, palette.border, 'in-between')}
      {segment(data.bad, palette.error, 'harder')}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  track: { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row' },
}));
