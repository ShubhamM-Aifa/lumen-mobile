import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { createThemedStyles, useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  title: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  maxLength?: number;
  accessibilityLabel?: string;
}

/** Section title above a rounded multiline text card. */
export function NoteField({ title, value, onChangeText, placeholder, maxLength = 1000, accessibilityLabel }: Props) {
  const styles = useStyles();
  const { palette } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.placeholder}
        multiline
        maxLength={maxLength}
        accessibilityLabel={accessibilityLabel ?? title}
      />
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  wrap: { gap: 7 },
  title: { ...typography.sectionLabel, color: palette.textSecondary, paddingHorizontal: 4 },
  input: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...typography.bodyLarge,
    color: palette.text,
    minHeight: 84,
    textAlignVertical: 'top',
  },
}));
