/**
 * Category Editor Screen — Apple InsetGroup style
 * Route: /customize/category/new  (create)
 *        /customize/category/:id  (edit)
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ICategory, CategoryRole } from '@lumen/shared';
import { useConfigStore } from '../../../src/store/configStore';
import { api } from '../../../src/api/client';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';
import { ScreenTopBar, HeaderTextButton } from '../../../src/components/ios/ScreenTopBar';
import { InsetGroup, GroupedRow, IconTile } from '../../../src/components/ios/InsetGroup';
import { IconPicker } from '../../../src/components/customize/IconPicker';
import { ColorSwatchPicker } from '../../../src/components/customize/ColorSwatchPicker';
import { safeGoBack } from '../../../src/utils/navigation';

const ROLES: Array<{ value: CategoryRole; label: string; desc: string }> = [
  { value: 'trigger_candidate', label: 'Trigger / Activity', desc: 'Used to find what correlates with symptoms' },
  { value: 'symptom', label: 'Symptom', desc: 'Tracked as health outcomes in analytics' },
  { value: 'context', label: 'Context', desc: 'Background info; not correlated' },
];

export default function CategoryEditorScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { config, invalidate, fetchConfig } = useConfigStore();

  const existing: ICategory | undefined = isNew
    ? undefined
    : config?.categories.find((c) => c._id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '📋');
  const [color, setColor] = useState(existing?.color ?? '#007AFF');
  const [role, setRole] = useState<CategoryRole>(existing?.role ?? 'trigger_candidate');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setIcon(existing.icon);
      setColor(existing.color);
      setRole(existing.role);
    }
  }, [existing?._id]);

  const questionsCount = isNew
    ? 0
    : (config?.questions ?? []).filter((q) => q.categoryId === id && q.isActive).length;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a category name.');
      return;
    }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const body = { name: name.trim(), icon, color, role };
      if (isNew) {
        await api.post('/categories', body);
      } else {
        await api.patch(`/categories/${id}`, body);
      }
      invalidate();
      await fetchConfig();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      safeGoBack('/customize/categories');
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Unable to save category.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = () => {
    if (!existing) return;
    Alert.alert(`Archive "${existing.name}"?`, 'You can restore this category later at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await api.post(`/categories/${existing._id}/archive`, {});
          invalidate();
          await fetchConfig();
          safeGoBack('/customize/categories');
        },
      },
    ]);
  };

  const handleUnarchive = async () => {
    if (!existing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post(`/categories/${existing._id}/unarchive`, {});
      invalidate();
      await fetchConfig();
      safeGoBack('/customize/categories');
    } catch (err: any) {
      Alert.alert('Restore Failed', err?.message || 'Unable to restore category.');
    }
  };

  const handlePermanentDelete = () => {
    if (!existing) return;
    Alert.alert(
      `Delete "${existing.name}"?`,
      'This action cannot be undone. Categories with logged tracking history cannot be permanently deleted and must be kept archived instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              const res: any = await api.delete(`/categories/${existing._id}`);
              invalidate();
              await fetchConfig();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Deleted', res?.message || `Category "${existing.name}" deleted.`);
              safeGoBack('/customize/categories');
            } catch (err: any) {
              const msg = err?.message || err?.error || 'Could not delete category.';
              Alert.alert(
                'Cannot Delete Category',
                msg,
                existing.isActive
                  ? [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Archive Instead',
                        onPress: handleArchive,
                      },
                    ]
                  : [{ text: 'OK' }],
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenTopBar
        title={isNew ? 'New Category' : 'Edit Category'}
        backLabel="Cancel"
        onBack={() => safeGoBack('/customize/categories')}
        fallbackRoute="/customize/categories"
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

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Name and Icon Tile InsetGroup */}
        <InsetGroup>
          <View style={styles.nameRow}>
            <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.nameInput, { color: palette.text }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Symptoms, Food & Drink"
              placeholderTextColor={palette.placeholder}
              autoFocus={isNew}
            />
          </View>

          <View style={styles.iconPickerRow}>
            <View style={styles.iconPreviewWrap}>
              <IconTile emoji={icon} color={color} size={36} />
              <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Icon Emoji</Text>
            </View>
            <IconPicker value={icon} onChange={setIcon} />
          </View>
        </InsetGroup>

        {/* Color Palette Swatch InsetGroup */}
        <InsetGroup title="Color">
          <View style={styles.colorWrap}>
            <ColorSwatchPicker value={color} onChange={setColor} />
          </View>
        </InsetGroup>

        {/* Role in Analytics InsetGroup */}
        <InsetGroup title="Role in analytics" footer="Categories marked as Symptoms or Triggers are analyzed for health patterns.">
          {ROLES.map((r) => {
            const isSelected = role === r.value;
            return (
              <GroupedRow
                key={r.value}
                label={r.label}
                sub={r.desc}
                onPress={() => {
                  Haptics.selectionAsync();
                  setRole(r.value);
                }}
                trailing={isSelected ? <Check size={18} color={palette.primary} strokeWidth={2.5} /> : null}
              />
            );
          })}
        </InsetGroup>

        {/* Link to Questions List */}
        {!isNew && (
          <InsetGroup title="Questions">
            <GroupedRow
              label="Questions"
              value={String(questionsCount)}
              chevron
              onPress={() => router.push(`/customize/questions/${id}`)}
            />
          </InsetGroup>
        )}

        {/* Archive & Delete actions */}
        {!isNew && (
          <InsetGroup footer="Archiving hides this category from daily logging while preserving existing data. Permanent delete completely removes the category and its questions.">
            {existing?.isActive ? (
              <GroupedRow
                label="Archive this category"
                sub="Keep past logs, but hide from tracking"
                destructive
                onPress={handleArchive}
              />
            ) : (
              <GroupedRow
                label="Restore this category"
                valueColor={palette.primary}
                onPress={handleUnarchive}
              />
            )}
            <GroupedRow
              label="Delete this category"
              sub="Permanently remove category and questions"
              destructive
              onPress={handlePermanentDelete}
            />
          </InsetGroup>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((palette) => ({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16,
  },
  nameRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  fieldLabel: {
    ...typography.caption1,
    fontWeight: '500',
  },
  nameInput: {
    ...typography.bodyLarge,
    fontSize: 17,
    padding: 0,
  },
  iconPickerRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  iconPreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorWrap: {
    padding: 16,
  },
}));
