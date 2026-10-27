/**
 * Medical-safety disclaimer — shown at the top of every insights screen.
 * Collapsible after first read.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Info, ChevronDown } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

export function DisclaimerBanner() {
  const { palette } = useTheme();
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => setExpanded(v => !v)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Insights disclaimer — tap to expand"
    >
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Info size={15} color={palette.infoText} strokeWidth={2.4} />
        </View>
        <Text style={styles.title}>About these insights</Text>
        <ChevronDown
          size={16}
          color={palette.infoText}
          strokeWidth={2.2}
          style={expanded ? styles.chevronExpanded : undefined}
        />
      </View>
      {expanded && (
        <Text style={styles.body}>
          These patterns are based solely on your recorded data and are for{' '}
          <Text style={styles.bold}>personal observation only</Text>. They show correlations, not causes.
          {'\n\n'}Never start, stop or change medication, diet or treatment based on this app.
          Always discuss patterns with a qualified healthcare professional before making any decisions.
        </Text>
      )}
      {!expanded && (
        <Text style={styles.summary}>Patterns, not causes · Not medical advice · Discuss with your doctor</Text>
      )}
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles(palette => ({
  banner: {
    backgroundColor: palette.info + '14',
    borderRadius: 22,
    padding: 14, gap: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.info + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.label, color: palette.infoText, fontWeight: '700', flex: 1 },
  chevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  summary: { ...typography.small, color: palette.infoText + 'CC', lineHeight: 18 },
  body: { ...typography.small, color: palette.textSecondary, lineHeight: 20 },
  bold: { fontWeight: '700', color: palette.text },
}));
