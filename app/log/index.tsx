/**
 * Category picker — first step of the log flow.
 * Grouped by role: Symptoms first, then Trigger candidates, then Context.
 * Displays per-category progress bars with question completion and daily summary.
 */
import React, { useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Check, Calendar, Sparkles } from 'lucide-react-native';
import { ICategory } from '@lumen/shared';
import { useConfigStore } from '../../src/store/configStore';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { useCategoryProgress, CategoryProgressInfo } from '../../src/hooks/useCategoryProgress';

const ROLE_ORDER = ['symptom', 'trigger_candidate', 'context'] as const;
const ROLE_LABEL: Record<string, string> = {
  symptom:           'Symptoms',
  trigger_candidate: 'Daily Habits & Food',
  context:           'Context',
};

export default function LogCategoryPicker() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { config, isLoading: isConfigLoading, fetchConfig } = useConfigStore();
  const {
    getCategoryProgress,
    overallPercentage,
    completedCategoriesCount,
    totalCategoriesCount,
    isLoading: isProgressLoading,
  } = useCategoryProgress(date);

  useEffect(() => { fetchConfig(); }, []);

  const formattedDate = useMemo(() => {
    if (!date) return null;
    const parts = date.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
    return date;
  }, [date]);

  const categories = config?.categories.filter(c => c.isActive) ?? [];

  const grouped = ROLE_ORDER
    .map(role => ({
      role,
      label: ROLE_LABEL[role],
      items: categories
        .filter(c => c.role === role)
        .sort((a, b) => a.order - b.order),
    }))
    .filter(g => g.items.length > 0);

  if (isConfigLoading && !config) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Log Something' }} />
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  const isAllComplete = overallPercentage >= 100;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: formattedDate ? `Log for ${formattedDate}` : 'What would you like to log?',
        }}
      />

      {formattedDate && (
        <View style={styles.pastDateBanner}>
          <Calendar size={15} color={palette.primary} strokeWidth={2.4} />
          <Text style={styles.pastDateBannerText}>
            Logging for <Text style={styles.pastDateHighlight}>{formattedDate}</Text>
          </Text>
        </View>
      )}

      {/* Daily Progress Overview Card */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewHeader}>
          <View style={styles.overviewLeft}>
            <View style={styles.overviewTitleRow}>
              <Text style={styles.overviewTitle}>Daily Logging Progress</Text>
              {isAllComplete && (
                <Sparkles size={14} color={palette.success} strokeWidth={2.4} />
              )}
            </View>
            <Text style={styles.overviewSubtitle}>
              {completedCategoriesCount} of {totalCategoriesCount} categories completed
            </Text>
          </View>

          <View style={[styles.overviewBadge, isAllComplete && styles.overviewBadgeComplete]}>
            {isAllComplete ? (
              <Check size={12} color="#FFFFFF" strokeWidth={3} />
            ) : null}
            <Text style={[styles.overviewBadgeText, isAllComplete && styles.overviewBadgeTextComplete]}>
              {overallPercentage}%
            </Text>
          </View>
        </View>

        {/* Overview Bar */}
        <View style={styles.overviewTrack}>
          <View
            style={[
              styles.overviewFill,
              {
                width: `${overallPercentage}%`,
                backgroundColor: isAllComplete ? palette.success : palette.primary,
              },
            ]}
          />
        </View>
      </View>

      <FlatList
        data={grouped}
        keyExtractor={g => g.role}
        contentContainerStyle={styles.list}
        renderItem={({ item: group }) => (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{group.label}</Text>
            {group.items.map(cat => (
              <CategoryRow
                key={cat._id}
                category={cat}
                progressInfo={getCategoryProgress(cat._id)}
                onPress={() =>
                  router.push({
                    pathname: `/log/${cat._id}`,
                    params: date ? { date } : undefined,
                  })
                }
              />
            ))}
          </View>
        )}
      />
    </View>
  );
}

function CategoryRow({
  category,
  progressInfo,
  onPress,
}: {
  category: ICategory;
  progressInfo: CategoryProgressInfo;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const styles = useStyles();

  const {
    percentage,
    progress,
    isComplete,
    isLoggedToday,
    answeredQuestions,
    totalQuestions,
    count,
    latestTimeStr,
  } = progressInfo;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        isComplete && styles.rowComplete,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Log ${category.name}, progress ${percentage} percent${isComplete ? ', complete' : ''}`}
      activeOpacity={0.75}
    >
      <View style={styles.rowMain}>
        <View style={[styles.dot, { backgroundColor: category.color || palette.primary }]}>
          <Text style={styles.dotIcon}>{category.icon}</Text>
        </View>

        <View style={styles.titleColumn}>
          <Text style={styles.rowLabel}>{category.name}</Text>
          <Text style={styles.progressSubtitle}>
            {totalQuestions > 0
              ? `${answeredQuestions} of ${totalQuestions} questions answered`
              : (isLoggedToday ? (count > 1 ? `${count}x • ${latestTimeStr || 'logged'}` : 'Logged today') : 'Not logged today')}
          </Text>
        </View>

        {/* Status / Percentage Badge */}
        {isComplete ? (
          <View style={styles.loggedBadge}>
            <Check size={11} color={palette.success} strokeWidth={2.8} />
            <Text style={styles.loggedBadgeText}>100%</Text>
          </View>
        ) : progress > 0 ? (
          <View style={styles.inProgressBadge}>
            <Text style={styles.inProgressBadgeText}>{percentage}%</Text>
          </View>
        ) : (
          <View style={styles.notLoggedBadge}>
            <Text style={styles.notLoggedText}>0%</Text>
          </View>
        )}

        <Text style={styles.chevron}>›</Text>
      </View>

      {/* Sleek Horizontal Progress Bar along the bottom of the card */}
      <View style={styles.progressBarTrack}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${percentage}%`,
              backgroundColor: isComplete ? palette.success : (category.color || palette.primary),
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  pastDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: palette.primary + '14',
    borderWidth: 1,
    borderColor: palette.primary + '30',
  },
  pastDateBannerText: {
    ...typography.caption,
    fontSize: 13,
    color: palette.text,
    fontWeight: '600',
  },
  pastDateHighlight: {
    color: palette.primary,
    fontWeight: '800',
  },

  // Daily Progress Overview Card
  overviewCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 10,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overviewLeft: {
    gap: 2,
    flex: 1,
  },
  overviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overviewTitle: {
    ...typography.smallBold,
    fontSize: 13.5,
    color: palette.text,
    fontWeight: '700',
  },
  overviewSubtitle: {
    ...typography.caption,
    fontSize: 12,
    color: palette.textSecondary,
    fontWeight: '500',
  },
  overviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: palette.primary + '16',
    borderWidth: 1,
    borderColor: palette.primary + '30',
  },
  overviewBadgeComplete: {
    backgroundColor: palette.success,
    borderColor: palette.success,
  },
  overviewBadgeText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
  },
  overviewBadgeTextComplete: {
    color: '#FFFFFF',
  },
  overviewTrack: {
    height: 6,
    width: '100%',
    backgroundColor: palette.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  overviewFill: {
    height: '100%',
    borderRadius: 3,
  },

  list: { padding: 16, gap: 20 },
  section: { gap: 8 },
  sectionLabel: {
    ...typography.label,
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
    marginLeft: 4,
  },
  row: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  rowComplete: {
    borderColor: palette.success + '40',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotIcon: { fontSize: 19 },
  titleColumn: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...typography.body,
    fontWeight: '600',
    color: palette.text,
  },
  progressSubtitle: {
    ...typography.caption,
    fontSize: 11.5,
    color: palette.textSecondary,
    fontWeight: '500',
  },
  progressBarTrack: {
    height: 3.5,
    width: '100%',
    backgroundColor: palette.surfaceAlt,
  },
  progressBarFill: {
    height: '100%',
  },
  loggedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.success + '16',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: palette.success + '30',
  },
  loggedBadgeText: {
    ...typography.caption,
    color: palette.success,
    fontWeight: '700',
    fontSize: 11.5,
  },
  inProgressBadge: {
    backgroundColor: palette.primary + '16',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: palette.primary + '30',
  },
  inProgressBadgeText: {
    ...typography.caption,
    color: palette.primary,
    fontWeight: '700',
    fontSize: 11.5,
  },
  notLoggedBadge: {
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: palette.border,
  },
  notLoggedText: {
    ...typography.caption,
    color: palette.textDisabled,
    fontWeight: '600',
    fontSize: 11.5,
  },
  chevron: { ...typography.h4, color: palette.textDisabled, marginLeft: 2 },
}));
