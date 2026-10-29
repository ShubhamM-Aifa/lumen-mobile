/**
 * Categories Screen — Apple InsetGroup style
 * Route: /customize/categories
 * Displays active and archived categories, their roles, question counts, and reorder controls.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { ChevronLeft, Plus, ArrowUp, ArrowDown, Archive, RotateCcw, Trash2, Settings2, Sliders } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ICategory } from '@lumen/shared';
import { useConfigStore } from '../../src/store/configStore';
import { api } from '../../src/api/client';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { InsetGroup, GroupedRow, IconTile } from '../../src/components/ios/InsetGroup';
import { safeGoBack } from '../../src/utils/navigation';
import { reorderItems } from '../../src/utils/reorderHelper';
import { DraggableCategoriesList } from '../../src/components/customize/DraggableCategoriesList';

const ROLE_LABEL: Record<string, string> = {
  symptom: 'Symptom',
  trigger_candidate: 'Trigger',
  context: 'Context',
};

export default function CategoriesScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { config, fetchConfig, invalidate, isLoading } = useConfigStore();
  const [archiveMode, setArchiveMode] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const categories = (config?.categories ?? []).sort((a, b) => a.order - b.order);
  const active = categories.filter((c) => c.isActive);
  const archived = categories.filter((c) => !c.isActive);

  const getQuestionCount = (categoryId: string) => {
    return (config?.questions ?? []).filter((q) => q.categoryId === categoryId && q.isActive).length;
  };

  const handleReorder = async (newCategories: ICategory[]) => {
    try {
      await reorderItems('categories', newCategories.map((c) => c._id));
      invalidate();
      await fetchConfig();
    } catch (err: any) {
      Alert.alert('Reorder failed', err?.message || 'Could not reorder categories');
    }
  };

  const archive = (cat: ICategory) => {
    Alert.alert(
      `Archive "${cat.name}"?`,
      'Past logs will be kept. You can restore it later at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await api.post(`/categories/${cat._id}/archive`, {});
            invalidate();
            await fetchConfig();
          },
        },
      ],
    );
  };

  const unarchive = async (cat: ICategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post(`/categories/${cat._id}/unarchive`, {});
      invalidate();
      await fetchConfig();
    } catch (err: any) {
      Alert.alert('Restore Failed', err?.message || 'Unknown error');
    }
  };

  const deletePermanently = (cat: ICategory) => {
    Alert.alert(
      `Delete "${cat.name}"?`,
      'This action cannot be undone. Categories with logged tracking history cannot be permanently deleted and will be kept archived instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              const res: any = await api.delete(`/categories/${cat._id}`);
              invalidate();
              await fetchConfig();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Deleted', res?.message || `Category "${cat.name}" deleted.`);
            } catch (err: any) {
              const msg = err?.message || err?.error || 'Could not delete category.';
              Alert.alert('Cannot Delete Category', msg);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <LargeTitleHeader
          title="Categories"
          subtitle="Customize categories and their logging questions."
          leading={
            <GlassCircleButton
              accessibilityLabel="Go back"
              onPress={() => safeGoBack('/(tabs)/customize')}
            >
              <ChevronLeft size={22} color={palette.text} strokeWidth={2.4} />
            </GlassCircleButton>
          }
          actions={
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[
                  styles.archiveToggleBtn,
                  { backgroundColor: archiveMode ? (palette.warning || '#FF9500') : palette.surfaceAlt },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setArchiveMode((prev) => !prev);
                }}
              >
                <Text
                  style={[
                    styles.archiveToggleText,
                    { color: archiveMode ? '#FFFFFF' : palette.text },
                  ]}
                >
                  {archiveMode ? 'Done' : 'Archive'}
                </Text>
              </TouchableOpacity>
              <GlassCircleButton
                accessibilityLabel="New category"
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/customize/category/new');
                }}
              >
                <Plus size={20} color={palette.text} strokeWidth={2.2} />
              </GlassCircleButton>
            </View>
          }
        />

        {isLoading && categories.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : (
          <View style={styles.contentWrap}>
            {/* Active Categories InsetGroup with Hold & Drag */}
            <InsetGroup
              footer={
                archiveMode
                  ? 'Tap Archive on any category to move it to the Archived list.'
                  : 'Hold and drag any category to reorder. Tap to view questions.'
              }
            >
              <DraggableCategoriesList
                categories={active}
                archiveMode={archiveMode}
                getQuestionCount={getQuestionCount}
                onReorder={handleReorder}
                onArchive={archive}
                onDragStateChange={(isDragging) => setScrollEnabled(!isDragging)}
              />
            </InsetGroup>

            {/* Archived Categories InsetGroup */}
            {archived.length > 0 && (
              <InsetGroup title="Archived">
                {archived.map((cat) => (
                  <GroupedRow
                    key={cat._id}
                    emoji={cat.icon}
                    tile="#8E8E93"
                    label={cat.name}
                    sub="Archived"
                    trailing={
                      <View style={styles.trailingRow}>
                        <TouchableOpacity
                          style={styles.restoreBtn}
                          onPress={() => unarchive(cat)}
                          accessibilityRole="button"
                          accessibilityLabel={`Restore ${cat.name}`}
                        >
                          <Text style={[styles.restoreBtnText, { color: palette.primary }]}>Restore</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.trashBtn}
                          onPress={() => deletePermanently(cat)}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${cat.name} permanently`}
                        >
                          <Trash2 size={17} color={palette.error} />
                        </TouchableOpacity>
                      </View>
                    }
                  />
                ))}
              </InsetGroup>
            )}
          </View>
        )}
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
    paddingBottom: 40,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  archiveToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  archiveToggleText: {
    ...typography.subhead,
    fontWeight: '600',
  },
  trailingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restoreBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  restoreBtnText: {
    ...typography.subhead,
    fontWeight: '600',
  },
  trashBtn: {
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrap: {
    gap: 20,
    marginTop: 12,
  },
  loadingWrap: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
