/**
 * NumberStepper — large − / + buttons for entering a numeric value.
 * Optionally shows a unit selector when allowedUnits is provided.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Modal,
  FlatList, Pressable,
} from 'react-native';
import { FieldDefinition } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  field: FieldDefinition;
  value: number;
  unit: string;
  onChange: (v: number, unit: string) => void;
}

export function NumberStepper({ field, value, unit, onChange }: Props) {
  const styles = useStyles();
  const min  = field.min  ?? 0;
  const max  = field.max  ?? 9999;
  const step = field.step ?? 1;
  const units = field.allowedUnits ?? (field.unit ? [field.unit] : []);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);

  const clamp = (v: number) => Math.max(min, Math.min(max, parseFloat(v.toFixed(4))));

  const decrement = () => onChange(clamp(value - step), unit);
  const increment = () => onChange(clamp(value + step), unit);

  const handleText = (t: string) => {
    const n = parseFloat(t);
    if (!Number.isNaN(n)) onChange(clamp(n), unit);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {/* − button */}
        <TouchableOpacity
          style={[styles.btn, value <= min && styles.btnDisabled]}
          onPress={decrement}
          disabled={value <= min}
          accessibilityLabel={`Decrease ${field.label}`}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>−</Text>
        </TouchableOpacity>

        {/* Value input */}
        <TextInput
          style={styles.valueInput}
          value={String(value)}
          onChangeText={handleText}
          keyboardType="decimal-pad"
          textAlign="center"
          accessibilityLabel={field.label}
        />

        {/* + button */}
        <TouchableOpacity
          style={[styles.btn, value >= max && styles.btnDisabled]}
          onPress={increment}
          disabled={value >= max}
          accessibilityLabel={`Increase ${field.label}`}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>＋</Text>
        </TouchableOpacity>

        {/* Unit selector */}
        {units.length > 1 && (
          <TouchableOpacity
            style={styles.unitBtn}
            onPress={() => setUnitPickerOpen(true)}
            accessibilityLabel="Select unit"
            accessibilityRole="button"
          >
            <Text style={styles.unitText}>{unit}</Text>
          </TouchableOpacity>
        )}
        {units.length === 1 && unit ? (
          <Text style={styles.unitFixed}>{unit}</Text>
        ) : null}
      </View>

      {field.helpText ? <Text style={styles.hint}>{field.helpText}</Text> : null}

      {/* Unit picker modal */}
      <Modal visible={unitPickerOpen} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setUnitPickerOpen(false)}>
          <View style={styles.picker}>
            <Text style={styles.pickerTitle}>Choose unit</Text>
            <FlatList
              data={units}
              keyExtractor={u => u}
              renderItem={({ item: u }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, u === unit && styles.pickerItemActive]}
                  onPress={() => { onChange(value, u); setUnitPickerOpen(false); }}
                  accessibilityRole="button"
                  accessibilityLabel={u}
                >
                  <Text style={[styles.pickerItemText, u === unit && styles.pickerItemTextActive]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const BTN = 52;

const useStyles = createThemedStyles((palette) => ({
  wrapper: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: {
    width: BTN, height: BTN, borderRadius: BTN / 2,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1, borderColor: palette.border,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.3 },
  btnText: { ...typography.h2, color: palette.primaryText, lineHeight: BTN },
  valueInput: {
    flex: 1, height: BTN,
    backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.border,
    borderRadius: 14,
    ...typography.h3, color: palette.text,
    textAlign: 'center',
  },
  unitBtn: {
    paddingHorizontal: 14, height: BTN,
    backgroundColor: palette.primary + '22',
    borderRadius: 12, borderWidth: 1, borderColor: palette.primary + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  unitText:  { ...typography.bodyBold, color: palette.primaryText },
  unitFixed: { ...typography.bodyBold, color: palette.textSecondary, paddingHorizontal: 6 },
  hint: { ...typography.small, color: palette.textSecondary },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  picker: {
    backgroundColor: palette.surface, borderRadius: 20,
    padding: 20, width: 260, maxHeight: 320,
  },
  pickerTitle: { ...typography.h4, color: palette.text, marginBottom: 12 },
  pickerItem: {
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 10, marginBottom: 6,
    backgroundColor: palette.surfaceAlt,
  },
  pickerItemActive: { backgroundColor: palette.primary },
  pickerItemText: { ...typography.body, color: palette.text },
  pickerItemTextActive: { color: palette.white, fontWeight: '700' },
}));
