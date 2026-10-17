/**
 * Category editor — create or edit a category.
 * Route: /customize/category/new  (create)
 *        /customize/category/:id  (edit)
 * After save, navigates to the category's questions list.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ICategory, CategoryRole } from '@lumen/shared';
import { useConfigStore } from '../../../src/store/configStore';
import { api } from '../../../src/api/client';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';
import { IconPicker } from '../../../src/components/customize/IconPicker';
import { ColorSwatchPicker } from '../../../src/components/customize/ColorSwatchPicker';

const ROLES: { value: CategoryRole; label: string; desc: string }[] = [
  { value: 'trigger_candidate', label: 'Trigger / Activity', desc: 'Used to find what correlates with symptoms' },
  { value: 'symptom',          label: 'Symptom',            desc: 'Tracked as health outcomes in analytics' },
  { value: 'context',          label: 'Context',            desc: 'Background info; not correlated' },
];

export default function CategoryEditor() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { config, invalidate, fetchConfig } = useConfigStore();

  const existing: ICategory | undefined = isNew
    ? undefined
    : config?.categories.find(c => c._id === id);

  const [name,   setName]   = useState(existing?.name  ?? '');
  const [icon,   setIcon]   = useState(existing?.icon  ?? '📋');
  const [color,  setColor]  = useState(existing?.color ?? '#FF6B35');
  const [role,   setRole]   = useState<CategoryRole>(existing?.role ?? 'trigger_candidate');
  const [saving, setSaving] = useState(false);

  // Sync state if config loads after mount
  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setIcon(existing.icon);
      setColor(existing.color);
      setRole(existing.role);
    }
  }, [existing?._id]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter a category name.'); return; }
    setSaving(true);
    try {
      const body = { name: name.trim(), icon, color, role };
      if (isNew) {
        await api.post('/categories', body);
      } else {
        await api.patch(`/categories/${id}`, body);
      }
      invalidate(); await fetchConfig();
      if (isNew) {
        router.replace('/customize/categories');
      } else {
        // Navigate to the questions for this category
        router.push(`/customize/questions/${id}`);
      }
    } catch (err: unknown) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const isArchived = existing ? (!existing.isActive || !!existing.archivedAt) : false;

  const handleArchive = () => {
    if (isNew) return;
    Alert.alert(
      `Archive "${name}"?`,
      'Logs linked to this category are preserved. Archived categories can be restored at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive', style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/categories/${id}/archive`, {});
              invalidate(); await fetchConfig();
              router.replace('/customize/categories');
            } catch (err: any) {
              Alert.alert('Archive failed', err?.message || 'Unknown error');
            }
          },
        },
      ],
    );
  };

  const handleUnarchive = async () => {
    try {
      await api.post(`/categories/${id}/unarchive`, {});
      invalidate(); await fetchConfig();
      Alert.alert('Category Restored', `"${name}" is active again.`);
      router.replace('/customize/categories');
    } catch (err: any) {
      Alert.alert('Restore failed', err?.message || 'Unknown error');
    }
  };

  const handlePermanentDelete = () => {
    if (isNew) return;
    Alert.alert(
      `Permanently delete "${name}"?`,
      'This will remove the category and unlogged questions. If this category already has tracking history, it cannot be deleted to preserve your records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently', style: 'destructive',
          onPress: async () => {
            try {
              const res: any = await api.delete(`/categories/${id}`);
              invalidate(); await fetchConfig();
              Alert.alert('Deleted', res.message || 'Category deleted permanently.');
              router.replace('/customize/categories');
            } catch (err: any) {
              Alert.alert('Cannot Delete', err?.message || 'Error deleting category');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: isNew ? 'New category' : 'Edit category' }} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {isArchived && (
          <View style={styles.archivedNotice}>
            <Text style={styles.archivedNoticeText}>
              📁 This category is currently archived. It will not show up in daily logging until restored.
            </Text>
          </View>
        )}

        {/* Preview badge */}
        <View style={[styles.previewBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
          <Text style={styles.previewIcon}>{icon}</Text>
          <Text style={[styles.previewName, { color }]}>{name || 'Category name'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Joint Pain, Food & Drink…"
            placeholderTextColor={palette.placeholder}
            returnKeyType="done"
            autoFocus={isNew}
            accessibilityLabel="Category name"
          />
        </View>

        <View style={styles.section}>
          <IconPicker value={icon} onChange={setIcon} label="Icon" />
        </View>

        <View style={styles.section}>
          <ColorSwatchPicker value={color} onChange={setColor} label="Color" />
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Role in analytics</Text>
          {ROLES.map(r => (
            <TouchableOpacity
              key={r.value}
              style={[styles.roleCard, role === r.value && styles.roleCardActive]}
              onPress={() => setRole(r.value)}
              accessibilityRole="radio"
              accessibilityLabel={r.label}
              accessibilityState={{ checked: role === r.value }}
            >
              <View style={[styles.roleRadio, role === r.value && styles.roleRadioActive]}>
                {role === r.value && <View style={styles.roleRadioDot} />}
              </View>
              <View style={styles.roleText}>
                <Text style={[styles.roleLabel, role === r.value && { color: palette.primary }]}>
                  {r.label}
                </Text>
                <Text style={styles.roleDesc}>{r.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {!isNew && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.questionsLink}
              onPress={() => router.push(`/customize/questions/${id}`)}
              accessibilityRole="button"
            >
              <Text style={styles.questionsLinkText}>📋  Manage questions →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.questionsLink,
                {
                  marginTop: 10,
                  borderColor: palette.primary + '50',
                  backgroundColor: palette.primary + '0C',
                },
              ]}
              onPress={() => router.push('/customize/templates')}
              accessibilityRole="button"
            >
              <Text style={[styles.questionsLinkText, { color: palette.primary }]}>
                🌍  Publish or Browse Community Templates →
              </Text>
            </TouchableOpacity>
          </View>
        )}


        {!isNew && (
          <View style={styles.actionSection}>
            {isArchived ? (
              <TouchableOpacity style={styles.unarchiveBtn} onPress={handleUnarchive} accessibilityRole="button">
                <Text style={styles.unarchiveBtnText}>↺  Restore / Unarchive category</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.archiveBtn} onPress={handleArchive} accessibilityRole="button">
                <Text style={styles.archiveBtnText}>Archive this category</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.deleteBtn} onPress={handlePermanentDelete} accessibilityRole="button">
              <Text style={styles.deleteBtnText}>🗑  Delete permanently</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save"
        >
          {saving
            ? <ActivityIndicator color={palette.white} />
            : <Text style={styles.saveBtnText}>Save category</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 16, gap: 20, paddingBottom: 100 },
  archivedNotice: {
    backgroundColor: palette.warning + '18',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.warning + '40',
    padding: 14,
  },
  archivedNoticeText: { ...typography.small, color: palette.warning, lineHeight: 18 },
  previewBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, borderWidth: 1.5,
    paddingHorizontal: 18, paddingVertical: 14,
    alignSelf: 'flex-start',
  },
  previewIcon: { fontSize: 26 },
  previewName: { ...typography.h4 },
  section: { gap: 8 },
  fieldLabel: { ...typography.smallBold, color: palette.textSecondary },
  input: {
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    ...typography.body, color: palette.text, minHeight: 52,
  },
  roleCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: palette.surface, borderRadius: 12,
    borderWidth: 1.5, borderColor: palette.border,
    padding: 14,
  },
  roleCardActive: { borderColor: palette.primary, backgroundColor: palette.primary + '08' },
  roleRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: palette.border,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  roleRadioActive: { borderColor: palette.primary },
  roleRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary },
  roleText: { flex: 1 },
  roleLabel: { ...typography.bodyBold, color: palette.text },
  roleDesc: { ...typography.small, color: palette.textSecondary, marginTop: 2 },
  questionsLink: {
    backgroundColor: palette.surfaceAlt, borderRadius: 12,
    borderWidth: 1, borderColor: palette.border,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  questionsLinkText: { ...typography.bodyBold, color: palette.primary },
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
    padding: 16, paddingBottom: 28,
    backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border,
  },
  saveBtn: {
    backgroundColor: palette.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', minHeight: 54,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...typography.button, color: palette.white },
}));
