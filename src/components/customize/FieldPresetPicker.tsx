/**
 * FieldPresetPicker — one-tap preset field definitions.
 * Generates a complete FieldDefinition from a named preset.
 * Shown as a modal grid; selecting a preset calls onPick.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable,
  FlatList, StyleSheet,
} from 'react-native';
import { FieldDefinition } from '@lumen/shared';
import { BRISTOL_SCALE, URINE_COLOR } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

export interface Preset {
  key: string;
  label: string;
  emoji: string;
  description: string;
  field: FieldDefinition;
}

export const FIELD_PRESETS: Preset[] = [
  {
    key: 'severity',
    label: 'Severity 0–10',
    emoji: '📊',
    description: 'Slider from None to Worst',
    field: { key: 'severity', label: 'Severity', dataType: 'range', min: 0, max: 10, step: 1, displayAs: 'slider', helpText: 'None,Worst ever', required: false },
  },
  {
    key: 'choice_chips',
    label: 'Type / Sub-type chips',
    emoji: '🏷️',
    description: 'Selectable pill choices (like Digestive: Nausea, Cramps)',
    field: {
      key: 'type',
      label: 'Type',
      dataType: 'enum',
      displayAs: 'chips',
      enumValues: [
        { value: 'option_1', label: 'Option 1' },
        { value: 'option_2', label: 'Option 2' },
        { value: 'option_3', label: 'Option 3' },
      ],
      required: false,
    },
  },
  {
    key: 'amount_ml',
    label: 'Amount (ml)',
    emoji: '💧',
    description: 'ml / L / glass / cup',
    field: { key: 'amount', label: 'Amount', dataType: 'number', unit: 'ml', allowedUnits: ['ml', 'L', 'glass', 'cup', 'oz'], min: 0, max: 5000, step: 50, required: false },
  },
  {
    key: 'duration',
    label: 'Duration',
    emoji: '⏱️',
    description: 'Hours & minutes (or start/stop timer)',
    field: { key: 'duration', label: 'Duration', dataType: 'duration', required: false },
  },
  {
    key: 'photo',
    label: 'Photo',
    emoji: '📷',
    description: 'Camera or library image upload',
    field: { key: 'photo', label: 'Photo', dataType: 'image', required: false },
  },
  {
    key: 'photo_sensitive',
    label: 'Sensitive photo',
    emoji: '🔒',
    description: 'Blurred by default (stool, skin, urine)',
    field: { key: 'photo', label: 'Photo', dataType: 'image', sensitive: true, required: false },
  },
  {
    key: 'time',
    label: 'Time it happened',
    emoji: '🕐',
    description: 'HH:mm time picker',
    field: { key: 'time', label: 'Time', dataType: 'time', captureTime: true, required: false } as FieldDefinition,
  },
  {
    key: 'yes_no',
    label: 'Yes / No',
    emoji: '✅',
    description: 'Toggle switch',
    field: { key: 'value', label: 'Yes / No', dataType: 'boolean', required: false },
  },
  {
    key: 'bristol',
    label: 'Bristol scale',
    emoji: '💩',
    description: 'Types 1–7 with descriptions',
    field: {
      key: 'type', label: 'Bristol type', dataType: 'enum',
      displayAs: 'image-grid', enumValues: BRISTOL_SCALE as FieldDefinition['enumValues'],
      required: false,
    },
  },
  {
    key: 'urine_colour',
    label: 'Urine colour',
    emoji: '🟡',
    description: 'Colour chart 1–10',
    field: {
      key: 'colour', label: 'Colour', dataType: 'enum',
      displayAs: 'color-swatch', enumValues: URINE_COLOR as FieldDefinition['enumValues'],
      required: false,
    },
  },
  {
    key: 'temperature',
    label: 'Temperature (°C)',
    emoji: '🌡️',
    description: '34–42 °C in 0.1 steps',
    field: { key: 'temp', label: 'Temperature', dataType: 'temperature', min: 34, max: 42, step: 0.1, required: false },
  },
  {
    key: 'body_location',
    label: 'Body location (2D)',
    emoji: '🧍',
    description: 'Tappable 2D silhouette for affected areas',
    field: { key: 'location', label: 'Location', dataType: 'location', displayAs: 'body-map', required: false },
  },
  {
    key: 'joint_location_3d',
    label: 'Body joints (3D rotatable)',
    emoji: '🦴',
    description: '360° rotating skeleton & DAS28 joints (Arthritis)',
    field: { key: 'joints', label: 'Joints', dataType: 'location', displayAs: 'joint-map-3d', required: false },
  },
  {
    key: 'chest_location',
    label: 'Chest & ribs location',
    emoji: '🫁',
    description: '8-zone clinical chest map (Costochondritis / Pleurisy)',
    field: { key: 'chest_location', label: 'Chest Location', dataType: 'location', displayAs: 'chest-map', required: false },
  },
  {
    key: 'body_location_3d',
    label: 'Full body map (3D rotatable)',
    emoji: '🧍‍♂️',
    description: '360° interactive 3D human body model',
    field: { key: 'body_location_3d', label: '3D Body Location', dataType: 'location', displayAs: 'body-map-3d', required: false },
  },
  {
    key: 'free_text',
    label: 'Free text / notes',
    emoji: '📝',
    description: 'Open text input',
    field: { key: 'text', label: 'Notes', dataType: 'string', required: false },
  },
  {
    key: 'custom_number',
    label: 'Custom number',
    emoji: '🔢',
    description: 'Number with optional unit',
    field: { key: 'value', label: 'Value', dataType: 'number', required: false },
  },
];

interface Props {
  onPick: (preset: Preset) => void;
}

export function FieldPresetPicker({ onPick }: Props) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Add a value field from preset"
      >
        <Text style={styles.triggerIcon}>＋</Text>
        <Text style={styles.triggerText}>Add value field</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropTouch} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choose a field type</Text>
              <TouchableOpacity onPress={() => setOpen(false)}><Text style={styles.done}>Cancel</Text></TouchableOpacity>
            </View>
            <FlatList
              data={FIELD_PRESETS}
              keyExtractor={p => p.key}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.presetRow}
                  onPress={() => { onPick(item); setOpen(false); }}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <Text style={styles.presetEmoji}>{item.emoji}</Text>
                  <View style={styles.presetText}>
                    <Text style={styles.presetLabel}>{item.label}</Text>
                    <Text style={styles.presetDesc}>{item.description}</Text>
                  </View>
                  <Text style={styles.presetChevron}>›</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const useStyles = createThemedStyles((palette) => ({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: palette.primary + '14',
    borderRadius: 12, borderWidth: 1.5, borderColor: palette.primary + '44',
    paddingHorizontal: 16, paddingVertical: 12, borderStyle: 'dashed',
  },
  triggerIcon: { ...typography.h4, color: palette.primaryText },
  triggerText: { ...typography.bodyBold, color: palette.primaryText },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropTouch: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: palette.border,
  },
  sheetTitle: { ...typography.h4, color: palette.text },
  done: { ...typography.bodyBold, color: palette.primaryText },
  list: { padding: 12, gap: 4, paddingBottom: 40 },
  presetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, backgroundColor: palette.surfaceAlt,
  },
  presetEmoji: { fontSize: 22, width: 32, textAlign: 'center' },
  presetText: { flex: 1 },
  presetLabel: { ...typography.bodyBold, color: palette.text },
  presetDesc: { ...typography.small, color: palette.textSecondary, marginTop: 1 },
  presetChevron: { ...typography.h4, color: palette.textDisabled },
}));
