/**
 * Category picker — first step of the log flow.
 * Grouped by role: Symptoms first, then Trigger candidates, then Context.
 */
import React, { useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Check, Calendar } from 'lucide-react-native';
import { ICategory } from '@lumen/shared';
import { useConfigStore } from '../../src/store/configStore';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { useTodayCategoryLogs, CategoryLogStatus } from '../../src/hooks/useTodayCategoryLogs';

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
  const { config, isLoading, fetchConfig } = useConfigStore();
  const { getCategoryStatus } = useTodayCategoryLogs(date);

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

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Log Something' }} />
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

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
                status={getCategoryStatus(cat._id)}
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
  status,
  onPress,
}: {
  category: ICategory;
  status: CategoryLogStatus;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const styles = useStyles();

  return (
    <TouchableOpacity
      style={[
        styles.row,
        status.isLoggedToday && styles.rowLogged,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Log ${category.name}${status.isLoggedToday ? ', already logged today' : ''}`}
    >
      <View style={[styles.dot, { backgroundColor: category.color || palette.primary }]}>
        <Text style={styles.dotIcon}>{category.icon}</Text>
      </View>
      <Text style={styles.rowLabel}>{category.name}</Text>

      {status.isLoggedToday ? (
        <View style={styles.loggedBadge}>
          <Check size={11} color={palette.success} strokeWidth={2.8} />
          <Text style={styles.loggedBadgeText}>
            {status.count > 1 ? `${status.count}x • ${status.latestTimeStr}` : `Logged ${status.latestTimeStr}`}
          </Text>
        </View>
      ) : (
        <Text style={styles.notLoggedText}>Not logged</Text>
      )}

      <Text style={styles.chevron}>›</Text>
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
  list: { padding: 16, gap: 20 },
  section: { gap: 6 },
  sectionLabel: {
    ...typography.label,
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: palette.surface,
    borderRadius: 14, borderWidth: 1, borderColor: palette.border,
    paddingHorizontal: 14, paddingVertical: 14,
    minHeight: 56,
  },
  rowLogged: {
    borderColor: palette.success + '40',
  },
  dot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  dotIcon: { fontSize: 18 },
  rowLabel: { ...typography.body, color: palette.text, flex: 1 },
  loggedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.success + '16',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.success + '30',
  },
  loggedBadgeText: {
    ...typography.caption,
    color: palette.success,
    fontWeight: '600',
  },
  notLoggedText: {
    ...typography.caption,
    color: palette.textDisabled,
  },
  chevron: { ...typography.h4, color: palette.textDisabled },
}));
