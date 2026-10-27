import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** 22pt bold section heading with an optional blue action on the right. */
export function SectionTitle({ title, actionLabel, onAction }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel} ${title}`}
        >
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { ...typography.title2, color: palette.text },
  action: { ...typography.bodyLarge, color: palette.primaryText },
}));
