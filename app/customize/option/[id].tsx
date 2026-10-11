/**
 * Option editor — create or edit an option for a question.
 * Includes inline field definition management (add via presets, edit, remove).
 * Route: /customize/option/new?questionId=X
 *        /customize/option/:id?questionId=X
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Switch, Modal, Pressable,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../../src/utils/navigation';
import { IOption, CaptureTime, FieldDefinition, EnumValue } from '@lumen/shared';
import { useConfigStore } from '../../../src/store/configStore';
import { api } from '../../../src/api/client';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';
import { IconPicker } from '../../../src/components/customize/IconPicker';
import { ColorSwatchPicker } from '../../../src/components/customize/ColorSwatchPicker';
import { FieldPresetPicker, Preset } from '../../../src/components/customize/FieldPresetPicker';
import { LivePreview } from '../../../src/components/customize/LivePreview';

const CAPTURE_OPTIONS: { value: CaptureTime; label: string; desc: string }[] = [
  { value: 'none',       label: 'No time',          desc: 'Do not capture time for this option' },
  { value: 'auto_now',   label: 'Auto (right now)',  desc: 'Records the current time automatically' },
  { value: 'user_picks', label: 'User picks time',   desc: 'Shows a time picker for the user to fill' },
];

type DataTypeGroup = { dataType: FieldDefinition['dataType']; label: string; displayAs?: string };
const DATA_TYPE_LABELS: Record<string, string> = {
  range: 'Severity slider', number: 'Number', temperature: 'Temperature',
  duration: 'Duration', time: 'Time', string: 'Text', boolean: 'Yes/No',
  enum: 'Choice list', image: 'Image', location: 'Body map', datetime: 'Date & time',
};

export default function OptionEditor() {
  const { palette } = useTheme();
  const styles = useStyles();
  const sectionStyles = useSectionStyles();
  const toggleStyles = useToggleStyles();
  const { id, questionId } = useLocalSearchParams<{ id: string; questionId: string }>();
  const isNew = id === 'new';
  const { config, invalidate, fetchConfig } = useConfigStore();

  const existing: IOption | undefined = isNew
    ? undefined
    : config?.options.find(o => o._id === id);

  const [label,        setLabel]        = useState(existing?.label ?? '');
  const [icon,         setIcon]         = useState(existing?.icon ?? '');
  const [color,        setColor]        = useState(existing?.color ?? palette.primary);
  const [allowComment, setAllowComment] = useState(existing?.allowComment ?? false);
  const [captureTime,  setCaptureTime]  = useState<CaptureTime>(existing?.captureTime ?? 'none');
  const [fields,       setFields]       = useState<FieldDefinition[]>(existing?.fields ?? []);
  const [saving,       setSaving]       = useState(false);
  const [editingField, setEditingField] = useState<number | null>(null); // index in fields

  useEffect(() => {
    if (existing) {
      setLabel(existing.label); setIcon(existing.icon ?? '');
      setColor(existing.color ?? palette.primary); setAllowComment(existing.allowComment);
      setCaptureTime(existing.captureTime); setFields([...existing.fields]);
    }
  }, [existing?._id]);

  const qId = questionId ?? existing?.questionId ?? '';

  // ── Field management ────────────────────────────────────────────────────────

  const addFieldFromPreset = (preset: Preset) => {
    // Ensure key is unique by appending a suffix if needed
    let key = preset.field.key;
    while (fields.some(f => f.key === key)) key = key + '_2';
    setFields(prev => [...prev, { ...preset.field, key }]);
  };

  const removeField = (idx: number) => {
    setFields(prev => prev.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, patch: Partial<FieldDefinition>) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!label.trim()) { Alert.alert('Label required', 'Enter an option label.'); return; }
    setSaving(true);
    try {
      const body = {
        questionId: qId, label: label.trim(), icon: icon || undefined,
        color, allowComment, captureTime, fields,
      };
      if (isNew) {
        await api.post('/options', body);
      } else {
        await api.patch(`/options/${id}`, body);
      }
      invalidate(); await fetchConfig();
      safeGoBack('/customize');
    } catch (err: unknown) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally { setSaving(false); }
  };

  const isArchived = existing ? (!existing.isActive || !!existing.archivedAt) : false;

  const handleArchive = () => {
    if (isNew) return;
    Alert.alert(`Archive "${label}"?`, 'Logs with this option are preserved. You can restore it later at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/options/${id}/archive`, {});
            invalidate(); await fetchConfig(); safeGoBack('/customize');
          } catch (err: any) {
            Alert.alert('Archive failed', err?.message || 'Unknown error');
          }
        },
      },
    ]);
  };

  const handleUnarchive = async () => {
    try {
      await api.post(`/options/${id}/unarchive`, {});
      invalidate(); await fetchConfig();
      Alert.alert('Option Restored', `"${label}" is active again.`);
      safeGoBack('/customize');
    } catch (err: any) {
      Alert.alert('Restore failed', err?.message || 'Unknown error');
    }
  };

  const handlePermanentDelete = () => {
    if (isNew) return;
    Alert.alert(
      `Permanently delete "${label}"?`,
      'This action cannot be undone. If tracking entries have been logged for this option, deletion will be blocked to protect your records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently', style: 'destructive',
          onPress: async () => {
            try {
              const res: any = await api.delete(`/options/${id}`);
              invalidate(); await fetchConfig();
              Alert.alert('Deleted', res.message || 'Option deleted permanently.');
              safeGoBack('/customize');
            } catch (err: any) {
              Alert.alert('Cannot Delete', err?.message || 'Error deleting option');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: isNew ? 'New option' : 'Edit option' }} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {isArchived && (
          <View style={styles.archivedNotice}>
            <Text style={styles.archivedNoticeText}>
              📁 This option is currently archived. It will not appear in question forms until restored.
            </Text>
          </View>
        )}

        {/* Live preview */}
        <LivePreview
          label={label || 'Option label'}
          icon={icon}
          color={color}
          fields={fields}
        />

        <SectionHeader title="Appearance" />

        <Field label="Label *">
          <TextInput
            style={styles.input} value={label} onChangeText={setLabel}
            placeholder="e.g. Joint pain, Fatigue, Gluten…"
            placeholderTextColor={palette.placeholder} returnKeyType="done" autoFocus={isNew}
          />
        </Field>

        <Field label="Icon (optional)">
          <IconPicker value={icon} onChange={setIcon} label="Icon" />
        </Field>

        <Field label="Color">
          <ColorSwatchPicker value={color} onChange={setColor} label="Color" />
        </Field>

        <SectionHeader title="Behaviour" />

        <ToggleRow
          label="Allow comment"
          desc="Shows a text box when this option is selected"
          value={allowComment} onChange={setAllowComment}
        />

        <Field label="Capture time">
          {CAPTURE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.radioRow, captureTime === opt.value && styles.radioRowActive]}
              onPress={() => setCaptureTime(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: captureTime === opt.value }}
            >
              <View style={[styles.radio, captureTime === opt.value && styles.radioActive]}>
                {captureTime === opt.value && <View style={styles.radioDot} />}
              </View>
              <View style={styles.radioText}>
                <Text style={styles.radioLabel}>{opt.label}</Text>
                <Text style={styles.radioDesc}>{opt.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Field>

        <SectionHeader title={`Value fields (${fields.length})`} />

        {fields.map((f, idx) => (
          <FieldRow
            key={f.key + idx}
            field={f}
            onEdit={() => setEditingField(idx)}
            onRemove={() => removeField(idx)}
          />
        ))}

        <FieldPresetPicker onPick={addFieldFromPreset} />

        {!isNew && (
          <View style={styles.actionSection}>
            {isArchived ? (
              <TouchableOpacity style={styles.unarchiveBtn} onPress={handleUnarchive} accessibilityRole="button">
                <Text style={styles.unarchiveBtnText}>↺  Restore / Unarchive option</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.archiveBtn} onPress={handleArchive} accessibilityRole="button">
                <Text style={styles.archiveBtnText}>Archive this option</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.deleteBtn} onPress={handlePermanentDelete} accessibilityRole="button">
              <Text style={styles.deleteBtnText}>🗑  Delete permanently</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Inline field editor modal */}
      {editingField !== null && (
        <InlineFieldEditor
          field={fields[editingField]!}
          onSave={(patch) => { updateField(editingField, patch); setEditingField(null); }}
          onClose={() => setEditingField(null)}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={palette.white} /> : <Text style={styles.saveBtnText}>Save option</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  const sectionStyles = useSectionStyles();
  return <Text style={sectionStyles.title}>{title}</Text>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const fieldStyles = useFieldStyles();
  return <View style={fieldStyles.wrapper}><Text style={fieldStyles.label}>{label}</Text>{children}</View>;
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  const { palette } = useTheme();
  const toggleStyles = useToggleStyles();
  return (
    <View style={toggleStyles.row}>
      <View style={toggleStyles.text}><Text style={toggleStyles.label}>{label}</Text><Text style={toggleStyles.desc}>{desc}</Text></View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: palette.border, true: palette.primary + '88' }} thumbColor={value ? palette.primary : palette.textDisabled} />
    </View>
  );
}

function FieldRow({ field, onEdit, onRemove }: { field: FieldDefinition; onEdit: () => void; onRemove: () => void }) {
  const fieldRowStyles = useFieldRowStyles();
  return (
    <View style={fieldRowStyles.row}>
      <TouchableOpacity style={fieldRowStyles.main} onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit field ${field.label}`}>
        <View style={fieldRowStyles.info}>
          <Text style={fieldRowStyles.label}>{field.label}</Text>
          <Text style={fieldRowStyles.type}>{DATA_TYPE_LABELS[field.dataType] ?? field.dataType}{field.unit ? ` · ${field.unit}` : ''}{field.required ? ' · Required' : ''}</Text>
        </View>
        <Text style={fieldRowStyles.edit}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={fieldRowStyles.remove} onPress={onRemove} accessibilityLabel={`Remove field ${field.label}`}>
        <Text style={fieldRowStyles.removeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function InlineFieldEditor({ field, onSave, onClose }: { field: FieldDefinition; onSave: (patch: Partial<FieldDefinition>) => void; onClose: () => void }) {
  const { palette } = useTheme();
  const inlineStyles = useInlineStyles();
  const [label,    setLabel]    = useState(field.label);
  const [key,      setKey]      = useState(field.key);
  const [unit,     setUnit]     = useState(field.unit ?? '');
  const [required, setRequired] = useState(field.required ?? false);
  const [helpText, setHelpText] = useState(field.helpText ?? '');
  const [enumValues, setEnumValues] = useState<EnumValue[]>(field.enumValues ? [...field.enumValues] : []);
  const [newChoiceText, setNewChoiceText] = useState('');

  const addChoice = () => {
    const trimmed = newChoiceText.trim();
    if (!trimmed) return;
    const valKey = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `opt_${Date.now()}`;
    if (enumValues.some(e => e.value === valKey)) {
      Alert.alert('Duplicate choice', 'This choice option already exists.');
      return;
    }
    setEnumValues(prev => [...prev, { value: valKey, label: trimmed }]);
    setNewChoiceText('');
  };

  const removeChoice = (indexToRemove: number) => {
    setEnumValues(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <Modal transparent animationType="slide" visible>
      <View style={inlineStyles.backdrop}>
        <Pressable style={inlineStyles.backdropTouch} onPress={onClose} />
        <View style={inlineStyles.sheet}>
          <View style={inlineStyles.header}>
            <Text style={inlineStyles.title}>Edit field</Text>
            <TouchableOpacity onPress={onClose}><Text style={inlineStyles.cancel}>Cancel</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={inlineStyles.body} keyboardShouldPersistTaps="handled">
            <InlineField label="Label">
              <TextInput style={inlineStyles.input} value={label} onChangeText={setLabel} placeholder="Field label" placeholderTextColor={palette.placeholder} />
            </InlineField>
            <InlineField label="Key (internal, no spaces)">
              <TextInput style={inlineStyles.input} value={key} onChangeText={t => setKey(t.replace(/\s/g, '_').toLowerCase())} placeholder="e.g. severity, amount, type" placeholderTextColor={palette.placeholder} autoCapitalize="none" />
            </InlineField>

            {field.dataType === 'enum' && (
              <InlineField label={`Choices / Chips (${enumValues.length})`}>
                <View style={inlineStyles.chipsWrap}>
                  {enumValues.map((item, idx) => (
                    <View key={item.value + idx} style={inlineStyles.chipPill}>
                      <Text style={inlineStyles.chipPillText}>{item.label}</Text>
                      <TouchableOpacity
                        onPress={() => removeChoice(idx)}
                        style={inlineStyles.chipDeleteBtn}
                        accessibilityLabel={`Remove ${item.label}`}
                      >
                        <Text style={inlineStyles.chipDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <View style={inlineStyles.addChoiceRow}>
                  <TextInput
                    style={[inlineStyles.input, { flex: 1 }]}
                    value={newChoiceText}
                    onChangeText={setNewChoiceText}
                    placeholder="e.g. Nausea, Bloating, Cramps"
                    placeholderTextColor={palette.placeholder}
                    onSubmitEditing={addChoice}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={inlineStyles.addChoiceBtn}
                    onPress={addChoice}
                    disabled={!newChoiceText.trim()}
                  >
                    <Text style={inlineStyles.addChoiceBtnText}>＋ Add</Text>
                  </TouchableOpacity>
                </View>
              </InlineField>
            )}

            {field.dataType !== 'enum' && (
              <InlineField label="Unit (optional)">
                <TextInput style={inlineStyles.input} value={unit} onChangeText={setUnit} placeholder="e.g. ml, °C, km, bpm" placeholderTextColor={palette.placeholder} />
              </InlineField>
            )}

            <InlineField label="Help text (optional)">
              <TextInput style={inlineStyles.input} value={helpText} onChangeText={setHelpText} placeholder="Shown under the field" placeholderTextColor={palette.placeholder} />
            </InlineField>
            <View style={inlineStyles.toggleRow}>
              <Text style={inlineStyles.toggleLabel}>Required</Text>
              <Switch value={required} onValueChange={setRequired} trackColor={{ false: palette.border, true: palette.primary + '88' }} thumbColor={required ? palette.primary : palette.textDisabled} />
            </View>
            <Text style={inlineStyles.typeNote}>Type: {DATA_TYPE_LABELS[field.dataType] ?? field.dataType} (cannot change type after creation)</Text>
          </ScrollView>
          <View style={inlineStyles.footer}>
            <TouchableOpacity
              style={inlineStyles.saveBtn}
              onPress={() => onSave({
                label: label.trim(),
                key: key.trim(),
                unit: unit.trim() || undefined,
                required,
                helpText: helpText.trim() || undefined,
                ...(field.dataType === 'enum' ? { enumValues } : {}),
              })}
            >
              <Text style={inlineStyles.saveBtnText}>Save field</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InlineField({ label, children }: { label: string; children: React.ReactNode }) {
  const fieldStyles = useFieldStyles();
  return <View style={{ gap: 4, marginBottom: 12 }}><Text style={fieldStyles.label}>{label}</Text>{children}</View>;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const useSectionStyles = createThemedStyles((palette) => ({ title: { ...typography.h4, color: palette.text, marginTop: 8 } }));
const useFieldStyles   = createThemedStyles((palette) => ({ wrapper: { gap: 6 }, label: { ...typography.smallBold, color: palette.textSecondary } }));
const useToggleStyles  = createThemedStyles((palette) => ({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  text: { flex: 1 },
  label: { ...typography.body, color: palette.text },
  desc: { ...typography.small, color: palette.textSecondary, marginTop: 2 },
}));
const useFieldRowStyles = createThemedStyles((palette) => ({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  info: { flex: 1 },
  label: { ...typography.bodyBold, color: palette.text },
  type: { ...typography.small, color: palette.textSecondary, marginTop: 1 },
  edit: { ...typography.small, color: palette.primary },
  remove: { paddingHorizontal: 16, paddingVertical: 12, borderLeftWidth: 1, borderLeftColor: palette.border, backgroundColor: palette.surfaceAlt },
  removeText: { ...typography.body, color: palette.error },
}));
const useInlineStyles = createThemedStyles((palette) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropTouch: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border },
  title: { ...typography.h4, color: palette.text },
  cancel: { ...typography.bodyBold, color: palette.primary },
  body: { padding: 16 },
  input: { backgroundColor: palette.surfaceAlt, borderWidth: 1, borderColor: palette.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, ...typography.body, color: palette.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  toggleLabel: { ...typography.body, color: palette.text },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipPillText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
  },
  chipDeleteBtn: {
    padding: 2,
  },
  chipDeleteText: {
    fontSize: 11,
    color: palette.textSecondary,
    fontWeight: '700',
  },
  addChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  addChoiceBtn: {
    backgroundColor: palette.primary + '18',
    borderColor: palette.primary + '40',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addChoiceBtnText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
  },
  typeNote: { ...typography.small, color: palette.textDisabled, marginTop: 8 },
  footer: { padding: 16, paddingBottom: 28, borderTopWidth: 1, borderTopColor: palette.border },
  saveBtn: { backgroundColor: palette.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { ...typography.button, color: palette.white },
}));

const useStyles = createThemedStyles((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 16, gap: 14, paddingBottom: 100 },
  input: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, ...typography.body, color: palette.text, minHeight: 52 },
  radioRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1.5, borderColor: palette.border, padding: 12 },
  radioRowActive: { borderColor: palette.primary, backgroundColor: palette.primary + '08' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioActive: { borderColor: palette.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary },
  radioText: { flex: 1 },
  radioLabel: { ...typography.bodyBold, color: palette.text },
  radioDesc: { ...typography.small, color: palette.textSecondary, marginTop: 1 },
  archivedNotice: {
    backgroundColor: palette.warning + '18',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.warning + '40',
    padding: 14,
  },
  archivedNoticeText: { ...typography.small, color: palette.warning, lineHeight: 18 },
  actionSection: { gap: 10, marginTop: 12 },
  unarchiveBtn: {
    backgroundColor: palette.secondary + '18', borderRadius: 12,
    borderWidth: 1, borderColor: palette.secondary + '60',
    paddingVertical: 14, alignItems: 'center',
  },
  unarchiveBtnText: { ...typography.bodyBold, color: palette.secondary },
  archiveBtn: {
    backgroundColor: palette.warning + '12', borderRadius: 12,
    borderWidth: 1, borderColor: palette.warning + '40',
    paddingVertical: 14, alignItems: 'center',
  },
  archiveBtnText: { ...typography.bodyBold, color: palette.warning },
  deleteBtn: {
    backgroundColor: palette.error + '12', borderRadius: 12,
    borderWidth: 1, borderColor: palette.error + '40',
    paddingVertical: 14, alignItems: 'center',
  },
  deleteBtnText: { ...typography.bodyBold, color: palette.error },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 28, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border },
  saveBtn: { backgroundColor: palette.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', minHeight: 54 },
  disabled: { opacity: 0.6 },
  saveBtnText: { ...typography.button, color: palette.white },
}));
