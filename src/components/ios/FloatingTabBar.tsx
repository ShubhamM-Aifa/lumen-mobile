import React from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { router, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, CalendarDays, Sparkles, SlidersHorizontal, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useCategoryProgress } from '../../hooks/useCategoryProgress';
import { ProgressRing } from './ProgressRing';
import { useIosSurfaces } from './iosTheme';

const TAB_ICONS: Record<string, typeof Home> = {
  today: Home,
  timeline: CalendarDays,
  insights: Sparkles,
  customize: SlidersHorizontal,
};
const TAB_ORDER = ['today', 'timeline', 'insights', 'customize'];

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * Floating translucent tab bar with the "+" log button beside it.
 * The "+" button wears a ring showing how much of today's tracking is answered.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { palette } = useTheme();
  const s = useIosSurfaces();
  const insets = useSafeAreaInsets();
  const { overallProgress, overallPercentage } = useCategoryProgress();

  const routes = TAB_ORDER
    .map(name => state.routes.find(r => r.name === name))
    .filter((r): r is NonNullable<typeof r> => !!r);
  const activeName = state.routes[state.index]?.name;
  const complete = overallProgress >= 1;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 2 }]}
    >
      <View style={[styles.bar, { shadowOpacity: s.isDark ? 0.4 : 0.1 }]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={60}
            tint={s.isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: Platform.OS === 'ios' ? s.glass : s.glassSolid }]} />
        <View style={styles.items}>
          {routes.map(route => {
            const focused = route.name === activeName;
            const Icon = TAB_ICONS[route.name] ?? Home;
            const label = descriptors[route.key].options.title ?? route.name;
            return (
              <TouchableOpacity
                key={route.key}
                style={[styles.item, focused && { backgroundColor: s.pill }]}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                  Haptics.selectionAsync().catch(() => {});
                }}
              >
                <Icon size={22} color={focused ? palette.tint : palette.text} strokeWidth={focused ? 2.4 : 1.9} />
                <Text
                  style={[styles.label, { color: focused ? palette.primaryText : palette.text }]}
                  maxFontSizeMultiplier={1.2}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          router.push('/log');
        }}
        accessibilityRole="button"
        accessibilityLabel={`New entry. ${overallPercentage}% of today's questions answered`}
        style={[styles.plusShadow, { backgroundColor: palette.surface }]}
      >
        <ProgressRing
          size={62}
          strokeWidth={3}
          progress={overallProgress}
          color={complete ? palette.success : palette.tint}
          trackColor="rgba(120,120,128,0.25)"
        >
          <View style={[styles.plus, { backgroundColor: palette.tint }]}>
            <Plus size={26} color="#FFFFFF" strokeWidth={2.6} />
          </View>
        </ProgressRing>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  bar: {
    flex: 1,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 8,
  },
  items: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 4 },
  item: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: { ...typography.tabLabel },
  plusShadow: {
    width: 62,
    height: 62,
    borderRadius: 31,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  plus: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
