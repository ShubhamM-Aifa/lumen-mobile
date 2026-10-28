/**
 * LivePreview — shows how an option will look in the log flow.
 * Used at the top of the option editor to give instant feedback.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { FieldDefinition, CaptureTime } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

const DATA_TYPE_LABELS: Record<string, string> = {
  range: '◼◼◼◻◻ Slider', number: '− 0 ＋', temperature: '37.0 °C',
  duration: '0h 0m', time: '12:00 PM', string: 'Type here…',
  boolean: 'Yes / No', enum: 'Option A · Option B', image: '📷 Photo',
  location: '🧍 Body map', datetime: 'Date & time',
};

interface Props {
  label: string;
  icon?: string;
  color?: string;
  fields: FieldDefinition[];
  captureTime?: CaptureTime;
  allowComment?: boolean;
}

export function LivePreview({ label, icon, color, fields, captureTime, allowComment }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const accentColor = color ?? palette.primary;
  const hasExpandedContent =
    fields.length > 0 ||
    captureTime === 'user_picks' ||
    captureTime === 'auto_now' ||
    allowComment;

  return (
    <View style={[styles.card, { borderColor: accentColor + '44' }]}>
      <View style={styles.header}>
        <Text style={styles.previewTag}>Preview</Text>
      </View>

      {/* Option button preview */}
      <View style={[styles.optionBtn, { borderColor: accentColor, backgroundColor: accentColor + '12' }]}>
        {icon ? <Text style={styles.optionIcon}>{icon}</Text>
          : <View style={[styles.optionDot, { backgroundColor: accentColor }]} />}
        <Text style={[styles.optionLabel, { color: accentColor }]}>{label}</Text>
        <View style={[styles.checkbox, { backgroundColor: accentColor, borderColor: accentColor }]}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
      </View>

      {/* Field / Time / Comment previews */}
      {hasExpandedContent && (
        <View style={[styles.fieldsArea, { borderColor: accentColor + '33' }]}>
          {captureTime === 'user_picks' && (
            <View style={styles.fieldPreviewRow}>
              <Text style={styles.fieldPreviewLabel}>Time it happened</Text>
              <Text style={styles.fieldPreviewWidget}>🕒 12:00 PM</Text>
            </View>
          )}
          {captureTime === 'auto_now' && (
            <View style={styles.fieldPreviewRow}>
              <Text style={styles.fieldPreviewLabel}>Auto-timestamp</Text>
              <Text style={styles.fieldPreviewWidget}>⚡ Recorded at log time</Text>
            </View>
          )}
          {fields.map((f, i) => (
            <View key={f.key + i} style={styles.fieldPreviewRow}>
              <Text style={styles.fieldPreviewLabel}>{f.label}{f.required ? ' *' : ''}</Text>
              <Text style={styles.fieldPreviewWidget}>{DATA_TYPE_LABELS[f.dataType] ?? f.dataType}</Text>
            </View>
          ))}
          {allowComment && (
            <View style={styles.fieldPreviewRow}>
              <Text style={styles.fieldPreviewLabel}>Comment</Text>
              <Text style={styles.fieldPreviewWidget}>Optional note…</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  card: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 16, borderWidth: 1.5,
    padding: 14, gap: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'flex-end' },
  previewTag: {
    ...typography.caption, color: palette.textDisabled,
    textTransform: 'uppercase', letterSpacing: 0.5,
    backgroundColor: palette.border,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1.5, padding: 12,
  },
  optionIcon: { fontSize: 18 },
  optionDot: { width: 10, height: 10, borderRadius: 5 },
  optionLabel: { ...typography.bodyBold, flex: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  checkmark: { ...typography.caption, color: palette.white, fontWeight: '800' },
  fieldsArea: {
    borderWidth: 1, borderTopWidth: 0,
    marginTop: -10, paddingTop: 16,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    paddingHorizontal: 12, paddingBottom: 10,
    backgroundColor: palette.background,
    gap: 8,
  },
  fieldPreviewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  fieldPreviewLabel: { ...typography.small, color: palette.textSecondary },
  fieldPreviewWidget: { ...typography.small, color: palette.textDisabled },
}));
