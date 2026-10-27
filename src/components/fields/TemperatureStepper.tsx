/**
 * TemperatureStepper — tap −/+ in 0.1° steps.
 * Always stores in °C; shows °F alongside when prefUnit is 'F'.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FieldDefinition } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  field: FieldDefinition;
  value: number;           // always °C
  prefUnit?: 'C' | 'F';   // user's display preference (default 'C')
  onChange: (celsius: number) => void;
}

const toF = (c: number) => c * 9 / 5 + 32;
const toC = (f: number) => (f - 32) * 5 / 9;

export function TemperatureStepper({ field, value, prefUnit = 'C', onChange }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const step      = field.step ?? 0.1;
  const minC      = field.min  ?? 34;
  const maxC      = field.max  ?? 42;
  const displayV  = prefUnit === 'F' ? toF(value) : value;
  const unit      = prefUnit === 'F' ? '°F' : '°C';

  const nudge = (direction: 1 | -1) => {
    const delta = prefUnit === 'F' ? toC(displayV + direction * step) - value : direction * step;
    const next = Math.max(minC, Math.min(maxC, parseFloat((value + delta).toFixed(2))));
    onChange(next);
  };

  const febrile = value >= 38;
  const color = febrile ? palette.error : value >= 37.5 ? palette.warning : palette.success;

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, value <= minC && styles.btnDisabled]}
          onPress={() => nudge(-1)}
          disabled={value <= minC}
          accessibilityLabel="Decrease temperature"
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>−</Text>
        </TouchableOpacity>

        <View style={styles.valueGroup}>
          <Text style={[styles.valueText, { color }]}>
            {displayV.toFixed(1)}{unit}
          </Text>
          {prefUnit === 'F' && (
            <Text style={styles.altText}>{value.toFixed(1)}°C</Text>
          )}
          {prefUnit === 'C' && (
            <Text style={styles.altText}>{toF(value).toFixed(1)}°F</Text>
          )}
          {febrile && <Text style={styles.febrileTag}>Fever</Text>}
        </View>

        <TouchableOpacity
          style={[styles.btn, value >= maxC && styles.btnDisabled]}
          onPress={() => nudge(1)}
          disabled={value >= maxC}
          accessibilityLabel="Increase temperature"
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>＋</Text>
        </TouchableOpacity>
      </View>
      {field.helpText ? <Text style={styles.hint}>{field.helpText}</Text> : null}
    </View>
  );
}

const BTN = 52;

const useStyles = createThemedStyles((palette) => ({
  wrapper: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: {
    width: BTN, height: BTN, borderRadius: BTN / 2,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1, borderColor: palette.border,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.3 },
  btnText: { ...typography.h2, color: palette.primaryText, lineHeight: BTN },
  valueGroup: { flex: 1, alignItems: 'center', gap: 2 },
  valueText: { ...typography.h2, fontVariant: ['tabular-nums'] },
  altText: { ...typography.small, color: palette.textSecondary },
  febrileTag: {
    backgroundColor: palette.error + '22',
    color: palette.errorText,
    ...typography.caption,
    fontWeight: '600',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8,
  },
  hint: { ...typography.small, color: palette.textSecondary },
}));
