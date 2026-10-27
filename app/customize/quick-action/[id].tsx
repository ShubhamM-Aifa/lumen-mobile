/**
 * Quick action editor — create or edit a home-screen one-tap button.
 * Mode: counter | timer | toggle
 * Support linking to a Question & Option for in-place flare/symptom logging.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Link2, Unlink, Check, Sparkles } from 'lucide-react-native';
import { safeGoBack } from '../../../src/utils/navigation';
import { useConfigStore } from '../../../src/store/configStore';
import { api } from '../../../src/api/client';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';
import { IconPicker } from '../../../src/components/customize/IconPicker';
import { ColorSwatchPicker } from '../../../src/components/customize/ColorSwatchPicker';
import { QuickActionIcon } from '../../../src/components/QuickActionIcon';

type Mode = 'counter' | 'timer' | 'toggle';

const MODES: { key: Mode; icon: string; label: string; description: string }[] = [
  { key: 'counter', icon: '🔢', label: 'Counter', description: 'Each tap adds 1 (or a custom amount) to a running total' },
  { key: 'timer', icon: '⏱️', label: 'Timer', description: 'First tap starts, second tap stops and records duration' },
  { key: 'toggle', icon: '✅', label: 'Toggle', description: 'On / Off state – shows whether something has happened today' },
];

export default function QuickActionEditorScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { config, fetchConfig, invalidate } = useConfigStore();
  const existing = isNew ? undefined : config?.quickActions?.find(a => a._id === id);

  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('⚡');
  const [color, setColor] = useState(palette.primary);
  const [mode, setMode] = useState<Mode>('counter');
  const [unit, setUnit] = useState('');
  const [defaultValue, setDefaultValue] = useState('1');
  const [dailyGoal, setDailyGoal] = useState('');
  const [saving, setSaving] = useState(false);

  // Linked question and option state
  const [linkedQuestionId, setLinkedQuestionId] = useState<string | null>(null);
  const [linkedOptionId, setLinkedOptionId] = useState<string | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  useEffect(() => { fetchConfig(); }, []);

  useEffect(() => {
    if (!isNew && config) {
      const action = config.quickActions?.find(a => a._id === id);
      if (action) {
        setLabel(action.label);
        setIcon(action.icon ?? '⚡');
        setColor(action.color ?? palette.primary);
        setMode(action.mode as Mode);
        setUnit(action.unit ?? '');
        setDefaultValue(action.defaultValue != null ? String(action.defaultValue) : '1');
        setDailyGoal(action.dailyGoal != null ? String(action.dailyGoal) : '');
        setLinkedQuestionId(action.linkedQuestionId ?? null);
        setLinkedOptionId(action.linkedOptionId ?? null);

        if (action.linkedQuestionId && config.questions) {
          const q = config.questions.find(item => item._id === action.linkedQuestionId);
          if (q) {
            setSelectedCatId(q.categoryId);
          }
        }
      }
    }
  }, [id, config]);

  const activeCategories = config?.categories?.filter(c => c.isActive) ?? [];
  const availableQuestions = config?.questions?.filter(
    q => q.isActive && (!selectedCatId || q.categoryId === selectedCatId)
  ) ?? [];
  const availableOptions = config?.options?.filter(
    o => o.isActive && o.questionId === linkedQuestionId
  ) ?? [];

  const currentLinkedOption = config?.options?.find(o => o._id === linkedOptionId);
  const currentLinkedQuestion = config?.questions?.find(q => q._id === linkedQuestionId);
  const currentLinkedCategory = config?.categories?.find(c => c._id === currentLinkedQuestion?.categoryId);

  const validate = () => {
    if (!label.trim()) { Alert.alert('Name required', 'Give this button a name.'); return false; }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        label: label.trim(), icon, color, mode,
        unit: unit.trim() || undefined,
        defaultValue: defaultValue !== '' ? Number(defaultValue) : undefined,
        dailyGoal: dailyGoal !== '' ? Number(dailyGoal) : undefined,
        linkedQuestionId: linkedQuestionId || null,
        linkedOptionId: linkedOptionId || null,
      };
      if (isNew) {
        await api.post('/quick-actions', body);
      } else {
        await api.patch(`/quick-actions/${id}`, body);
      }
      invalidate(); await fetchConfig();
      router.replace('/customize/quick-actions');
    } finally { setSaving(false); }
  };

  const isArchived = existing ? (!existing.isVisible || !!existing.archivedAt) : false;

  const archive = () => {
    Alert.alert(`Archive "${label}"?`, 'You can restore it later at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/quick-actions/${id}/archive`, {});
            invalidate(); await fetchConfig();
            safeGoBack('/customize/quick-actions');
          } catch (err: any) {
            Alert.alert('Archive failed', err?.message || 'Unknown error');
          }
        },
      },
    ]);
  };

  const handleUnarchive = async () => {
    try {
      await api.post(`/quick-actions/${id}/unarchive`, {});
      invalidate(); await fetchConfig();
      Alert.alert('Button Restored', `"${label}" is active again.`);
      safeGoBack('/customize/quick-actions');
    } catch (err: any) {
      Alert.alert('Restore failed', err?.message || 'Unknown error');
    }
  };

  const handlePermanentDelete = () => {
    if (isNew) return;
    Alert.alert(
      `Permanently delete "${label}"?`,
      'This action cannot be undone. If tracking entries have been logged using this button, deletion will be blocked to protect your records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently', style: 'destructive',
          onPress: async () => {
            try {
              const res: any = await api.delete(`/quick-actions/${id}`);
              invalidate(); await fetchConfig();
              Alert.alert('Deleted', res.message || 'Button deleted permanently.');
              safeGoBack('/customize/quick-actions');
            } catch (err: any) {
              Alert.alert('Cannot Delete', err?.message || 'Error deleting button');
            }
          },
        },
      ],
    );
  };

  const ModeCard = ({ item }: { item: typeof MODES[0] }) => (
    <TouchableOpacity
      style={[styles.modeCard, mode === item.key && { borderColor: color, backgroundColor: color + '14' }]}
      onPress={() => setMode(item.key)}
      accessibilityRole="radio"
      accessibilityState={{ selected: mode === item.key }}
    >
      <Text style={styles.modeIcon}>{item.icon}</Text>
      <View style={styles.modeText}>
        <Text style={[styles.modeName, mode === item.key && { color }]}>{item.label}</Text>
        <Text style={styles.modeDesc}>{item.description}</Text>
      </View>
      <View style={[styles.radioOuter, mode === item.key && { borderColor: color }]}>
        {mode === item.key && <View style={[styles.radioInner, { backgroundColor: color }]} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: isNew ? 'New button' : 'Edit button', headerRight: () => (
        <TouchableOpacity onPress={save} disabled={saving} accessibilityRole="button">
          <Text style={[styles.saveBtn, saving && styles.saveBtnDim]}>Save</Text>
        </TouchableOpacity>
      )}} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isArchived && (
          <View style={styles.archivedNotice}>
            <Text style={styles.archivedNoticeText}>
              📁 This button is currently archived. It will not appear on your home screen until restored.
            </Text>
          </View>
        )}

        {/* Live preview */}
        <View style={styles.previewArea}>
          <View style={[styles.previewBtn, { backgroundColor: color + '1A', borderColor: color + '55' }]}>
            <QuickActionIcon icon={icon} label={label} color={color} size={24} />
            <Text style={[styles.previewLabel, { color }]} numberOfLines={1}>{label || 'Button name'}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Name</Text>
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. Flare now!, Burning, Water"
          placeholderTextColor={palette.textDisabled}
          autoFocus={isNew}
          accessibilityLabel="Button name"
        />

        <Text style={styles.sectionLabel}>Icon</Text>
        <IconPicker value={icon} onChange={setIcon} />

        <Text style={styles.sectionLabel}>Color</Text>
        <ColorSwatchPicker value={color} onChange={setColor} />

        {/* Link to Log Option Section */}
        <View style={styles.linkSectionCard}>
          <View style={styles.linkSectionHeader}>
            <View style={styles.linkHeaderLeft}>
              <View style={[styles.linkIconCircle, { backgroundColor: color + '18' }]}>
                <Link2 size={16} color={color} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkSectionTitle}>Link to Log Option</Text>
                <Text style={styles.linkSectionDesc}>
                  Open an in-place modal on Today to log this symptom or option with body map & notes.
                </Text>
              </View>
            </View>

            {currentLinkedOption && (
              <TouchableOpacity
                style={styles.unlinkBtn}
                onPress={() => {
                  setLinkedOptionId(null);
                  setLinkedQuestionId(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="Unlink option"
              >
                <Unlink size={13} color={palette.errorText} />
                <Text style={styles.unlinkBtnText}>Unlink</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Current Linked Status Banner */}
          {currentLinkedOption && currentLinkedQuestion ? (
            <View style={[styles.linkedActiveCard, { borderColor: color + '40', backgroundColor: color + '0D' }]}>
              <View style={styles.linkedBadgeRow}>
                <View style={styles.linkedPill}>
                  <Text style={styles.linkedPillText}>
                    {currentLinkedCategory?.icon || '📁'} {currentLinkedCategory?.name || 'Category'}
                  </Text>
                </View>
                <Text style={styles.linkedArrow}>→</Text>
                <View style={[styles.linkedPill, { maxWidth: 140 }]}>
                  <Text style={styles.linkedPillText} numberOfLines={1}>
                    {currentLinkedQuestion.title}
                  </Text>
                </View>
                <Text style={styles.linkedArrow}>→</Text>
                <View style={[styles.linkedPillActive, { borderColor: color, backgroundColor: color + '22' }]}>
                  <Text style={[styles.linkedPillActiveText, { color }]}>
                    {currentLinkedOption.icon ? `${currentLinkedOption.icon} ` : ''}
                    {currentLinkedOption.label}
                  </Text>
                </View>
              </View>

              {/* Quick Preset label & icon button */}
              <TouchableOpacity
                style={styles.useOptionDetailsBtn}
                onPress={() => {
                  setLabel(currentLinkedOption.label);
                  if (currentLinkedOption.icon) setIcon(currentLinkedOption.icon);
                }}
              >
                <Sparkles size={12} color={color} />
                <Text style={[styles.useOptionDetailsText, { color }]}>
                  Copy option label ("{currentLinkedOption.label}") to button
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.noLinkHint}>
              Select a category, question, and option below to link this button to an interactive log option.
            </Text>
          )}

          {/* Step 1: Category */}
          <Text style={styles.subStepTitle}>1. Select Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {activeCategories.map(cat => (
              <TouchableOpacity
                key={cat._id}
                style={[
                  styles.catChip,
                  selectedCatId === cat._id && { borderColor: cat.color, backgroundColor: cat.color + '1C' },
                ]}
                onPress={() => {
                  setSelectedCatId(cat._id);
                  if (linkedQuestionId && currentLinkedQuestion?.categoryId !== cat._id) {
                    setLinkedQuestionId(null);
                    setLinkedOptionId(null);
                  }
                }}
              >
                <Text style={styles.catChipIcon}>{cat.icon || '📁'}</Text>
                <Text style={[styles.catChipText, selectedCatId === cat._id && { color: cat.color, fontWeight: '700' }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Step 2: Question */}
          {selectedCatId && (
            <>
              <Text style={styles.subStepTitle}>2. Select Question</Text>
              {availableQuestions.length === 0 ? (
                <Text style={styles.emptyQuestionsText}>No questions found in this category.</Text>
              ) : (
                <View style={styles.questionList}>
                  {availableQuestions.map(q => (
                    <TouchableOpacity
                      key={q._id}
                      style={[
                        styles.questionCard,
                        linkedQuestionId === q._id && { borderColor: palette.primary, backgroundColor: palette.primary + '10' },
                      ]}
                      onPress={() => {
                        setLinkedQuestionId(q._id);
                        if (linkedOptionId && currentLinkedOption?.questionId !== q._id) {
                          setLinkedOptionId(null);
                        }
                      }}
                    >
                      <Text style={[styles.questionCardTitle, linkedQuestionId === q._id && { color: palette.primaryText, fontWeight: '700' }]}>
                        {q.icon ? `${q.icon} ` : ''}{q.title}
                      </Text>
                      {linkedQuestionId === q._id && (
                        <Check size={16} color={palette.primaryText} strokeWidth={2.6} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Step 3: Option */}
          {linkedQuestionId && (
            <>
              <Text style={styles.subStepTitle}>3. Select Option to Link</Text>
              {availableOptions.length === 0 ? (
                <Text style={styles.emptyQuestionsText}>No options configured for this question.</Text>
              ) : (
                <View style={styles.optionsGrid}>
                  {availableOptions.map(opt => (
                    <TouchableOpacity
                      key={opt._id}
                      style={[
                        styles.optionPill,
                        linkedOptionId === opt._id && { borderColor: color, backgroundColor: color + '1A' },
                      ]}
                      onPress={() => {
                        setLinkedOptionId(opt._id);
                        if (!label || label === 'Button name') {
                          setLabel(opt.label);
                          if (opt.icon) setIcon(opt.icon);
                        }
                      }}
                    >
                      {opt.icon ? <Text style={styles.optionPillIcon}>{opt.icon}</Text> : null}
                      <Text style={[styles.optionPillText, linkedOptionId === opt._id && { color, fontWeight: '700' }]}>
                        {opt.label}
                      </Text>
                      {linkedOptionId === opt._id && (
                        <Check size={13} color={color} strokeWidth={2.8} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        <Text style={styles.sectionLabel}>Mode</Text>
        <View style={styles.modeList}>
          {MODES.map(m => <ModeCard key={m.key} item={m} />)}
        </View>

        {mode !== 'toggle' && (
          <>
            <Text style={styles.sectionLabel}>Unit (optional)</Text>
            <TextInput
              style={styles.input}
              value={unit}
              onChangeText={setUnit}
              placeholder="ml, glass, steps, min…"
              placeholderTextColor={palette.textDisabled}
              accessibilityLabel="Unit"
            />

            {mode === 'counter' && (
              <>
                <Text style={styles.sectionLabel}>Amount per tap</Text>
                <TextInput
                  style={styles.input}
                  value={defaultValue}
                  onChangeText={setDefaultValue}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={palette.textDisabled}
                  accessibilityLabel="Amount per tap"
                />
              </>
            )}

            <Text style={styles.sectionLabel}>Daily goal (optional)</Text>
            <TextInput
              style={styles.input}
              value={dailyGoal}
              onChangeText={setDailyGoal}
              keyboardType="numeric"
              placeholder="e.g. 8 (glasses), 10000 (steps)"
              placeholderTextColor={palette.textDisabled}
              accessibilityLabel="Daily goal"
            />
          </>
        )}

        {!isNew && (
          <View style={styles.actionSection}>
            {isArchived ? (
              <TouchableOpacity style={styles.unarchiveBtn} onPress={handleUnarchive} accessibilityRole="button">
                <Text style={styles.unarchiveBtnText}>↺  Restore / Unarchive button</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.archiveBtn} onPress={archive} accessibilityRole="button">
                <Text style={styles.archiveBtnText}>Archive this button</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.deleteBtn} onPress={handlePermanentDelete} accessibilityRole="button">
              <Text style={styles.deleteBtnText}>🗑  Delete permanently</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 20, gap: 6 },
  archivedNotice: {
    backgroundColor: palette.warning + '18',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.warning + '40',
    padding: 14,
    marginBottom: 10,
  },
  archivedNoticeText: { ...typography.small, color: palette.warningText, lineHeight: 18 },
  previewArea: { alignItems: 'center', paddingVertical: 20 },
  previewBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 20, borderWidth: 1.5,
    paddingHorizontal: 24, paddingVertical: 18, minWidth: 100,
  },
  previewIcon: { fontSize: 32 },
  previewLabel: { ...typography.bodyBold, maxWidth: 120 },
  sectionLabel: { ...typography.label, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 4 },
  input: {
    backgroundColor: palette.surface, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 13,
    ...typography.body, color: palette.text,
  },
  modeList: { gap: 8 },
  modeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: palette.surface, borderRadius: 26,
    borderWidth: 1.5, borderColor: palette.border, padding: 14,
  },
  modeIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  modeText: { flex: 1 },
  modeName: { ...typography.bodyBold, color: palette.text },
  modeDesc: { ...typography.small, color: palette.textSecondary, marginTop: 2 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  saveBtn: { ...typography.bodyBold, color: palette.primaryText, paddingHorizontal: 4 },
  saveBtnDim: { opacity: 0.4 },

  // Link Section Card
  linkSectionCard: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 16,
    gap: 12,
    marginTop: 16,
  },
  linkSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  linkHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  linkIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkSectionTitle: {
    ...typography.bodyBold,
    fontSize: 15,
    color: palette.text,
  },
  linkSectionDesc: {
    ...typography.caption,
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 1,
  },
  unlinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: palette.error + '14',
  },
  unlinkBtnText: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: '700',
    color: palette.errorText,
  },
  linkedActiveCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 8,
  },
  linkedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  linkedPill: {
    backgroundColor: palette.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  linkedPillText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
  },
  linkedArrow: {
    fontSize: 13,
    color: palette.textSecondary,
    fontWeight: '700',
  },
  linkedPillActive: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  linkedPillActiveText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
  },
  useOptionDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  useOptionDetailsText: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: '600',
  },
  noLinkHint: {
    ...typography.caption,
    fontSize: 12,
    color: palette.textSecondary,
    fontStyle: 'italic',
  },
  subStepTitle: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: '700',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  catChipIcon: {
    fontSize: 14,
  },
  catChipText: {
    ...typography.caption,
    fontSize: 12.5,
    fontWeight: '600',
    color: palette.text,
  },
  questionList: {
    gap: 6,
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  questionCardTitle: {
    ...typography.body,
    fontSize: 13.5,
    color: palette.text,
    flex: 1,
  },
  emptyQuestionsText: {
    ...typography.caption,
    fontSize: 12,
    color: palette.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  optionPillIcon: {
    fontSize: 15,
  },
  optionPillText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },

  actionSection: { gap: 10, marginTop: 32 },
  unarchiveBtn: {
    backgroundColor: palette.secondary + '18', borderRadius: 12,
    borderWidth: 1, borderColor: palette.secondary + '60',
    paddingVertical: 14, alignItems: 'center',
  },
  unarchiveBtnText: { ...typography.bodyBold, color: palette.secondaryText },
  archiveBtn: {
    backgroundColor: palette.warning + '12', borderRadius: 12,
    borderWidth: 1, borderColor: palette.warning + '40',
    paddingVertical: 14, alignItems: 'center',
  },
  archiveBtnText: { ...typography.bodyBold, color: palette.warningText },
  deleteBtn: {
    backgroundColor: palette.error + '12', borderRadius: 12,
    borderWidth: 1, borderColor: palette.error + '40',
    paddingVertical: 14, alignItems: 'center',
  },
  deleteBtnText: { ...typography.bodyBold, color: palette.errorText },
}));
