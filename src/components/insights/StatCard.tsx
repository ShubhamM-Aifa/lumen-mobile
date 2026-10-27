/**
 * StatCard — a single descriptive-stat tile (trend, count, average).
 * Shown in the "At a glance" section of the Insights screen.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MiniBar } from './MiniBar';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  icon: string;
  title: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'flat';
  trendGoodDirection?: 'up' | 'down'; // which direction is "good" for color
  sparkValues?: number[];
  sparkColor?: string;
  accentColor?: string;
}

const TREND_ICON = { up: '↑', down: '↓', flat: '→' };

export function StatCard({ icon, title, value, sub, trend, trendGoodDirection, sparkValues, sparkColor, accentColor }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const accent = accentColor ?? palette.primary;

  const trendColor = trend == null ? palette.textDisabled
    : trend === 'flat' ? palette.textDisabled
    : trend === trendGoodDirection ? palette.success
    : palette.error;

  return (
    <View style={[styles.card, { borderColor: accent + '33' }]}>
      <View style={styles.top}>
        <View style={[styles.iconBadge, { backgroundColor: accent + '18' }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: accent }]}>{value}</Text>
        {trend && (
          <Text style={[styles.trend, { color: trendColor }]}>
            {TREND_ICON[trend]}
          </Text>
        )}
      </View>

      {sub && <Text style={styles.sub}>{sub}</Text>}

      {sparkValues && sparkValues.length > 1 && (
        <View style={styles.spark}>
          <MiniBar values={sparkValues} color={sparkColor ?? accent + 'AA'} height={28} />
        </View>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: {
    backgroundColor: palette.surface, borderRadius: 22,
    padding: 14, gap: 8, flexGrow: 1, flexShrink: 1, flexBasis: '46%', minWidth: 150,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBadge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 18 },
  title: { ...typography.small, color: palette.textSecondary, fontWeight: '600', flex: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  value: { ...typography.h3 },
  trend: { ...typography.h4, fontWeight: '700' },
  sub: { ...typography.caption, color: palette.textSecondary },
  spark: { marginTop: 2 },
}));
