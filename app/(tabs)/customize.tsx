/**
 * Customize screen — entry point for the configuration builder.
 * Shows categories; tapping one drills into its questions → options → fields.
 * Users can add new categories, questions, options and fields from here.
 * Also shows quick actions, template library, medications and reminders.
 */
import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  FolderTree,
  Zap,
  MousePointerClick,
  LayoutGrid,
  Library,
  Pill,
  Bell,
  UserCheck,
  Share2,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { useConfigStore } from '../../src/store/configStore';

interface NavItem {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  color: string;
  title: string;
  subtitle: string;
  route: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    icon: FolderTree,
    color: '#F59E0B',
    title: 'Categories & Questions',
    subtitle: 'Build your tracking forms',
    route: '/customize/categories',
  },
  {
    icon: Zap,
    color: '#FF6B35',
    title: 'Quick Log Setup',
    subtitle: 'Choose up to 5 questions for Quick Log',
    route: '/customize/quick-log-questions',
  },
  {
    icon: MousePointerClick,
    color: '#10B981',
    title: 'Quick-tap buttons',
    subtitle: 'Manage your home screen buttons',
    route: '/customize/quick-actions',
  },
  {
    icon: LayoutGrid,
    color: '#06B6D4',
    title: 'Today at a Glance',
    subtitle: 'Add, remove & customize home metrics',
    route: '/customize/at-a-glance',
  },
  {
    icon: Library,
    color: '#8B5CF6',
    title: 'Template library',
    subtitle: 'Add ready-made trackers',
    route: '/customize/templates',
  },
  {
    icon: Pill,
    color: '#F43F5E',
    title: 'Medications',
    subtitle: 'Your medication list',
    route: '/customize/medications',
  },
  {
    icon: Bell,
    color: '#0284C7',
    title: 'Reminders',
    subtitle: 'Time and inactivity alerts',
    route: '/reminders?mode=reminders',
  },
  {
    icon: UserCheck,
    color: '#64748B',
    title: 'Profile & Settings',
    subtitle: 'Personal info, conditions & app preferences',
    route: '/settings',
  },
  {
    icon: Share2,
    color: '#059669',
    title: 'Export config',
    subtitle: 'Back up or share your setup',
    route: '/customize/export',
  },
];

export default function CustomizeScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { config, fetchConfig, isLoading } = useConfigStore();

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Customize</Text>
        <Text style={styles.sub}>Everything here is yours — edit, hide or delete anything.</Text>

        {/* Config overview chips */}
        {config && (
          <View style={styles.chips}>
            <Chip label={`${config.categories.length} categories`} />
            <Chip label={`${config.questions.length} questions`} />
            <Chip label={`${config.quickActions.length} quick actions`} />
          </View>
        )}
        {isLoading && <ActivityIndicator color={palette.primary} style={{ marginBottom: 20 }} />}

        {/* Navigation list */}
        {NAV_ITEMS.map(item => (
          <NavCard key={item.route} item={item} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ label }: { label: string }) {
  const chipStyles = useChipStyles();
  return (
    <View style={chipStyles.chip}>
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  );
}

function NavCard({ item }: { item: NavItem }) {
  const navStyles = useNavStyles();
  const { palette } = useTheme();
  const IconComponent = item.icon;

  return (
    <TouchableOpacity
      style={navStyles.card}
      onPress={() => router.push(item.route as never)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      activeOpacity={0.75}
    >
      <View style={[navStyles.iconBadge, { backgroundColor: item.color + '1A' }]}>
        <IconComponent size={20} color={item.color} strokeWidth={2.2} />
      </View>
      <View style={navStyles.text}>
        <Text style={navStyles.title}>{item.title}</Text>
        <Text style={navStyles.subtitle}>{item.subtitle}</Text>
      </View>
      <ChevronRight size={18} color={palette.textDisabled} />
    </TouchableOpacity>
  );
}

const useChipStyles = createThemedStyles(palette => ({
  chip: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: palette.border,
  },
  label: { ...typography.small, color: palette.textSecondary },
}));

const useNavStyles = createThemedStyles(palette => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  text:     { flex: 1 },
  title:    { ...typography.bodyBold, color: palette.text, fontSize: 15 },
  subtitle: { ...typography.caption, color: palette.textSecondary, marginTop: 2, fontSize: 12 },
}));

const useStyles = createThemedStyles(palette => ({
  safe:    { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, paddingBottom: 125 },
  heading: { ...typography.h2, color: palette.text, marginBottom: 8 },
  sub:     { ...typography.body, color: palette.textSecondary, marginBottom: 16 },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
}));
