import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, RotateCcw, Edit2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { IQuestion, IOption, Answer } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { OptionSelector } from './OptionSelector';
import { QuestionTodayHistoryEntry } from '../hooks/useTodayCategoryLogs';

interface Props {
  question: IQuestion;
  options: IOption[];
  answers: Answer[];
  /** All answers in the current log session — used for conditional display */
  sessionAnswers: Answer[];
  onChange: (answers: Answer[]) => void;
  tempPrefUnit?: 'C' | 'F';
  todayHistory?: QuestionTodayHistoryEntry[];
  onReuseAnswers?: (answers: Answer[]) => void;
  onEditLog?: (logId: string) => void;
}

function isVisible(question: IQuestion, sessionAnswers: Answer[]): boolean {
  if (!question.conditionalDisplay) return true;
  const cond = question.conditionalDisplay as any;
  const targetOptionId = cond.optionId || cond.requiredOptionId;
  if (!targetOptionId) return true;
  return sessionAnswers.some(a => a.optionId === targetOptionId);
}

export function QuestionCard({
  question,
  options,
  answers,
  sessionAnswers,
  onChange,
  tempPrefUnit = 'C',
  todayHistory,
  onReuseAnswers,
  onEditLog,
}: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  if (!isVisible(question, sessionAnswers)) return null;

  const activeOptions = options
    .filter(o => o.isActive)
    .sort((a, b) => a.order - b.order);

  const hasHistory = todayHistory && todayHistory.length > 0;
  const latestHistory = hasHistory ? todayHistory[0] : null;
  const isOncePerDayCompleted = question.frequency === 'once_per_day' && hasHistory;

  return (
    <View style={styles.card}>
      {/* Question header */}
      <View style={styles.header}>
        {question.icon ? (
          <Text style={styles.icon}>{question.icon}</Text>
        ) : null}
        <View style={styles.titleGroup}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{question.title}</Text>
            {question.required && !isOncePerDayCompleted && <Text style={styles.required}> *</Text>}
          </View>
          {question.helpText ? (
            <Text style={styles.helpText}>{question.helpText}</Text>
          ) : null}

          {/* Frequency pill badge */}
          {question.frequency && question.frequency !== 'anytime' && (
            <View style={styles.freqBadgeRow}>
              {question.frequency === 'morning' && (
                <View style={[styles.freqBadge, styles.freqMorning]}>
                  <Text style={styles.freqMorningText}>☀️ Morning</Text>
                </View>
              )}
              {question.frequency === 'evening' && (
                <View style={[styles.freqBadge, styles.freqEvening]}>
                  <Text style={styles.freqEveningText}>🌙 Evening</Text>
                </View>
              )}
              {question.frequency === 'once_per_day' && (
                <View style={[styles.freqBadge, styles.freqOncePerDay]}>
                  <Text style={styles.freqOncePerDayText}>📅 Once per day</Text>
                </View>
              )}
              {question.frequency === 'per_meal' && (
                <View style={[styles.freqBadge, styles.freqPerMeal]}>
                  <Text style={styles.freqPerMealText}>🍽️ Per meal</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Once Per Day: Completed State Card */}
      {isOncePerDayCompleted && latestHistory ? (
        <View style={styles.completedDayCard}>
          <View style={styles.completedDayHeader}>
            <View style={styles.completedDayBadge}>
              <CheckCircle2 size={16} color="#059669" />
              <Text style={styles.completedDayBadgeText}>Completed for today</Text>
            </View>
            <Text style={styles.completedDayTimeText}>{latestHistory.timeFormatted}</Text>
          </View>

          <View style={styles.completedDayContent}>
            <Text style={styles.completedDayAnswerLabel}>Your recorded answer:</Text>
            <Text style={styles.completedDayAnswerText}>{latestHistory.summaryText}</Text>
          </View>

          {onEditLog && (
            <TouchableOpacity
              style={styles.completedDayEditBtn}
              onPress={() => onEditLog(latestHistory.logId)}
              accessibilityRole="button"
              accessibilityLabel="Edit today's entry"
            >
              <Edit2 size={12} color={palette.primary} />
              <Text style={styles.completedDayEditText}>Edit entry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          {/* Today Question-Specific History Banner (for anytime/multi-entry questions) */}
          {hasHistory && latestHistory && (
            <View style={styles.historyContainer}>
              <View style={styles.historyHeaderRow}>
                <View style={styles.historyTag}>
                  <CheckCircle2 size={13} color="#059669" />
                  <Text style={styles.historyTagText}>
                    Logged {latestHistory.timeFormatted}
                  </Text>
                </View>

                <View style={styles.historyActions}>
                  {onReuseAnswers && (
                    <TouchableOpacity
                      style={styles.reuseBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onReuseAnswers(latestHistory.answers);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Fill this previous answer"
                    >
                      <RotateCcw size={11} color={palette.primary} />
                      <Text style={styles.reuseBtnText}>Fill</Text>
                    </TouchableOpacity>
                  )}

                  {onEditLog && (
                    <TouchableOpacity
                      style={styles.editLogBtn}
                      onPress={() => onEditLog(latestHistory.logId)}
                      accessibilityRole="button"
                      accessibilityLabel="Edit earlier log"
                    >
                      <Edit2 size={11} color={palette.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Text style={styles.historySummaryText} numberOfLines={2}>
                {latestHistory.summaryText}
              </Text>

              {/* Earlier entries accordion */}
              {todayHistory.length > 1 && (
                <View style={styles.earlierWrapper}>
                  <TouchableOpacity
                    style={styles.expandToggle}
                    onPress={() => setIsHistoryExpanded(!isHistoryExpanded)}
                    accessibilityRole="button"
                    accessibilityLabel="Toggle earlier entries for this question"
                  >
                    <Text style={styles.expandToggleText}>
                      {isHistoryExpanded
                        ? 'Hide earlier entries'
                        : `${todayHistory.length - 1} earlier ${todayHistory.length - 1 === 1 ? 'entry' : 'entries'} today`}
                    </Text>
                    {isHistoryExpanded ? (
                      <ChevronUp size={13} color={palette.textSecondary} />
                    ) : (
                      <ChevronDown size={13} color={palette.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {isHistoryExpanded && (
                    <View style={styles.earlierList}>
                      {todayHistory.slice(1).map((item, idx) => (
                        <View key={`${item.logId}-${idx}`} style={styles.earlierItem}>
                          <View style={styles.earlierItemHeader}>
                            <Text style={styles.earlierTimeText}>{item.timeFormatted}</Text>
                            <View style={styles.historyActions}>
                              {onReuseAnswers && (
                                <TouchableOpacity
                                  style={styles.reuseBtnSmall}
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    onReuseAnswers(item.answers);
                                  }}
                                >
                                  <RotateCcw size={10} color={palette.primary} />
                                  <Text style={styles.reuseBtnSmallText}>Fill</Text>
                                </TouchableOpacity>
                              )}
                              {onEditLog && (
                                <TouchableOpacity
                                  style={styles.editLogBtnSmall}
                                  onPress={() => onEditLog(item.logId)}
                                >
                                  <Edit2 size={10} color={palette.textSecondary} />
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                          <Text style={styles.earlierSummaryText} numberOfLines={2}>
                            {item.summaryText}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Options */}
          <OptionSelector
            options={activeOptions}
            selectionType={question.selectionType}
            allowOther={question.allowOther}
            answers={answers}
            onChange={onChange}
            tempPrefUnit={tempPrefUnit}
          />
        </>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 14,
  },
  header: { flexDirection: 'row', gap: 10 },
  icon: { fontSize: 22, paddingTop: 2 },
  titleGroup: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { ...typography.h4, color: palette.text, flex: 1 },
  required: { ...typography.h4, color: palette.error },
  helpText: { ...typography.small, color: palette.textSecondary },

  // Frequency badges
  freqBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  freqBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  freqMorning: {
    backgroundColor: '#F59E0B14',
    borderColor: '#F59E0B30',
  },
  freqMorningText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#D97706',
  },
  freqEvening: {
    backgroundColor: '#6366F114',
    borderColor: '#6366F130',
  },
  freqEveningText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6366F1',
  },
  freqOncePerDay: {
    backgroundColor: '#10B98114',
    borderColor: '#10B98130',
  },
  freqOncePerDayText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  freqPerMeal: {
    backgroundColor: '#EC489914',
    borderColor: '#EC489930',
  },
  freqPerMealText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#DB2777',
  },

  // Completed once per day card
  completedDayCard: {
    backgroundColor: palette.surfaceAlt === '#F5F0EB' ? '#ECFDF5' : '#064E3B1C',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#10B981',
    padding: 13,
    gap: 10,
  },
  completedDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedDayBadgeText: {
    ...typography.bodyBold,
    fontSize: 13,
    color: '#059669',
  },
  completedDayTimeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  completedDayContent: {
    backgroundColor: palette.surface,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 3,
  },
  completedDayAnswerLabel: {
    ...typography.caption,
    fontSize: 10.5,
    color: palette.textSecondary,
    fontWeight: '600',
  },
  completedDayAnswerText: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  completedDayEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: `${palette.primary}14`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${palette.primary}30`,
  },
  completedDayEditText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: palette.primary,
  },

  // Question-level today history
  historyContainer: {
    backgroundColor: palette.surfaceAlt === '#F5F0EB' ? '#ECFDF5' : '#064E3B1C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.surfaceAlt === '#F5F0EB' ? '#A7F3D0' : '#05966940',
    padding: 10,
    gap: 6,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  historyTagText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#059669',
    fontSize: 11.5,
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reuseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${palette.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${palette.primary}30`,
  },
  reuseBtnText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: palette.primary,
  },
  editLogBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  historySummaryText: {
    ...typography.body,
    fontSize: 12.5,
    fontWeight: '600',
    color: palette.text,
    lineHeight: 16,
  },
  earlierWrapper: {
    borderTopWidth: 1,
    borderTopColor: palette.surfaceAlt === '#F5F0EB' ? '#D1FAE5' : '#05966925',
    paddingTop: 6,
    marginTop: 2,
    gap: 6,
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  expandToggleText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  earlierList: {
    gap: 6,
    paddingTop: 4,
  },
  earlierItem: {
    backgroundColor: palette.surface,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 3,
  },
  earlierItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earlierTimeText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  earlierSummaryText: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: '500',
    color: palette.text,
  },
  reuseBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: `${palette.primary}12`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reuseBtnSmallText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: palette.primary,
  },
  editLogBtnSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
}));
