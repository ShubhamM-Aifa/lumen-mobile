/**
 * TimeField — tappable time display that opens a native DateTimePicker.
 * Stores as "HH:mm" string; uses the device's system time picker.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { AppDateTimePicker } from '../common/AppDateTimePicker';
import { FieldDefinition } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  field: FieldDefinition;
  value: string;          // "HH:mm"
  onChange: (v: string) => void;
}

function parseHHmm(s: string): Date {
  const [h = 0, m = 0] = s.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function toHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmt12(v: string): string {
  const [hStr, mStr] = v.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = mStr ?? '00';
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

export function TimeField({ field, value, onChange }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const date = value ? parseHHmm(value) : new Date();

  const display = value ? fmt12(value) : 'Tap to set time';

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setOpen(true)}
        accessibilityLabel={field.label + (value ? `, current value ${display}` : '')}
        accessibilityRole="button"
      >
        <Text style={styles.clockIcon}>🕐</Text>
        <Text style={[styles.timeText, !value && styles.placeholder]}>{display}</Text>
        {value && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => onChange('')}
            accessibilityLabel="Clear time"
          >
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      {field.helpText ? <Text style={styles.hint}>{field.helpText}</Text> : null}

      <AppDateTimePicker
        visible={open}
        onClose={() => setOpen(false)}
        value={date}
        mode="time"
        title={field.label}
        onChange={(selected) => onChange(toHHmm(selected))}
      />
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  wrapper: { gap: 6 },
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    minHeight: 52,
  },
  clockIcon: { fontSize: 20 },
  timeText: { ...typography.h4, color: palette.text, flex: 1 },
  placeholder: { color: palette.placeholder, fontWeight: '400' },
  clearBtn: { padding: 4 },
  clearText: { ...typography.body, color: palette.textDisabled },
  hint: { ...typography.small, color: palette.textSecondary },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  iosSheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  iosHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: palette.border,
  },
  iosTitle: { ...typography.h4, color: palette.text },
  iosDone: { ...typography.bodyBold, color: palette.primaryText },
}));
