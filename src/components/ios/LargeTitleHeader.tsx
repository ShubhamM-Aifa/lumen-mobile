import React from 'react';
import { View, Text } from 'react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  title: string;
  subtitle?: string;
  /** Round glass buttons shown top-right, above the title. */
  actions?: React.ReactNode;
  /** Round glass button shown top-left (back), for pushed screens. */
  leading?: React.ReactNode;
  /** Colour for the title, e.g. the active list's tint. */
  titleColor?: string;
}

/** iOS large-title header: controls row, then a 34pt title and optional subtitle. */
export function LargeTitleHeader({ title, subtitle, actions, leading, titleColor }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <View style={[styles.actions, leading ? styles.actionsSplit : null]}>
        {leading}
        {leading && actions ? <View style={styles.actionGroup}>{actions}</View> : actions}
      </View>
      <View style={styles.titleBlock}>
        <Text style={[styles.title, titleColor ? { color: titleColor } : null]} accessibilityRole="header" maxFontSizeMultiplier={1.3}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  wrap: { gap: 0 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  actionsSplit: { justifyContent: 'space-between' },
  actionGroup: { flexDirection: 'row', gap: 10 },
  titleBlock: { paddingHorizontal: 20, marginTop: -2, gap: 2 },
  title: { ...typography.largeTitle, color: palette.text },
  subtitle: { ...typography.subhead, color: palette.textSecondary },
}));
