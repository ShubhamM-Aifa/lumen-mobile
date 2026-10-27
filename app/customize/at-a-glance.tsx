import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { AppleSwitch } from '../../src/components/common/AppleSwitch';
import { Stack } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import {
  ChevronLeft,
  LayoutGrid,
  Droplets,
  Footprints,
  Bell,
  Stethoscope,
  Sun,
  Timer,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import {
  useGlanceConfigStore,
  AVAILABLE_METRICS,
  GlanceMetricKey,
} from '../../src/store/glanceConfigStore';

const ICONS_MAP: Record<GlanceMetricKey, React.ComponentType<{ size: number; color: string; strokeWidth?: number }>> = {
  water: Droplets,
  walking: Footprints,
  reminders: Bell,
  quick_logs: Stethoscope,
  day_session: Sun,
  active_time: Timer,
};

export default function AtAGlanceCustomizeScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const {
    enabledMetrics,
    fetchGlanceConfig,
    toggleMetric,
    resetToDefaults,
    getActiveCount,
  } = useGlanceConfigStore();

  useEffect(() => {
    fetchGlanceConfig();
  }, [fetchGlanceConfig]);

  const activeCount = getActiveCount();
  const isEven = activeCount % 2 === 0;

  const handleToggle = async (key: GlanceMetricKey) => {
    Haptics.selectionAsync();
    await toggleMetric(key);
  };

  const handleReset = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await resetToDefaults();
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Today at a Glance',
          headerStyle: { backgroundColor: palette.surface },
          headerTintColor: palette.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => safeGoBack('/customize')}
              accessibilityRole="button"
              accessibilityLabel="Back to Customize"
            >
              <ChevronLeft size={24} color={palette.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={styles.resetHeaderBtn}
              onPress={handleReset}
              accessibilityRole="button"
              accessibilityLabel="Reset to defaults"
            >
              <RotateCcw size={16} color={palette.textSecondary} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Info & Counter Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.badgePill}>
              <LayoutGrid size={14} color={palette.primaryText} />
              <Text style={styles.badgePillText}>{activeCount} of 6 Active</Text>
            </View>
            <View style={[styles.layoutBadge, { backgroundColor: isEven ? '#10B98118' : '#F59E0B18' }]}>
              <Text style={[styles.layoutBadgeText, { color: isEven ? '#10B981' : '#F59E0B' }]}>
                {isEven ? 'Balanced 2-col' : 'Odd layout'}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Customize Home Dashboard</Text>
          <Text style={styles.heroDescription}>
            Add or remove metrics shown in the "Today at a glance" section on your Home screen.
          </Text>

          <View style={styles.tipBox}>
            <Info size={14} color={palette.textSecondary} style={{ marginTop: 2 }} />
            <Text style={styles.tipText}>
              Tip: Choosing an even number (2, 4, or 6 cards) ensures your home screen grid is completely symmetrical without empty holes.
            </Text>
          </View>
        </View>

        {/* Metrics List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dashboard Cards</Text>
          <Text style={styles.sectionSubtitle}>Toggle items on or off</Text>
        </View>

        <View style={styles.listContainer}>
          {AVAILABLE_METRICS.map(item => {
            const isEnabled = enabledMetrics[item.key] ?? true;
            const IconComp = ICONS_MAP[item.key] || Sparkles;

            return (
              <View key={item.key} style={[styles.metricCard, !isEnabled && styles.metricCardDisabled]}>
                <View style={[styles.iconSquircle, { backgroundColor: item.color + '1A' }]}>
                  <IconComp size={22} color={item.color} strokeWidth={2.2} />
                </View>

                <View style={styles.textContainer}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.metricTitle, !isEnabled && styles.textDisabled]}>
                      {item.label}
                    </Text>
                    <View style={[styles.catBadge, { backgroundColor: palette.surfaceAlt }]}>
                      <Text style={styles.catBadgeText}>{item.category}</Text>
                    </View>
                  </View>
                  <Text style={[styles.metricDesc, !isEnabled && styles.textDisabled]}>
                    {item.description}
                  </Text>
                </View>

                <AppleSwitch
                  value={isEnabled}
                  onValueChange={() => handleToggle(item.key)}
                  activeColor={palette.primary || '#34C759'}
                  accessibilityLabel={item.label}
                />
              </View>
            );
          })}
        </View>

        {/* Bottom actions */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => safeGoBack('/(tabs)/today')}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>View on Home Screen</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <RotateCcw size={15} color={palette.textSecondary} />
            <Text style={styles.resetBtnText}>Reset to default metrics</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  resetHeaderBtn: {
    padding: 6,
    marginLeft: 8,
  },
  heroCard: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.primary + '18',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgePillText: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.primaryText,
    fontSize: 12,
  },
  layoutBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  layoutBadgeText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  heroTitle: {
    ...typography.h3,
    color: palette.text,
    fontSize: 18,
  },
  heroDescription: {
    ...typography.body,
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: palette.surfaceAlt,
    borderRadius: 12,
    padding: 10,
    marginTop: 2,
  },
  tipText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  sectionHeader: {
    marginTop: 4,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: palette.text,
    fontSize: 16,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  listContainer: {
    gap: 10,
  },
  metricCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  metricCardDisabled: {
    opacity: 0.65,
    backgroundColor: palette.surfaceAlt,
  },
  iconSquircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricTitle: {
    ...typography.bodyBold,
    color: palette.text,
    fontSize: 15,
  },
  catBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catBadgeText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  metricDesc: {
    ...typography.caption,
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  textDisabled: {
    color: palette.textDisabled,
  },
  bottomSection: {
    marginTop: 12,
    gap: 12,
    alignItems: 'center',
  },
  doneBtn: {
    width: '100%',
    backgroundColor: palette.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  doneBtnText: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 15,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  resetBtnText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
}));
