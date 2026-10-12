import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  CheckCircle2,
  RotateCcw,
  Edit2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react-native';
import { IQuestion, IOption, Answer } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { OptionSelector } from './OptionSelector';
import { QuestionTodayHistoryEntry } from '../hooks/useTodayCategoryLogs';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  defaultExpanded?: boolean;
  forceExpanded?: boolean | null;
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
  defaultExpanded = true,
  forceExpanded,
}: Props) {
  const { palette } = useTheme();
  const styles = useStyles();

  // Collapsible question card state
  const [isCardExpanded, setIsCardExpanded] = useState<boolean>(defaultExpanded);

  // Collapsible history list state: default to latest entry only
  const [showAllHistory, setShowAllHistory] = useState<boolean>(false);

  // Per-entry options values expansion state (logId -> boolean)
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});

  // Sync with controlled forceExpanded override from parent if provided
  useEffect(() => {
    if (forceExpanded !== undefined && forceExpanded !== null) {
      setIsCardExpanded(forceExpanded);
    }
  }, [forceExpanded]);

  if (!isVisible(question, sessionAnswers)) return null;

  const toggleCardExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (LayoutAnimation?.configureNext && LayoutAnimation?.Presets?.easeInEaseOut) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setIsCardExpanded(prev => !prev);
  };

  const activeOptions = options
    .filter(o => o.isActive)
    .sort((a, b) => a.order - b.order);

  const hasHistory = todayHistory && todayHistory.length > 0;
  const latestHistory = hasHistory ? todayHistory[0] : null;
  const isOncePerDayCompleted = question.frequency === 'once_per_day' && hasHistory;

  // History entries to show: only latest entry by default, or all entries when expanded
  const visibleHistory = hasHistory && todayHistory
    ? (showAllHistory ? todayHistory : [todayHistory[0]])
    : [];

  return (
    <View style={styles.card}>
      {/* Interactive Question Header with Expand/Collapse toggle */}
      <TouchableOpacity
        style={styles.headerPressable}
        onPress={toggleCardExpanded}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isCardExpanded ? `Collapse ${question.title}` : `Expand ${question.title}`}
      >
        <View style={styles.headerLeft}>
          {question.icon ? (
            <Text style={styles.icon}>{question.icon}</Text>
          ) : null}
          <View style={styles.titleGroup}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{question.title}</Text>
              {question.required && !isOncePerDayCompleted && <Text style={styles.required}> *</Text>}
            </View>
          </View>
        </View>

        {/* Collapsed state badge indicator + Chevron toggle button */}
        <View style={styles.headerRight}>
          {!isCardExpanded && (
            answers.length > 0 ? (
              <View style={styles.collapsedAnswerBadge}>
                <CheckCircle2 size={11} color="#059669" />
                <Text style={styles.collapsedAnswerBadgeText} numberOfLines={1}>
                  {answers.map(a => a.optionLabelSnapshot || 'Selected').join(', ')}
                </Text>
              </View>
            ) : hasHistory ? (
              <View style={styles.collapsedHistoryBadge}>
                <Text style={styles.collapsedHistoryBadgeText}>
                  {todayHistory.length === 1 ? 'Logged today' : `Logged (${todayHistory.length})`}
                </Text>
              </View>
            ) : (
              <View style={styles.collapsedUnansweredBadge}>
                <Text style={styles.collapsedUnansweredBadgeText}>Tap to answer</Text>
              </View>
            )
          )}

          <View style={styles.chevronBtn}>
            {isCardExpanded ? (
              <ChevronUp size={18} color={palette.textSecondary} strokeWidth={2.4} />
            ) : (
              <ChevronDown size={18} color={palette.primary} strokeWidth={2.4} />
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded Question Card Content */}
      {isCardExpanded && (
        <View style={styles.expandedContent}>
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
              {/* Today Question-Specific History Section with Collapsible List & Options Values */}
              {hasHistory && todayHistory && todayHistory.length > 0 && (
                <View style={styles.historyContainer}>
                  <View style={styles.historyHeaderRow}>
                    <View style={styles.historyTag}>
                      <CheckCircle2 size={13} color="#059669" />
                      <Text style={styles.historyTagText}>
                        {todayHistory.length === 1
                          ? 'Logged today (1 entry)'
                          : `Logged today (${todayHistory.length} entries)`}
                      </Text>
                    </View>

                    <View style={styles.dayCycleBadge}>
                      <Text style={styles.dayCycleBadgeText}>Current day cycle</Text>
                    </View>
                  </View>

                  {/* History entry cards */}
                  <View style={styles.historyList}>
                    {visibleHistory.map((item, idx) => {
                      const isLatest = idx === 0;
                      const isEntryExpanded = !!expandedLogIds[item.logId];
                      const allFields = (item.details ?? []).flatMap(d => d.fields ?? []);
                      const hasComment = item.details?.some(d => !!d.comment);

                      return (
                        <View
                          key={`${item.logId}-${idx}`}
                          style={[
                            styles.historyItemCard,
                            isLatest && styles.historyItemCardLatest,
                          ]}
                        >
                          <View style={styles.historyItemHeader}>
                            <View style={styles.historyItemTimeCol}>
                              <View style={styles.historyItemTimeRow}>
                                <View style={[styles.timelineDot, isLatest && styles.timelineDotLatest]} />
                                <Text style={[styles.historyTimeClock, isLatest && styles.historyTimeClockLatest]}>
                                  {item.timeClockStr || item.timeFormatted}
                                </Text>
                                {item.timeClockStr && item.timeFormatted && item.timeFormatted !== item.timeClockStr && (
                                  <Text style={styles.historyTimeRelative}>
                                    • {item.timeFormatted}
                                  </Text>
                                )}
                                {isLatest && todayHistory.length > 1 && (
                                  <View style={styles.latestPill}>
                                    <Text style={styles.latestPillText}>Latest</Text>
                                  </View>
                                )}
                              </View>
                            </View>

                            <View style={styles.historyActions}>
                              {onReuseAnswers && (
                                <TouchableOpacity
                                  style={styles.reuseBtn}
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    onReuseAnswers(item.answers);
                                  }}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Fill previous answers from ${item.timeClockStr || item.timeFormatted}`}
                                >
                                  <RotateCcw size={11} color={palette.primary} strokeWidth={2.4} />
                                  <Text style={styles.reuseBtnText}>Fill</Text>
                                </TouchableOpacity>
                              )}

                              {onEditLog && (
                                <TouchableOpacity
                                  style={styles.editLogBtn}
                                  onPress={() => onEditLog(item.logId)}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Edit log from ${item.timeClockStr || item.timeFormatted}`}
                                >
                                  <Edit2 size={11} color={palette.textSecondary} strokeWidth={2.2} />
                                  <Text style={styles.editLogBtnText}>Edit</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>

                          {/* Primary Summary Label */}
                          <View style={styles.historySummaryRow}>
                            <Text style={styles.historySummaryText}>
                              {item.summaryText}
                            </Text>

                            {/* Options Value Toggle Button */}
                            <TouchableOpacity
                              style={styles.entryDetailsToggle}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                if (LayoutAnimation?.configureNext && LayoutAnimation?.Presets?.easeInEaseOut) {
                                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                }
                                setExpandedLogIds(prev => ({
                                  ...prev,
                                  [item.logId]: !prev[item.logId],
                                }));
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={isEntryExpanded ? 'Hide option values' : 'See option values'}
                            >
                              <Text style={styles.entryDetailsToggleText}>
                                {isEntryExpanded ? 'Hide values' : 'See values'}
                              </Text>
                              {isEntryExpanded ? (
                                <ChevronUp size={12} color={palette.primary} strokeWidth={2.2} />
                              ) : (
                                <ChevronDown size={12} color={palette.primary} strokeWidth={2.2} />
                              )}
                            </TouchableOpacity>
                          </View>

                          {/* Compact inline option values preview (when collapsed) */}
                          {!isEntryExpanded && allFields.length > 0 && (
                            <View style={styles.inlineValuesRow}>
                              {allFields.map((f, fIdx) => (
                                <View key={`${f.key || fIdx}`} style={styles.inlineValueChip}>
                                  <Text style={styles.inlineValueChipLabel}>{f.label}:</Text>
                                  <Text style={styles.inlineValueChipValue}>{f.displayValue}</Text>
                                </View>
                              ))}
                              {hasComment && (
                                <View style={styles.inlineCommentPill}>
                                  <MessageSquare size={10} color={palette.textSecondary} />
                                  <Text style={styles.inlineCommentPillText}>Note</Text>
                                </View>
                              )}
                            </View>
                          )}

                          {/* Expanded Full Option Values Breakdown */}
                          {isEntryExpanded && (
                            <View style={styles.detailedValuesCard}>
                              {item.details && item.details.length > 0 ? (
                                item.details.map((detail, dIdx) => (
                                  <View key={dIdx} style={styles.detailBlock}>
                                    <View style={styles.detailOptionHeader}>
                                      <View
                                        style={[
                                          styles.detailColorDot,
                                          { backgroundColor: detail.color || palette.primary },
                                        ]}
                                      />
                                      <Text style={styles.detailOptionLabel}>
                                        {detail.optionLabel}
                                      </Text>
                                    </View>

                                    {detail.fields.length > 0 ? (
                                      <View style={styles.detailFieldsGrid}>
                                        {detail.fields.map((field, fIdx) => (
                                          <View key={fIdx} style={styles.detailFieldRow}>
                                            <Text style={styles.detailFieldLabel}>{field.label}</Text>
                                            <View style={styles.detailFieldValueBadge}>
                                              <Text style={styles.detailFieldValueText}>
                                                {field.displayValue}
                                              </Text>
                                            </View>
                                          </View>
                                        ))}
                                      </View>
                                    ) : (
                                      <Text style={styles.detailNoFieldsText}>
                                        Selection recorded without additional parameters.
                                      </Text>
                                    )}

                                    {detail.comment ? (
                                      <View style={styles.detailCommentBox}>
                                        <MessageSquare size={12} color={palette.primary} style={{ marginTop: 2 }} />
                                        <View style={{ flex: 1 }}>
                                          <Text style={styles.detailCommentLabel}>Note</Text>
                                          <Text style={styles.detailCommentText}>"{detail.comment}"</Text>
                                        </View>
                                      </View>
                                    ) : null}

                                    {detail.otherText ? (
                                      <View style={styles.detailCommentBox}>
                                        <Text style={styles.detailCommentLabel}>Custom entry</Text>
                                        <Text style={styles.detailCommentText}>"{detail.otherText}"</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                ))
                              ) : (
                                <Text style={styles.detailNoFieldsText}>
                                  Option: {item.summaryText}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {/* Toggle button to expand/collapse full today history list when > 1 entries */}
                  {todayHistory.length > 1 && (
                    <TouchableOpacity
                      style={styles.historyExpandListBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (LayoutAnimation?.configureNext && LayoutAnimation?.Presets?.easeInEaseOut) {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        }
                        setShowAllHistory(prev => !prev);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showAllHistory
                          ? 'Show latest entry only'
                          : `Show earlier ${todayHistory.length - 1} entries`
                      }
                    >
                      <Text style={styles.historyExpandListText}>
                        {showAllHistory
                          ? 'Show latest entry only'
                          : `Show earlier ${todayHistory.length - 1} ${todayHistory.length - 1 === 1 ? 'entry' : 'entries'}`}
                      </Text>
                      {showAllHistory ? (
                        <ChevronUp size={13} color={palette.primary} strokeWidth={2.4} />
                      ) : (
                        <ChevronDown size={13} color={palette.primary} strokeWidth={2.4} />
                      )}
                    </TouchableOpacity>
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.surfaceAlt === '#F5F0EB' ? '#A7F3D0' : '#05966940',
    padding: 10,
    gap: 8,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
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
    fontSize: 12,
  },
  dayCycleBadge: {
    backgroundColor: palette.surfaceAlt === '#F5F0EB' ? '#D1FAE5' : '#065F4630',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dayCycleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  historyList: {
    gap: 7,
  },
  historyItemCard: {
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
  },
  historyItemCardLatest: {
    borderColor: palette.surfaceAlt === '#F5F0EB' ? '#A7F3D0' : '#05966950',
    backgroundColor: palette.surfaceAlt === '#F5F0EB' ? '#FFFFFF' : `${palette.surface}E0`,
  },
  historyItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  historyItemTimeCol: {
    flex: 1,
  },
  historyItemTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.textSecondary,
  },
  timelineDotLatest: {
    backgroundColor: '#059669',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  historyTimeClock: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: '700',
    color: palette.text,
  },
  historyTimeClockLatest: {
    color: '#059669',
  },
  historyTimeRelative: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: '500',
    color: palette.textSecondary,
  },
  latestPill: {
    backgroundColor: '#0596691A',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  latestPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
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
    paddingVertical: 3.5,
    borderRadius: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 10,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  editLogBtnText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  historySummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 11,
    marginTop: 2,
    gap: 8,
  },
  historySummaryText: {
    ...typography.body,
    fontSize: 12.5,
    fontWeight: '700',
    color: palette.text,
    flex: 1,
  },
  entryDetailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: `${palette.primary}12`,
  },
  entryDetailsToggleText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: '700',
    color: palette.primary,
  },
  inlineValuesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    paddingLeft: 11,
    marginTop: 4,
  },
  inlineValueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
  },
  inlineValueChipLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  inlineValueChipValue: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.text,
  },
  inlineCommentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inlineCommentPillText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  detailedValuesCard: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 10,
    marginTop: 6,
    marginLeft: 11,
    gap: 8,
  },
  detailBlock: {
    gap: 6,
  },
  detailOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailOptionLabel: {
    ...typography.bodyBold,
    fontSize: 12,
    color: palette.text,
  },
  detailFieldsGrid: {
    backgroundColor: palette.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  detailFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailFieldLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  detailFieldValueBadge: {
    backgroundColor: `${palette.primary}14`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  detailFieldValueText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: palette.primary,
  },
  detailNoFieldsText: {
    ...typography.caption,
    fontSize: 11,
    color: palette.textSecondary,
    fontStyle: 'italic',
  },
  detailCommentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: palette.surface,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  detailCommentLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.textSecondary,
  },
  detailCommentText: {
    ...typography.caption,
    fontSize: 11,
    color: palette.text,
    fontStyle: 'italic',
  },
  historyExpandListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    marginTop: 2,
  },
  historyExpandListText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: palette.primary,
  },

  // Collapsible Question Card Header styles
  headerPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevronBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  collapsedAnswerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#05966918',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#05966933',
    maxWidth: 140,
  },
  collapsedAnswerBadgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  collapsedHistoryBadge: {
    backgroundColor: '#05966914',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0596692E',
  },
  collapsedHistoryBadgeText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: '600',
    color: '#059669',
  },
  collapsedUnansweredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: palette.surfaceAlt,
  },
  collapsedUnansweredBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '500',
    color: palette.textSecondary,
  },
  expandedContent: {
    gap: 14,
    marginTop: 4,
  },
}));
