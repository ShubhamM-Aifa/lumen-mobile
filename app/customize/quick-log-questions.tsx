import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import { ChevronLeft, Check, Sparkles, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useConfigStore } from '../../src/store/configStore';
import { useQuickLogConfigStore, MAX_QUICK_LOG_QUESTIONS } from '../../src/store/quickLogConfigStore';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { ICategory, IQuestion } from '@lumen/shared';

export default function QuickLogQuestionsScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { config, fetchConfig } = useConfigStore();
  const {
    selectedQuestionIds,
    loadSelectedQuestions,
    toggleQuestion,
  } = useQuickLogConfigStore();

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (config?.questions) {
      loadSelectedQuestions(config.questions);
    }
  }, [config?.questions, loadSelectedQuestions]);

  const activeCategories: ICategory[] = (config?.categories ?? [])
    .filter(c => c.isActive)
    .sort((a, b) => a.order - b.order);

  const activeQuestions: IQuestion[] = (config?.questions ?? []).filter(q => q.isActive);

  const handleToggle = async (questionId: string) => {
    Haptics.selectionAsync();
    const result = await toggleQuestion(questionId);
    if (!result.success && result.message) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Limit Reached', result.message);
    }
  };

  const selectedCount = selectedQuestionIds.length;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Quick Log Setup',
          headerStyle: { backgroundColor: palette.surface },
          headerTintColor: palette.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => safeGoBack('/quick-log')}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ChevronLeft size={24} color={palette.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Instructions & Counter Card */}
        <View style={styles.counterCard}>
          <View style={styles.counterHeader}>
            <View style={styles.counterPill}>
              <Sparkles size={14} color={palette.primaryText} />
              <Text style={styles.counterText}>
                {selectedCount} / {MAX_QUICK_LOG_QUESTIONS} Selected
              </Text>
            </View>
            {selectedCount === MAX_QUICK_LOG_QUESTIONS ? (
              <View style={styles.maxBadge}>
                <Text style={styles.maxBadgeText}>Max Reached</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.counterTitle}>Choose Your Priority Questions</Text>
          <Text style={styles.counterDesc}>
            Select up to {MAX_QUICK_LOG_QUESTIONS} questions across any category to appear on your home screen Quick Log for fast 1-tap tracking.
          </Text>
        </View>

        {/* Categories & Questions List */}
        {activeCategories.map(cat => {
          const catQuestions = activeQuestions
            .filter(q => q.categoryId === cat._id)
            .sort((a, b) => a.order - b.order);

          if (catQuestions.length === 0) return null;

          return (
            <View key={cat._id} style={styles.categoryGroup}>
              {/* Category Header */}
              <View style={styles.categoryHeader}>
                <View style={[styles.catIconBox, { backgroundColor: (cat.color || palette.primary) + '20' }]}>
                  <Text style={styles.catEmoji}>{cat.icon || '📋'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.catRole}>
                    {cat.role === 'symptom'
                      ? 'Symptom'
                      : cat.role === 'trigger_candidate'
                      ? 'Habit / Trigger'
                      : 'Context'}
                  </Text>
                </View>
              </View>

              {/* Questions Rows */}
              <View style={styles.questionsCard}>
                {catQuestions.map((q, idx) => {
                  const isSelected = selectedQuestionIds.includes(q._id);
                  const isLast = idx === catQuestions.length - 1;

                  return (
                    <TouchableOpacity
                      key={q._id}
                      style={[
                        styles.questionRow,
                        isLast && styles.questionRowLast,
                        isSelected && styles.questionRowSelected,
                      ]}
                      onPress={() => handleToggle(q._id)}
                      activeOpacity={0.7}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={`${q.title}, ${isSelected ? 'selected' : 'not selected'}`}
                    >
                      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                        {isSelected ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.questionTitle, isSelected && styles.questionTitleActive]}>
                          {q.title}
                        </Text>
                        {q.helpText ? (
                          <Text style={styles.questionHelp} numberOfLines={1}>
                            {q.helpText}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.freqBadge}>
                        <Text style={styles.freqBadgeText}>
                          {q.selectionType === 'multiple' ? 'Multi' : 'Single'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Done Button Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            safeGoBack('/quick-log');
          }}
          accessibilityRole="button"
          accessibilityLabel="Save Quick Log configuration"
        >
          <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.doneBtnText}>
            Save Quick Log ({selectedCount} Selected)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
    marginLeft: 4,
  },
  scroll: {
    padding: 16,
    gap: 16,
  },
  counterCard: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 16,
    gap: 8,
  },
  counterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.primary + '18',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  counterText: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.primaryText,
  },
  maxBadge: {
    backgroundColor: palette.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  maxBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: palette.warningText,
  },
  counterTitle: {
    ...typography.h3,
    fontSize: 17,
    fontWeight: '700',
    color: palette.text,
  },
  counterDesc: {
    ...typography.caption,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  categoryGroup: {
    gap: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  catIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catEmoji: {
    fontSize: 18,
  },
  catName: {
    ...typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  catRole: {
    ...typography.caption,
    fontSize: 11,
    color: palette.textSecondary,
  },
  questionsCard: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    overflow: 'hidden',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  questionRowLast: {
    borderBottomWidth: 0,
  },
  questionRowSelected: {
    backgroundColor: palette.primary + '08',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  checkboxActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  questionTitle: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '500',
    color: palette.text,
  },
  questionTitleActive: {
    fontWeight: '700',
    color: palette.primaryText,
  },
  questionHelp: {
    ...typography.caption,
    fontSize: 11,
    color: palette.textSecondary,
    marginTop: 2,
  },
  freqBadge: {
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  freqBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  doneBtnText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
}));
