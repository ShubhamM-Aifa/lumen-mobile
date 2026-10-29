/**
 * Options List Screen — Apple InsetGroup style
 * Route: /customize/options/[questionId]
 * Displays options for a given question with icons, colors, field counts, and reorder controls.
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
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { ChevronLeft, Plus, Archive, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { IOption } from '@lumen/shared';
import { useConfigStore } from '../../../src/store/configStore';
import { api } from '../../../src/api/client';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';
import { LargeTitleHeader } from '../../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../../src/components/ios/GlassCircleButton';
import { InsetGroup, GroupedRow, IconTile } from '../../../src/components/ios/InsetGroup';
import { safeGoBack } from '../../../src/utils/navigation';
import { reorderItems } from '../../../src/utils/reorderHelper';
import { DraggableOptionsList } from '../../../src/components/customize/DraggableOptionsList';

export default function OptionsScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { questionId } = useLocalSearchParams<{ questionId: string }>();
  const { config, fetchConfig, invalidate, isLoading } = useConfigStore();
  const [archiveMode, setArchiveMode] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const question = config?.questions.find((q) => q._id === questionId);
  const options = (config?.options ?? [])
    .filter((o) => o.questionId === questionId)
    .sort((a, b) => a.order - b.order);

  const active = options.filter((o) => o.isActive);
  const archived = options.filter((o) => !o.isActive);

  const handleReorder = async (newOptions: IOption[]) => {
    try {
      await reorderItems('options', newOptions.map((o) => o._id));
      invalidate();
      await fetchConfig();
    } catch (err: any) {
      Alert.alert('Reorder failed', err?.message || 'Could not reorder options');
    }
  };

  const archive = (opt: IOption) => {
    Alert.alert(`Archive "${opt.label}"?`, 'Past logs are kept. You can restore it later at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await api.post(`/options/${opt._id}/archive`, {});
          invalidate();
          await fetchConfig();
        },
      },
    ]);
  };

  const unarchive = async (opt: IOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post(`/options/${opt._id}/unarchive`, {});
      invalidate();
      await fetchConfig();
    } catch (err: any) {
      Alert.alert('Restore Failed', err?.message || 'Unknown error');
    }
  };

  const deletePermanently = (opt: IOption) => {
    Alert.alert(
      `Delete "${opt.label}"?`,
      'This action cannot be undone. Options with logged tracking history cannot be permanently deleted and will be kept archived instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              const res: any = await api.delete(`/options/${opt._id}`);
              invalidate();
              await fetchConfig();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Deleted', res?.message || `Option "${opt.label}" deleted.`);
            } catch (err: any) {
              const msg = err?.message || err?.error || 'Could not delete option.';
              Alert.alert('Cannot Delete Option', msg);
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
          title={question?.title ? `Options` : 'Options'}
          subtitle={question?.title ?? `${active.length} active options`}
          leading={
            <GlassCircleButton
              accessibilityLabel="Go back"
              onPress={() => safeGoBack(`/customize/question/${questionId}`)}
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
                accessibilityLabel="New option"
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/customize/option/new?questionId=${questionId}`);
                }}
              >
                <Plus size={20} color={palette.text} strokeWidth={2.2} />
              </GlassCircleButton>
            </View>
          }
        />

        {isLoading && options.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : (
          <View style={styles.contentWrap}>
            {/* Active Options InsetGroup with Hold & Drag */}
            <InsetGroup
              footer={
                archiveMode
                  ? 'Tap Archive on any option to move it to the Archived list.'
                  : 'Hold and drag any option to reorder. Tap to edit choices and rules.'
              }
            >
              <DraggableOptionsList
                options={active}
                questionId={questionId}
                archiveMode={archiveMode}
                onReorder={handleReorder}
                onArchive={archive}
                onDragStateChange={(isDragging) => setScrollEnabled(!isDragging)}
              />
            </InsetGroup>

            {/* Archived Options InsetGroup */}
            {archived.length > 0 && (
              <InsetGroup title="Archived">
                {archived.map((opt) => (
                  <GroupedRow
                    key={opt._id}
                    emoji={opt.icon || undefined}
                    tile="#8E8E93"
                    label={opt.label}
                    sub="Archived"
                    trailing={
                      <View style={styles.trailingRow}>
                        <TouchableOpacity
                          style={styles.restoreBtn}
                          onPress={() => unarchive(opt)}
                          accessibilityRole="button"
                          accessibilityLabel={`Restore ${opt.label}`}
                        >
                          <Text style={[styles.restoreBtnText, { color: palette.primary }]}>Restore</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.trashBtn}
                          onPress={() => deletePermanently(opt)}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${opt.label} permanently`}
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
