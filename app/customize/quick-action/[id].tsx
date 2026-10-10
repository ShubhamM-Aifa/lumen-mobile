/**
 * Quick action editor — create or edit a home-screen one-tap button.
 * Mode: counter | timer | toggle
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
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
      }
    }
  }, [id, config]);

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
          placeholder="e.g. Water, Walked, Medication"
          placeholderTextColor={palette.textDisabled}
          autoFocus={isNew}
          accessibilityLabel="Button name"
        />

        <Text style={styles.sectionLabel}>Icon</Text>
        <IconPicker value={icon} onChange={setIcon} />

        <Text style={styles.sectionLabel}>Color</Text>
        <ColorSwatchPicker value={color} onChange={setColor} />

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
  archivedNoticeText: { ...typography.small, color: palette.warning, lineHeight: 18 },
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
    backgroundColor: palette.surface, borderRadius: 12,
    borderWidth: 1, borderColor: palette.border,
    paddingHorizontal: 16, paddingVertical: 13,
    ...typography.body, color: palette.text,
  },
  modeList: { gap: 8 },
  modeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: palette.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: palette.border, padding: 14,
  },
  modeIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  modeText: { flex: 1 },
  modeName: { ...typography.bodyBold, color: palette.text },
  modeDesc: { ...typography.small, color: palette.textSecondary, marginTop: 2 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  saveBtn: { ...typography.bodyBold, color: palette.primary, paddingHorizontal: 4 },
  saveBtnDim: { opacity: 0.4 },
  actionSection: { gap: 10, marginTop: 32 },
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
}));
