/**
 * Question editor — create or edit a question.
 * Route: /customize/question/new?categoryId=X
 *        /customize/question/:id?categoryId=X
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Switch, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeGoBack } from '../../../src/utils/navigation';
import { IQuestion, QuestionFrequency, SelectionType } from '@lumen/shared';
import { useConfigStore } from '../../../src/store/configStore';
import { api } from '../../../src/api/client';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';
import { IconPicker } from '../../../src/components/customize/IconPicker';
import { useKeyboard } from '../../../src/hooks/useKeyboard';

const FREQ_OPTIONS: { value: QuestionFrequency; label: string }[] = [
  { value: 'anytime',     label: 'Any time' },
  { value: 'once_per_day',label: 'Once per day' },
  { value: 'per_meal',    label: 'Per meal' },
  { value: 'morning',     label: 'Morning only' },
  { value: 'evening',     label: 'Evening only' },
];

export default function QuestionEditor() {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useStyles();
  const { isKeyboardVisible } = useKeyboard();
  const { id, categoryId } = useLocalSearchParams<{ id: string; categoryId: string }>();
  const isNew = id === 'new';
  const { config, invalidate, fetchConfig } = useConfigStore();

  const existing: IQuestion | undefined = isNew
    ? undefined
    : config?.questions.find(q => q._id === id);

  const [title,      setTitle]      = useState(existing?.title ?? '');
  const [helpText,   setHelpText]   = useState(existing?.helpText ?? '');
  const [icon,       setIcon]       = useState(existing?.icon ?? '');
  const [selType,    setSelType]    = useState<SelectionType>(existing?.selectionType ?? 'single');
  const [allowOther, setAllowOther] = useState(existing?.allowOther ?? false);
  const [required,   setRequired]   = useState(existing?.required ?? false);
  const [frequency,  setFrequency]  = useState<QuestionFrequency>(existing?.frequency ?? 'anytime');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title); setHelpText(existing.helpText ?? '');
      setIcon(existing.icon ?? ''); setSelType(existing.selectionType);
      setAllowOther(existing.allowOther); setRequired(existing.required);
      setFrequency(existing.frequency);
    }
  }, [existing?._id]);

  const catId = categoryId ?? existing?.categoryId ?? '';

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Title required', 'Enter a question title.'); return; }
    setSaving(true);
    try {
      const body = {
        categoryId: catId, title: title.trim(), helpText: helpText.trim() || undefined,
        icon: icon || undefined, selectionType: selType,
        allowOther, required, frequency,
      };
      if (isNew) {
        await api.post('/questions', body);
      } else {
        await api.patch(`/questions/${id}`, body);
      }
      invalidate(); await fetchConfig();
      // After saving, go to the options list for this question
      if (isNew) {
        // Navigate back to questions list for category
        router.replace(`/customize/questions/${catId}`);
      } else {
        router.push(`/customize/options/${id}`);
      }
    } catch (err: unknown) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally { setSaving(false); }
  };

  const isArchived = existing ? (!existing.isActive || !!existing.archivedAt) : false;

  const handleArchive = () => {
    if (isNew) return;
    Alert.alert(`Archive "${title}"?`, 'Existing log entries are preserved. You can restore it later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/questions/${id}/archive`, {});
            invalidate(); await fetchConfig();
            safeGoBack('/customize');
          } catch (err: any) {
            Alert.alert('Archive failed', err?.message || 'Unknown error');
          }
        },
      },
    ]);
  };

  const handleUnarchive = async () => {
    try {
      await api.post(`/questions/${id}/unarchive`, {});
      invalidate(); await fetchConfig();
      Alert.alert('Question Restored', `"${title}" is active again.`);
      safeGoBack('/customize');
    } catch (err: any) {
      Alert.alert('Restore failed', err?.message || 'Unknown error');
    }
  };

  const handlePermanentDelete = () => {
    if (isNew) return;
    Alert.alert(
      `Permanently delete "${title}"?`,
      'This action cannot be undone. If tracking entries have been logged for this question, deletion will be blocked to protect your records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently', style: 'destructive',
          onPress: async () => {
            try {
              const res: any = await api.delete(`/questions/${id}`);
              invalidate(); await fetchConfig();
              Alert.alert('Deleted', res.message || 'Question deleted permanently.');
              safeGoBack('/customize');
            } catch (err: any) {
              Alert.alert('Cannot Delete', err?.message || 'Error deleting question');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Stack.Screen options={{ title: isNew ? 'New question' : 'Edit question' }} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >

        {isArchived && (
          <View style={styles.archivedNotice}>
            <Text style={styles.archivedNoticeText}>
              📁 This question is currently archived. It will not appear in tracking forms until restored.
            </Text>
          </View>
        )}

        <Field label="Question title *">
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. How severe is the pain?"
            placeholderTextColor={palette.placeholder}
            returnKeyType="done"
            autoFocus={isNew}
          />
        </Field>

        <Field label="Help text (optional)">
          <TextInput
            style={[styles.input, { minHeight: 64 }]}
            value={helpText}
            onChangeText={setHelpText}
            placeholder="Short description shown under the question"
            placeholderTextColor={palette.placeholder}
            multiline
          />
        </Field>

        <Field label="Icon (optional)">
          <IconPicker value={icon} onChange={setIcon} label="Icon" />
        </Field>

        <Field label="Selection type">
          <View style={styles.segmentRow}>
            {(['single', 'multiple'] as SelectionType[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.segment, selType === t && styles.segmentActive]}
                onPress={() => setSelType(t)}
                accessibilityRole="radio"
                accessibilityLabel={t === 'single' ? 'Single select' : 'Multi select'}
                accessibilityState={{ checked: selType === t }}
              >
                <Text style={[styles.segmentText, selType === t && styles.segmentTextActive]}>
                  {t === 'single' ? 'One answer' : 'Multiple answers'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Frequency">
          <View style={styles.chipRow}>
            {FREQ_OPTIONS.map(f => (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, frequency === f.value && styles.chipActive]}
                onPress={() => setFrequency(f.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: frequency === f.value }}
              >
                <Text style={[styles.chipText, frequency === f.value && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <ToggleRow label="Required" desc="Users must answer this before submitting" value={required} onChange={setRequired} />
        <ToggleRow label="Allow 'Other' answer" desc="Shows a free-text box for unlisted options" value={allowOther} onChange={setAllowOther} />

        {!isNew && (
          <TouchableOpacity
            style={styles.optionsLink}
            onPress={() => router.push(`/customize/options/${id}`)}
            accessibilityRole="button"
          >
            <Text style={styles.optionsLinkText}>🗂  Manage options →</Text>
          </TouchableOpacity>
        )}

        {!isNew && (
          <View style={styles.actionSection}>
            {isArchived ? (
              <TouchableOpacity style={styles.unarchiveBtn} onPress={handleUnarchive} accessibilityRole="button">
                <Text style={styles.unarchiveBtnText}>↺  Restore / Unarchive question</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.archiveBtn} onPress={handleArchive} accessibilityRole="button">
                <Text style={styles.archiveBtnText}>Archive this question</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.deleteBtn} onPress={handlePermanentDelete} accessibilityRole="button">
              <Text style={styles.deleteBtnText}>🗑  Delete permanently</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 84 + Math.max(insets.bottom, 16) }} />
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: isKeyboardVisible
              ? 8
              : (Platform.OS === 'android' ? Math.max(insets.bottom, 24) : Math.max(insets.bottom, 16)),
          },
        ]}
      >
        <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={palette.white} /> : <Text style={styles.saveBtnText}>Save question</Text>}
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const fieldStyles = useFieldStyles();
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  const { palette } = useTheme();
  const toggleStyles = useToggleStyles();
  return (
    <View style={toggleStyles.row}>
      <View style={toggleStyles.text}>
        <Text style={toggleStyles.label}>{label}</Text>
        <Text style={toggleStyles.desc}>{desc}</Text>
      </View>
      <Switch
        value={value} onValueChange={onChange}
        trackColor={{ false: palette.border, true: palette.primary + '88' }}
        thumbColor={value ? palette.primary : palette.textDisabled}
      />
    </View>
  );
}

const useFieldStyles = createThemedStyles((palette) => ({
  wrapper: { gap: 6 },
  label: { ...typography.smallBold, color: palette.textSecondary },
}));

const useToggleStyles = createThemedStyles((palette) => ({
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: palette.surface, borderRadius: 12,
    borderWidth: 1, borderColor: palette.border,
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  text: { flex: 1 },
  label: { ...typography.body, color: palette.text },
  desc: { ...typography.small, color: palette.textSecondary, marginTop: 2 },
}));

const useStyles = createThemedStyles((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 16, gap: 16, paddingBottom: 100 },
  input: {
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    ...typography.body, color: palette.text, minHeight: 52,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceAlt, borderRadius: 12, padding: 3, gap: 3,
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: palette.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  segmentText: { ...typography.smallBold, color: palette.textSecondary },
  segmentTextActive: { color: palette.primary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: palette.border, backgroundColor: palette.surface,
  },
  chipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  chipText: { ...typography.small, color: palette.text },
  chipTextActive: { color: palette.white, fontWeight: '600' },
  optionsLink: {
    backgroundColor: palette.surfaceAlt, borderRadius: 12,
    borderWidth: 1, borderColor: palette.border,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  optionsLinkText: { ...typography.bodyBold, color: palette.primary },
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
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 28, backgroundColor: palette.surface,
    borderTopWidth: 1, borderTopColor: palette.border,
  },
  saveBtn: {
    backgroundColor: palette.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', minHeight: 54,
  },
  disabled: { opacity: 0.6 },
  saveBtnText: { ...typography.button, color: palette.white },
}));
