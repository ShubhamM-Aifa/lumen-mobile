import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Small coloured glyph shown before the label (e.g. a list icon). */
  icon?: React.ReactNode;
  accessibilityLabel?: string;
}

/** Pill filter chip. Selected = high-contrast (black on light, white on dark). */
export function FilterChip({ label, selected, onPress, icon, accessibilityLabel }: Props) {
  const styles = useStyles();
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.selected]}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 7, bottom: 7, left: 0, right: 0 }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {icon}
      <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{label}</Text>
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles(palette => ({
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: palette.surface, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: palette.text },
  text: { ...typography.subhead, color: palette.text },
  textSelected: { color: palette.background, fontWeight: '600' },
}));
