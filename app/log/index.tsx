/**
 * New Entry sheet: first step of the log flow, opened by the "+" button.
 * Progress card, two shortcuts (Quick Log, Check-in), then the user's categories
 * grouped by role: Symptoms first, then Daily Habits & Food, then Context.
 */
import React, { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { X, Zap, HeartPulse, Calendar } from 'lucide-react-native';
import { useConfigStore } from '../../src/store/configStore';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { useCategoryProgress } from '../../src/hooks/useCategoryProgress';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { InsetGroup, GroupedRow, IconTile } from '../../src/components/ios/InsetGroup';
import { ProgressRing } from '../../src/components/ios/ProgressRing';

const ROLE_ORDER = ['symptom', 'trigger_candidate', 'context'] as const;
const ROLE_LABEL: Record<string, string> = {
  symptom: 'Symptoms',
  trigger_candidate: 'Daily Habits & Food',
  context: 'Context',
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

  const grouped = useMemo(() => {
    const categories = config?.categories.filter(c => c.isActive) ?? [];
    return ROLE_ORDER
      .map(role => ({
        role,
        label: ROLE_LABEL[role],
        items: categories.filter(c => c.role === role).sort((a, b) => a.order - b.order),
      }))
      .filter(g => g.items.length > 0);
  }, [config?.categories]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/today' as never));
  const isAllComplete = overallPercentage >= 100;
  const left = Math.max(0, totalCategoriesCount - completedCategoriesCount);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <GlassCircleButton accessibilityLabel="Close" onPress={close}>
          <X size={20} color={palette.text} strokeWidth={2.4} />
        </GlassCircleButton>
        <Text style={styles.topTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {formattedDate ? 'Log Entry' : 'New Entry'}
        </Text>
        <View style={styles.topSpacer} />
      </View>

      {isConfigLoading && !config ? (
        <View style={styles.center}><ActivityIndicator color={palette.tint} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {formattedDate ? (
            <View style={styles.dateBanner} accessibilityLabel={`Logging for ${formattedDate}`}>
              <Calendar size={16} color={palette.primaryText} strokeWidth={2.4} />
              <Text style={styles.dateBannerText}>
                Logging for <Text style={styles.dateBannerStrong}>{formattedDate}</Text>
              </Text>
            </View>
          ) : null}

          <View
            style={styles.progressCard}
            accessible
            accessibilityLabel={`Daily logging progress, ${overallPercentage} percent. ${completedCategoriesCount} of ${totalCategoriesCount} categories completed.`}
          >
            <ProgressRing
              size={68}
              strokeWidth={7}
              progress={overallPercentage / 100}
              color={isAllComplete ? palette.success : palette.tint}
              trackColor={palette.surfaceAlt}
            >
              <Text style={styles.pct} maxFontSizeMultiplier={1.2}>{overallPercentage}%</Text>
            </ProgressRing>
            <View style={styles.progressText}>
              <Text style={styles.progressKicker}>Daily Logging Progress</Text>
              <Text style={styles.progressTitle}>
                {completedCategoriesCount} of {totalCategoriesCount} categories done
              </Text>
              <Text style={styles.progressHint}>
                {isAllComplete ? 'All done for today' : `${left} left · tap a category below`}
              </Text>
            </View>
          </View>

          <View style={styles.tiles}>
            <ShortcutTile
              icon={Zap}
              color="#FF9500"
              title="Quick Log"
              sub="A few fast questions"
              onPress={() => router.push('/quick-log' as never)}
            />
            <ShortcutTile
              icon={HeartPulse}
              color="#FF2D55"
              title="Check-in"
              sub="Morning & evening"
              onPress={() => router.push('/check-in' as never)}
            />
          </View>

          {grouped.map(group => (
            <InsetGroup
              key={group.role}
              title={group.label}
              footer={group.role === ROLE_ORDER[0] ? 'Tap a category to answer what’s left.' : undefined}
            >
              {group.items.map(cat => {
                const p = getCategoryProgress(cat._id);
                const sub = p.totalQuestions > 0
                  ? `${p.answeredQuestions} of ${p.totalQuestions} answered`
                  : p.isLoggedToday
                    ? (p.count > 1 ? `${p.count}x · ${p.latestTimeStr ?? 'logged'}` : 'Logged today')
                    : 'Not logged today';
                return (
                  <GroupedRow
                    key={cat._id}
                    emoji={cat.icon}
                    tile={cat.color || palette.tint}
                    label={cat.name}
                    sub={sub}
                    progress={p.totalQuestions > 0 ? p.progress : undefined}
                    progressColor={p.isComplete ? palette.success : palette.tint}
                    value={p.isComplete ? 'Done' : undefined}
                    chevron
                    accessibilityLabel={`Log ${cat.name}, ${sub}${p.isComplete ? ', complete' : ''}`}
                    onPress={() =>
                      router.push({
                        pathname: `/log/${cat._id}`,
                        params: date ? { date } : undefined,
                      })
                    }
                  />
                );
              })}
            </InsetGroup>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ShortcutTile({
  icon, color, title, sub, onPress,
}: {
  icon: React.ComponentProps<typeof IconTile>['icon'];
  color: string;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sub}`}
    >
      <IconTile icon={icon} color={color} size={34} />
      <View>
        <Text style={styles.tileTitle} maxFontSizeMultiplier={1.3}>{title}</Text>
        <Text style={styles.tileSub} maxFontSizeMultiplier={1.3}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  topTitle: { ...typography.headline, color: palette.text },
  topSpacer: { width: 44 },
  content: { gap: 20, paddingTop: 14, paddingBottom: 40 },
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: palette.surface,
  },
  dateBannerText: { ...typography.subhead, color: palette.text },
  dateBannerStrong: { color: palette.primaryText, fontWeight: '700' },
  progressCard: {
    marginHorizontal: 16,
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pct: { ...typography.headline, color: palette.text, fontVariant: ['tabular-nums'] },
  progressText: { flex: 1, gap: 3 },
  progressKicker: { ...typography.sectionLabel, color: palette.textSecondary },
  progressTitle: { ...typography.headline, color: palette.text },
  progressHint: { ...typography.subhead, color: palette.textSecondary },
  tiles: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  tile: {
    flex: 1,
    minHeight: 112,
    borderRadius: 22,
    backgroundColor: palette.surface,
    padding: 14,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tileTitle: { ...typography.headline, color: palette.text },
  tileSub: { ...typography.subhead, color: palette.textSecondary },
}));
