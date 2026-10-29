/**
 * Questions List Screen — Apple InsetGroup style
 * Route: /customize/questions/[categoryId]
 * Displays questions for a given category, selection type, frequency, options count, and reorder controls.
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
import { ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { IQuestion } from '@lumen/shared';
import { useConfigStore } from '../../../src/store/configStore';
import { api } from '../../../src/api/client';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';
import { LargeTitleHeader } from '../../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../../src/components/ios/GlassCircleButton';
import { InsetGroup, GroupedRow } from '../../../src/components/ios/InsetGroup';
import { safeGoBack } from '../../../src/utils/navigation';
import { reorderItems } from '../../../src/utils/reorderHelper';
import { DraggableQuestionsList } from '../../../src/components/customize/DraggableQuestionsList';

export default function QuestionsScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { config, fetchConfig, invalidate, isLoading } = useConfigStore();
  const [archiveMode, setArchiveMode] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const category = config?.categories.find((c) => c._id === categoryId);
  const questions = (config?.questions ?? [])
    .filter((q) => q.categoryId === categoryId)
    .sort((a, b) => a.order - b.order);

  const active = questions.filter((q) => q.isActive);
  const archived = questions.filter((q) => !q.isActive);

  const getOptionCount = (questionId: string) => {
    return (config?.options ?? []).filter((o) => o.questionId === questionId && o.isActive).length;
  };

  const handleReorder = async (newQuestions: IQuestion[]) => {
    try {
      await reorderItems('questions', newQuestions.map((q) => q._id));
      invalidate();
      await fetchConfig();
    } catch (err: any) {
      Alert.alert('Reorder failed', err?.message || 'Could not reorder questions');
    }
  };

  const archive = (q: IQuestion) => {
    Alert.alert(`Archive "${q.title}"?`, 'Existing logs are preserved. You can restore it later at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await api.post(`/questions/${q._id}/archive`, {});
          invalidate();
          await fetchConfig();
        },
      },
    ]);
  };

  const unarchive = async (q: IQuestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post(`/questions/${q._id}/unarchive`, {});
      invalidate();
      await fetchConfig();
    } catch (err: any) {
      Alert.alert('Restore Failed', err?.message || 'Unknown error');
    }
  };

  const deletePermanently = (q: IQuestion) => {
    Alert.alert(
      `Delete "${q.title}"?`,
      'This action cannot be undone. Questions with logged tracking history cannot be permanently deleted and will be kept archived instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              const res: any = await api.delete(`/questions/${q._id}`);
              invalidate();
              await fetchConfig();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Deleted', res?.message || `Question "${q.title}" deleted.`);
            } catch (err: any) {
              const msg = err?.message || 'Could not delete question.';
              Alert.alert(
                'Cannot Delete Question',
                msg,
                q.isActive
                  ? [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Archive Instead',
                        onPress: () => archive(q),
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
      <ScrollView
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <LargeTitleHeader
          title={category?.name ?? 'Questions'}
          subtitle={`${active.length} active question${active.length !== 1 ? 's' : ''}`}
          leading={
            <GlassCircleButton
              accessibilityLabel="Go back"
              onPress={() => safeGoBack('/customize/categories')}
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
                accessibilityLabel="New question"
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/customize/question/new?categoryId=${categoryId}`);
                }}
              >
                <Plus size={20} color={palette.text} strokeWidth={2.2} />
              </GlassCircleButton>
            </View>
          }
        />

        {isLoading && questions.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : (
          <View style={styles.contentWrap}>
            {/* Active Questions InsetGroup with Drag to Reorder */}
            <InsetGroup
              footer={
                archiveMode
                  ? 'Tap Archive on any question to move it to the Archived list.'
                  : 'Hold and drag any question to reorder. Tap to edit choices and rules.'
              }
            >
              <DraggableQuestionsList
                questions={active}
                categoryId={categoryId}
                archiveMode={archiveMode}
                getOptionCount={getOptionCount}
                onReorder={handleReorder}
                onArchive={archive}
                onDragStateChange={(isDragging) => setScrollEnabled(!isDragging)}
              />
            </InsetGroup>

            {/* Archived Questions InsetGroup */}
            {archived.length > 0 && (
              <InsetGroup title="Archived">
                {archived.map((q) => (
                  <GroupedRow
                    key={q._id}
                    label={q.title}
                    sub="Archived"
                    trailing={
                      <View style={styles.trailingRow}>
                        <TouchableOpacity
                          style={styles.restoreBtn}
                          onPress={() => unarchive(q)}
                          accessibilityRole="button"
                          accessibilityLabel={`Restore ${q.title}`}
                        >
                          <Text style={[styles.restoreBtnText, { color: palette.primary }]}>Restore</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.trashBtn}
                          onPress={() => deletePermanently(q)}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${q.title} permanently`}
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
  contentWrap: {
    gap: 20,
    marginTop: 12,
  },
  loadingWrap: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trashBtn: {
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: palette.surfaceAlt,
  },
  restoreBtnText: {
    ...typography.footnote,
    fontWeight: '600',
  },
}));
