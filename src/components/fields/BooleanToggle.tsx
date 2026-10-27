import React from 'react';
import { View, Text } from 'react-native';
import { FieldDefinition } from '@lumen/shared';
import { AppleSwitch } from '../common/AppleSwitch';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  field: FieldDefinition;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function BooleanToggle({ field, value, onChange }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.labelGroup}>
        <Text style={styles.label}>{field.label}</Text>
        {field.helpText ? <Text style={styles.hint}>{field.helpText}</Text> : null}
      </View>
      <AppleSwitch
        value={value}
        onValueChange={onChange}
        activeColor={palette.primary || '#34C759'}
        accessibilityLabel={field.label}
      />
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    minHeight: 56,
  },
  labelGroup: { flex: 1, paddingRight: 16 },
  label: { ...typography.body, color: palette.text },
  hint:  { ...typography.small, color: palette.textSecondary, marginTop: 2 },
}));
