/**
 * Fill in medicine doses for past days: step back day by day and mark Taken / Skipped.
 * Leaving a dose unmarked is fine; it is never counted as skipped.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { TodayMedsCard } from '../../src/components/home/TodayMedsCard';
import { useDoses } from '../../src/hooks/useDoses';
import { createThemedStyles, useTheme } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

const shift = (day: string, delta: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};
const pretty = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export default function DoseBackfillScreen() {
  const styles = useStyles();
  const { palette } = useTheme();
  const today = useDoses();
  const todayKey = today.data?.today ?? null;
  const [day, setDay] = useState<string | null>(null);
  const current = day ?? (todayKey ? shift(todayKey, -1) : null);
  const canForward = useMemo(() => !!current && !!todayKey && current < todayKey, [current, todayKey]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenTopBar title="Medicine doses" subtitle="Fill in past days" fallbackRoute="/(tabs)/today" />
      <ScrollView contentContainerStyle={styles.content}>
        {current ? (
          <>
            <View style={styles.nav}>
              <TouchableOpacity onPress={() => setDay(shift(current, -1))} accessibilityRole="button" accessibilityLabel="Previous day" style={styles.navBtn} hitSlop={8}>
                <ChevronLeft size={22} color={palette.primaryText} />
              </TouchableOpacity>
              <Text style={styles.day} accessibilityRole="header">{current === todayKey ? 'Today' : pretty(current)}</Text>
              <TouchableOpacity
                onPress={() => canForward && setDay(shift(current, 1))}
                disabled={!canForward}
                accessibilityRole="button"
                accessibilityLabel="Next day"
                accessibilityState={{ disabled: !canForward }}
                style={[styles.navBtn, !canForward && { opacity: 0.3 }]}
                hitSlop={8}
              >
                <ChevronRight size={22} color={palette.primaryText} />
              </TouchableOpacity>
            </View>
            <TodayMedsCard day={current} embedded />
            <Text style={styles.help}>
              Only medicines with dose times show here. Add or change dose times in Customize › Medicines; past days keep the times that applied then.
            </Text>
          </>
        ) : (
          <Text style={styles.help}>Loading…</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, gap: 16 },
  nav: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  navBtn: { width: 44, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
  day: { ...typography.headline, color: palette.text, flex: 1, textAlign: 'center' as const },
  help: { ...typography.footnote, color: palette.textSecondary },
}));
