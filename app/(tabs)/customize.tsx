/**
 * Customize tab: entry point for the tracking setup and the places around it.
 * iOS inset-grouped list: Tracking, Library, Spaces, App.
 * Everything here is the user's own: edit, hide or delete anything.
 */
import React, { useEffect } from 'react';
import { ScrollView, ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  FolderTree,
  Zap,
  MousePointerClick,
  LayoutGrid,
  FlaskConical,
  Library,
  Pill,
  Bell,
  ListChecks,
  FileText,
  Users,
  Share2,
  UserCog,
} from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { useConfigStore } from '../../src/store/configStore';
import { useReminderStore } from '../../src/store/reminderStore';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { InsetGroup, GroupedRow } from '../../src/components/ios/InsetGroup';
import { TAB_BAR_CLEARANCE } from '../../src/components/ios/iosTheme';

export default function CustomizeScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { config, fetchConfig, isLoading } = useConfigStore();
  const reminders = useReminderStore(s => s.reminders);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const go = (route: string) => () => router.push(route as never);
  const count = (n: number | undefined) => (n === undefined ? undefined : String(n));
  const remindersOn = reminders.filter(r => r.enabled).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_CLEARANCE }]}
        showsVerticalScrollIndicator={false}
      >
        <LargeTitleHeader
          title="Customize"
          subtitle="Everything here is yours. Edit, hide or delete anything."
        />
        {isLoading && !config ? (
          <View style={styles.loading}><ActivityIndicator color={palette.tint} /></View>
        ) : null}

        <InsetGroup title="Tracking">
          <GroupedRow icon={FolderTree} tile={palette.warning} label="Categories & Questions" value={count(config?.categories.length)} chevron onPress={go('/customize/categories')} />
          <GroupedRow icon={Zap} tile={palette.warning} label="Quick Log Setup" chevron onPress={go('/customize/quick-log-questions')} />
          <GroupedRow icon={MousePointerClick} tile={palette.success} label="Quick-Tap Buttons" value={count(config?.quickActions.filter(a => a.isVisible).length)} chevron onPress={go('/customize/quick-actions')} />
          <GroupedRow icon={LayoutGrid} tile={palette.secondary} label="Today at a Glance" chevron onPress={go('/customize/at-a-glance')} />
          <GroupedRow icon={FlaskConical} tile="#8E8E93" label="Custom Units" value={count(config?.customUnits.length)} chevron onPress={go('/customize/units')} />
        </InsetGroup>

        <InsetGroup title="Library">
          <GroupedRow icon={Library} tile={palette.catMeds} label="Template Library" chevron onPress={go('/customize/templates')} />
          <GroupedRow icon={Pill} tile={palette.catVitals} label="Medications" chevron onPress={go('/customize/medications')} />
          <GroupedRow icon={Bell} tile={palette.error} label="Reminders" value={`${remindersOn} on`} chevron onPress={go('/reminders?mode=reminders')} />
        </InsetGroup>

        <InsetGroup title="Spaces">
          <GroupedRow icon={ListChecks} tile={palette.tint} label="To Do" chevron onPress={go('/todo')} />
          <GroupedRow icon={FileText} tile="#FFB000" label="Notes & Docs" chevron onPress={go('/notes')} />
          <GroupedRow icon={Users} tile={palette.catMood} label="Community" chevron onPress={go('/community')} />
        </InsetGroup>

        <InsetGroup title="App">
          <GroupedRow icon={UserCog} tile="#8E8E93" label="Profile & Settings" chevron onPress={go('/settings')} />
          <GroupedRow icon={Share2} tile={palette.success} label="Export Setup" sub="Back up or share your tracking setup" chevron onPress={go('/customize/export')} />
        </InsetGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { gap: 22, paddingTop: 6 },
  loading: { paddingVertical: 8 },
}));
