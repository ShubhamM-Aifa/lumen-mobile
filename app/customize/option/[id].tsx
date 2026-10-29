/**
 * Option Editor Screen — Apple InsetGroup style
 * Route: /customize/option/new?questionId=X
 *        /customize/option/:id?questionId=X
 * Includes appearance, time capture rules, field definitions, and presets.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Check, Plus, Trash2, Edit3, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { IOption, CaptureTime, FieldDefinition, EnumValue } from '@lumen/shared';
import { useConfigStore } from '../../../src/store/configStore';
import { api } from '../../../src/api/client';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';
import { ScreenTopBar, HeaderTextButton } from '../../../src/components/ios/ScreenTopBar';
import { InsetGroup, GroupedRow, IconTile } from '../../../src/components/ios/InsetGroup';
import { IconPicker } from '../../../src/components/customize/IconPicker';
import { ColorSwatchPicker } from '../../../src/components/customize/ColorSwatchPicker';
import { FieldPresetPicker, Preset } from '../../../src/components/customize/FieldPresetPicker';
import { DraggableValueFieldsList } from '../../../src/components/customize/DraggableValueFieldsList';
import { LivePreview } from '../../../src/components/customize/LivePreview';
import { safeGoBack } from '../../../src/utils/navigation';

const CAPTURE_OPTIONS: Array<{ value: CaptureTime; label: string; desc: string }> = [
  { value: 'none', label: 'No time', desc: 'Do not capture time for this option' },
  { value: 'user_picks', label: 'User picks time', desc: 'Shows a time picker for the user to fill' },
];

export default function OptionEditorScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { id, questionId } = useLocalSearchParams<{ id: string; questionId: string }>();
  const isNew = id === 'new';
  const { config, invalidate, fetchConfig } = useConfigStore();

  const existing: IOption | undefined = isNew
    ? undefined
    : config?.options.find((o) => o._id === id);

  const normalizeCaptureTime = (ct?: CaptureTime): CaptureTime => {
    if (!ct || ct === 'none') return 'none';
    return 'user_picks';
  };

  const [label, setLabel] = useState(existing?.label ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '');
  const [color, setColor] = useState(existing?.color ?? '#007AFF');
  const [allowComment, setAllowComment] = useState(existing?.allowComment ?? false);
  const [captureTime, setCaptureTime] = useState<CaptureTime>(normalizeCaptureTime(existing?.captureTime));
  const [fields, setFields] = useState<FieldDefinition[]>(existing?.fields ?? []);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<number | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    if (existing) {
      setLabel(existing.label);
      setIcon(existing.icon ?? '');
      setColor(existing.color ?? '#007AFF');
      setAllowComment(existing.allowComment);
      setCaptureTime(normalizeCaptureTime(existing.captureTime));
      setFields([...existing.fields]);
    }
  }, [existing?._id]);

  const qId = questionId ?? existing?.questionId ?? '';

  const addFieldFromPreset = (preset: Preset) => {
    Haptics.selectionAsync();
    let key = preset.field.key;
    while (fields.some((f) => f.key === key)) key = key + '_2';
    setFields((prev) => [...prev, { ...preset.field, key }]);
  };

  const removeField = (idx: number) => {
    Haptics.selectionAsync();
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, patch: Partial<FieldDefinition>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const handleSave = async () => {
    if (!label.trim()) {
      Alert.alert('Label Required', 'Please enter an option label.');
      return;
    }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const body = {
        questionId: qId,
        label: label.trim(),
        icon: icon || undefined,
        color,
        allowComment,
        captureTime: normalizeCaptureTime(captureTime),
        fields,
      };

      if (isNew) {
        await api.post('/options', body);
      } else {
        await api.patch(`/options/${id}`, body);
      }
      invalidate();
      await fetchConfig();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      safeGoBack(`/customize/options/${qId}`);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Unable to save option.');
    } finally {
      setSaving(false);
    }
  };

  const isArchived = existing ? (!existing.isActive || !!existing.archivedAt) : false;

  const handleArchive = () => {
    if (isNew) return;
    Alert.alert(`Archive "${label}"?`, 'Existing logs are preserved. You can restore it later at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          await api.post(`/options/${id}/archive`, {});
          invalidate();
          await fetchConfig();
          safeGoBack(`/customize/options/${qId}`);
        },
      },
    ]);
  };

  const handleUnarchive = async () => {
    try {
      await api.post(`/options/${id}/unarchive`, {});
      invalidate();
      await fetchConfig();
      safeGoBack(`/customize/options/${qId}`);
    } catch (err: any) {
      Alert.alert('Restore Failed', err?.message || 'Unknown error');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenTopBar
        title={isNew ? 'New Option' : 'Edit Option'}
        backLabel="Cancel"
        onBack={() => safeGoBack(`/customize/options/${qId}`)}
        fallbackRoute={`/customize/options/${qId}`}
        right={
          <HeaderTextButton
            label="Save"
            prominent
            onPress={handleSave}
            loading={saving}
            disabled={saving}
          />
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView scrollEnabled={scrollEnabled} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Live Preview */}
          <View style={styles.previewContainer}>
            <LivePreview
              label={label || 'Option label'}
              icon={icon}
              color={color}
              fields={fields}
              captureTime={captureTime}
              allowComment={allowComment}
            />
          </View>

          {/* Appearance InsetGroup */}
          <InsetGroup title="Appearance">
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Label</Text>
              <TextInput
                style={[styles.fieldInput, { color: palette.text }]}
                value={label}
                onChangeText={setLabel}
                placeholder="e.g. Joint pain, Fatigue, Gluten"
                placeholderTextColor={palette.placeholder}
                autoFocus={isNew}
              />
            </View>

            <View style={styles.iconRow}>
              <View style={styles.iconPreviewWrap}>
                <IconTile emoji={icon || undefined} color={color} size={36} />
                <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Icon (optional)</Text>
              </View>
              <IconPicker value={icon} onChange={setIcon} />
            </View>
          </InsetGroup>

          {/* Color Swatches InsetGroup */}
          <InsetGroup title="Color">
            <View style={styles.colorWrap}>
              <ColorSwatchPicker value={color} onChange={setColor} />
            </View>
          </InsetGroup>

          {/* Behaviour InsetGroup */}
          <InsetGroup title="Behaviour">
            <GroupedRow
              label="Allow Comment"
              sub="Shows a free-text box when this option is selected"
              toggle
              toggled={allowComment}
              onToggle={setAllowComment}
            />
          </InsetGroup>

          {/* Capture Time InsetGroup */}
          <InsetGroup title="Capture time" footer="Controls whether a timestamp is saved when this option is logged.">
            {CAPTURE_OPTIONS.map((opt) => {
              const isSelected = captureTime === opt.value;
              return (
                <GroupedRow
                  key={opt.value}
                  label={opt.label}
                  sub={opt.desc}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCaptureTime(opt.value);
                  }}
                  trailing={isSelected ? <Check size={18} color={palette.primary} strokeWidth={2.5} /> : null}
                />
              );
            })}
          </InsetGroup>

          {/* Value Fields InsetGroup */}
          <InsetGroup
            title={`Value fields (${fields.length})`}
            footer="Add extra measurements (sliders, body map, numbers) to capture when logging this option."
          >
            <DraggableValueFieldsList
              fields={fields}
              onReorder={(newFields) => setFields(newFields)}
              onEditField={(index) => setEditingField(index)}
              onRemoveField={(index) => removeField(index)}
              onDragStateChange={(isDragging) => setScrollEnabled(!isDragging)}
            />
            <View style={styles.presetSection}>
              <Text style={[styles.presetTitle, { color: palette.textSecondary }]}>Add from Presets:</Text>
              <FieldPresetPicker onPick={addFieldFromPreset} />
            </View>
          </InsetGroup>

          {/* Archive / Restore Action */}
          {!isNew && (
            <InsetGroup>
              {isArchived ? (
                <GroupedRow
                  label="Restore this option"
                  valueColor={palette.primary}
                  onPress={handleUnarchive}
                />
              ) : (
                <GroupedRow
                  label="Archive this option"
                  destructive
                  onPress={handleArchive}
                />
              )}
            </InsetGroup>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Field Editor Modal (preserved from original) */}
      {editingField !== null && fields[editingField] && (
        <FieldEditModal
          field={fields[editingField]}
          onSave={(updated) => {
            updateField(editingField, updated);
            setEditingField(null);
          }}
          onClose={() => setEditingField(null)}
        />
      )}
    </SafeAreaView>
  );
}

interface FieldEditModalProps {
  field: FieldDefinition;
  onSave: (field: FieldDefinition) => void;
  onClose: () => void;
}

function FieldEditModal({ field, onSave, onClose }: FieldEditModalProps) {
  const { palette } = useTheme();
  const styles = useStyles();
  const [label, setLabel] = useState(field.label);
  const [unit, setUnit] = useState(field.unit ?? '');
  const [required, setRequired] = useState(field.required ?? false);

  const save = () => {
    if (!label.trim()) {
      Alert.alert('Label Required');
      return;
    }
    onSave({ ...field, label: label.trim(), unit: unit.trim() || undefined, required });
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheetCard, { backgroundColor: palette.background }]}>
          <ScreenTopBar
            title={`Edit ${field.label}`}
            backLabel="Cancel"
            backIcon="close"
            onBack={onClose}
            sheet
            right={<HeaderTextButton label="Done" prominent onPress={save} />}
          />
          <View style={{ paddingTop: 16, gap: 16 }}>
            <InsetGroup>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Field Label</Text>
                <TextInput
                  style={[styles.fieldInput, { color: palette.text }]}
                  value={label}
                  onChangeText={setLabel}
                />
              </View>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Unit (optional)</Text>
                <TextInput
                  style={[styles.fieldInput, { color: palette.text }]}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="e.g. ml, mg, /10"
                  placeholderTextColor={palette.placeholder}
                />
              </View>
            </InsetGroup>

            <InsetGroup>
              <GroupedRow
                label="Required Field"
                toggle
                toggled={required}
                onToggle={setRequired}
              />
            </InsetGroup>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = createThemedStyles((palette) => ({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    paddingTop: 8,
    paddingBottom: 40,
    gap: 16,
  },
  previewContainer: {
    marginHorizontal: 16,
  },
  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  fieldLabel: {
    ...typography.caption1,
    fontWeight: '500',
  },
  fieldInput: {
    ...typography.bodyLarge,
    fontSize: 17,
    padding: 0,
  },
  iconRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  iconPreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorWrap: {
    padding: 16,
  },
  presetSection: {
    padding: 14,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  presetTitle: {
    ...typography.caption1,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 36,
    overflow: 'hidden',
  },
}));
