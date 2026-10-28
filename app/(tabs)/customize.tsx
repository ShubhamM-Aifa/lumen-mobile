/**
 * Customize tab: entry point for the tracking setup and the places around it.
 * iOS inset-grouped list: Tracking, Library, Spaces, App.
 * Everything here is the user's own: edit, hide or delete anything.
 */
import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ScrollView,
  ActivityIndicator,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
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
  Search,
  X,
  HelpCircle,
  FileBadge,
} from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { useConfigStore } from '../../src/store/configStore';
import { useReminderStore } from '../../src/store/reminderStore';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { InsetGroup, GroupedRow } from '../../src/components/ios/InsetGroup';
import { TAB_BAR_CLEARANCE } from '../../src/components/ios/iosTheme';
import { typography } from '../../src/theme/typography';

export default function CustomizeScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { config, fetchConfig, isLoading } = useConfigStore();
  const reminders = useReminderStore(s => s.reminders);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const go = (route: string) => () => router.push(route as never);
  const count = (n: number | undefined) => (n === undefined ? undefined : String(n));
  const remindersOn = reminders.filter(r => r.enabled).length;

  const handleToggleSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isSearching) {
      setSearchQuery('');
      setIsSearching(false);
    } else {
      setIsSearching(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const allTools = useMemo(() => [
    {
      id: 'categories',
      label: 'Categories & Questions',
      sub: 'Customize symptom categories and questionnaire forms',
      route: '/customize/categories',
      icon: FolderTree,
      tile: palette.warning,
      group: 'Tracking',
      keywords: ['categories', 'questions', 'symptoms', 'forms', 'trackers', 'inputs'],
      value: count(config?.categories?.length),
    },
    {
      id: 'quick-log',
      label: 'Quick Log Setup',
      sub: 'Manage questionnaire flow and active screens',
      route: '/customize/quick-log-questions',
      icon: Zap,
      tile: palette.warning,
      group: 'Tracking',
      keywords: ['quick log', 'log questions', 'fast log', 'flow', 'order'],
    },
    {
      id: 'quick-actions',
      label: 'Quick-Tap Buttons',
      sub: 'One-tap homescreen widgets and action counters',
      route: '/customize/quick-actions',
      icon: MousePointerClick,
      tile: palette.success,
      group: 'Tracking',
      keywords: ['quick tap', 'buttons', 'widgets', 'counters', 'timers'],
      value: count(config?.quickActions?.filter(a => a.isVisible)?.length),
    },
    {
      id: 'at-a-glance',
      label: 'Today at a Glance',
      sub: 'Configure daily overview cards and metrics',
      route: '/customize/at-a-glance',
      icon: LayoutGrid,
      tile: palette.secondary,
      group: 'Tracking',
      keywords: ['at a glance', 'today cards', 'dashboard', 'overview', 'summary'],
    },
    {
      id: 'units',
      label: 'Custom Units',
      sub: 'Create and configure measurement units',
      route: '/customize/units',
      icon: FlaskConical,
      tile: '#8E8E93',
      group: 'Tracking',
      keywords: ['units', 'custom units', 'measurements', 'scales'],
      value: count(config?.customUnits?.length),
    },
    {
      id: 'templates',
      label: 'Template Library',
      sub: 'Prebuilt health tracking packs and community setups',
      route: '/customize/templates',
      icon: Library,
      tile: palette.catMeds,
      group: 'Library',
      keywords: ['templates', 'prebuilt', 'library', 'packs', 'lupus', 'arthritis', 'crohns'],
    },
    {
      id: 'medications',
      label: 'Medications',
      sub: 'Manage prescription and supplement lists',
      route: '/customize/medications',
      icon: Pill,
      tile: palette.catVitals,
      group: 'Library',
      keywords: ['medications', 'pills', 'supplements', 'drugs', 'prescriptions'],
    },
    {
      id: 'reminders',
      label: 'Reminders',
      sub: 'Medication alerts, walk prompts and daily logs',
      route: '/reminders?mode=reminders',
      icon: Bell,
      tile: palette.error,
      group: 'Library',
      keywords: ['reminders', 'alerts', 'notifications', 'alarms', 'schedules'],
      value: `${remindersOn} on`,
    },
    {
      id: 'todo',
      label: 'To Do',
      sub: 'Energy-paced task tracking and checklists',
      route: '/todo',
      icon: ListChecks,
      tile: palette.tint,
      group: 'Spaces',
      keywords: ['todo', 'to do', 'tasks', 'checklists', 'pacing', 'spoons'],
    },
    {
      id: 'notes',
      label: 'Notes & Docs',
      sub: 'Clinical notes, appointment prep and checklists',
      route: '/notes',
      icon: FileText,
      tile: '#FFB000',
      group: 'Spaces',
      keywords: ['notes', 'docs', 'documents', 'doctor notes', 'journal', 'clinical'],
    },
    {
      id: 'health-records',
      label: 'Health Records & Rx',
      sub: 'Blood tests, lab reports & doctor prescriptions',
      route: '/records',
      icon: FileBadge,
      tile: '#0284C7',
      group: 'Spaces',
      keywords: ['health records', 'blood test', 'lab report', 'prescription', 'doctor rx', 'imaging', 'blood', 'doctor'],
    },
    {
      id: 'community',
      label: 'Community',
      sub: 'Channels, shared advice and support spaces',
      route: '/community',
      icon: Users,
      tile: palette.catMood,
      group: 'Spaces',
      keywords: ['community', 'channels', 'chat', 'discussion', 'support'],
    },
    {
      id: 'settings',
      label: 'Profile & Settings',
      sub: 'Accounts, vitals, appearance, security and backup',
      route: '/settings',
      icon: UserCog,
      tile: '#8E8E93',
      group: 'App',
      keywords: ['settings', 'profile', 'theme', 'dark mode', 'account', 'security'],
    },
    {
      id: 'export',
      label: 'Export Setup',
      sub: 'Back up or share your tracking setup',
      route: '/customize/export',
      icon: Share2,
      tile: palette.success,
      group: 'App',
      keywords: ['export', 'backup', 'share setup', 'import setup', 'configuration'],
    },
  ], [config, palette, remindersOn]);

  const query = searchQuery.trim().toLowerCase();
  const isSearchActive = query.length > 0;

  // Search Results
  const searchResults = useMemo(() => {
    if (!query) return null;

    const matchedTools = allTools.filter(t =>
      t.label.toLowerCase().includes(query) ||
      t.sub.toLowerCase().includes(query) ||
      t.keywords.some(k => k.includes(query))
    );

    const categories = config?.categories || [];
    const questions = config?.questions || [];
    const quickActions = config?.quickActions || [];
    const customUnits = config?.customUnits || [];

    const matchedCategories = categories.filter(c =>
      c.name.toLowerCase().includes(query)
    );

    const matchedQuestions = questions.filter(q =>
      q.title.toLowerCase().includes(query) ||
      (q.helpText && q.helpText.toLowerCase().includes(query))
    );

    const matchedQuickActions = quickActions.filter(a =>
      a.label.toLowerCase().includes(query)
    );

    const matchedUnits = customUnits.filter(u =>
      u.name.toLowerCase().includes(query) ||
      u.symbol.toLowerCase().includes(query)
    );

    const totalMatches =
      matchedTools.length +
      matchedCategories.length +
      matchedQuestions.length +
      matchedQuickActions.length +
      matchedUnits.length;

    return {
      tools: matchedTools,
      categories: matchedCategories,
      questions: matchedQuestions,
      quickActions: matchedQuickActions,
      units: matchedUnits,
      totalMatches,
    };
  }, [query, allTools, config]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    config?.categories?.forEach(c => map.set(c._id, c.name));
    return map;
  }, [config?.categories]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_CLEARANCE }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LargeTitleHeader
          title="Customize"
          subtitle="Everything here is yours. Edit, hide or delete anything."
          actions={
            <GlassCircleButton
              accessibilityLabel="Search customize"
              onPress={handleToggleSearch}
            >
              <Search
                size={20}
                color={isSearching || isSearchActive ? palette.tint : palette.text}
                strokeWidth={2.2}
              />
            </GlassCircleButton>
          }
        />

        {/* Apple-style search bar */}
        <View style={styles.searchBar}>
          <Search size={16} color={palette.textSecondary} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search tools, categories, questions..."
            placeholderTextColor={palette.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            accessibilityLabel="Search customize"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={16} color={palette.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {isLoading && !config ? (
          <View style={styles.loading}><ActivityIndicator color={palette.tint} /></View>
        ) : null}

        {isSearchActive && searchResults ? (
          searchResults.totalMatches === 0 ? (
            <View style={styles.emptySearchWrap}>
              <View style={styles.emptyIconCircle}>
                <Search size={28} color={palette.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>No Results Found</Text>
              <Text style={styles.emptyDesc}>
                No tools, categories, or questions matching &quot;{searchQuery}&quot;.
              </Text>
              <TouchableOpacity
                style={styles.clearSearchBtn}
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Text style={styles.clearSearchBtnText}>Clear Search</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {searchResults.tools.length > 0 && (
                <InsetGroup title="Tools & Spaces">
                  {searchResults.tools.map(t => (
                    <GroupedRow
                      key={t.id}
                      icon={t.icon}
                      tile={t.tile}
                      label={t.label}
                      sub={t.sub}
                      value={t.value}
                      chevron
                      onPress={go(t.route)}
                    />
                  ))}
                </InsetGroup>
              )}

              {searchResults.categories.length > 0 && (
                <InsetGroup title="Categories">
                  {searchResults.categories.map(c => (
                    <GroupedRow
                      key={c._id}
                      emoji={c.icon}
                      tile={c.color || palette.tint}
                      label={c.name}
                      sub={`Category · ${c.role}`}
                      chevron
                      onPress={go(`/customize/category/${c._id}`)}
                    />
                  ))}
                </InsetGroup>
              )}

              {searchResults.questions.length > 0 && (
                <InsetGroup title="Questions">
                  {searchResults.questions.map(q => {
                    const parentCatName = categoryMap.get(q.categoryId) || 'Questionnaire';
                    return (
                      <GroupedRow
                        key={q._id}
                        icon={HelpCircle}
                        tile={q.color || palette.warning}
                        label={q.title}
                        sub={`In ${parentCatName} · ${q.frequency}`}
                        chevron
                        onPress={go(`/customize/question/${q._id}`)}
                      />
                    );
                  })}
                </InsetGroup>
              )}

              {searchResults.quickActions.length > 0 && (
                <InsetGroup title="Quick-Tap Buttons">
                  {searchResults.quickActions.map(a => (
                    <GroupedRow
                      key={a._id}
                      emoji={a.icon}
                      tile={a.color || palette.success}
                      label={a.label}
                      sub={`Action (${a.mode})`}
                      chevron
                      onPress={go('/customize/quick-actions')}
                    />
                  ))}
                </InsetGroup>
              )}

              {searchResults.units.length > 0 && (
                <InsetGroup title="Custom Units">
                  {searchResults.units.map(u => (
                    <GroupedRow
                      key={u._id}
                      icon={FlaskConical}
                      tile="#8E8E93"
                      label={u.name}
                      sub={`Symbol: ${u.symbol}${u.dimension ? ` · ${u.dimension}` : ''}`}
                      chevron
                      onPress={go('/customize/units')}
                    />
                  ))}
                </InsetGroup>
              )}
            </>
          )
        ) : (
          <>
            <InsetGroup title="Tracking">
              <GroupedRow icon={FolderTree} tile={palette.warning} label="Categories & Questions" value={count(config?.categories?.length)} chevron onPress={go('/customize/categories')} />
              <GroupedRow icon={Zap} tile={palette.warning} label="Quick Log Setup" chevron onPress={go('/customize/quick-log-questions')} />
              <GroupedRow icon={MousePointerClick} tile={palette.success} label="Quick-Tap Buttons" value={count(config?.quickActions?.filter(a => a.isVisible)?.length)} chevron onPress={go('/customize/quick-actions')} />
              <GroupedRow icon={LayoutGrid} tile={palette.secondary} label="Today at a Glance" chevron onPress={go('/customize/at-a-glance')} />
              <GroupedRow icon={FlaskConical} tile="#8E8E93" label="Custom Units" value={count(config?.customUnits?.length)} chevron onPress={go('/customize/units')} />
            </InsetGroup>

            <InsetGroup title="Library">
              <GroupedRow icon={Library} tile={palette.catMeds} label="Template Library" chevron onPress={go('/customize/templates')} />
              <GroupedRow icon={Pill} tile={palette.catVitals} label="Medications" chevron onPress={go('/customize/medications')} />
              <GroupedRow icon={Bell} tile={palette.error} label="Reminders" value={`${remindersOn} on`} chevron onPress={go('/reminders?mode=reminders')} />
            </InsetGroup>

            <InsetGroup title="Spaces">
              <GroupedRow icon={ListChecks} tile={palette.tint} label="To Do" chevron onPress={go('/todo')} />
              <GroupedRow icon={FileText} tile="#FFB000" label="Notes & Docs" chevron onPress={go('/notes')} />
              <GroupedRow icon={FileBadge} tile="#0284C7" label="Health Records & Rx" sub="Blood tests & doctor prescriptions" chevron onPress={go('/records')} />
              <GroupedRow icon={Users} tile={palette.catMood} label="Community" chevron onPress={go('/community')} />
            </InsetGroup>

            <InsetGroup title="App">
              <GroupedRow icon={UserCog} tile="#8E8E93" label="Profile & Settings" chevron onPress={go('/settings')} />
              <GroupedRow icon={Share2} tile={palette.success} label="Export Setup" sub="Back up or share your tracking setup" chevron onPress={go('/customize/export')} />
            </InsetGroup>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { gap: 20, paddingTop: 6 },
  loading: { paddingVertical: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 22,
    gap: 8,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  searchInput: {
    flex: 1,
    ...typography.bodyLarge,
    color: palette.text,
    paddingVertical: 8,
  },
  emptySearchWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    ...typography.headline,
    color: palette.text,
    textAlign: 'center',
  },
  emptyDesc: {
    ...typography.subhead,
    color: palette.textSecondary,
    textAlign: 'center',
  },
  clearSearchBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  clearSearchBtnText: {
    ...typography.bodyBold,
    color: palette.tint,
  },
}));
