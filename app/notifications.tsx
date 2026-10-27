/**
 * Notifications inbox, opened from the bell on Today. Newest first, grouped by day, with filters
 * and a read state. Reminder, insight and system notifications are recorded on this device.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  ChevronLeft, CheckCheck, BellOff, Moon,
  Droplet, Flame, BatteryMedium, MessageSquare, AtSign, Sun, CloudRain,
  Sparkles, FileCheck, Pill, Bell, ShieldAlert, MessageCircleQuestion,
  Settings,
} from 'lucide-react-native';
import { createThemedStyles, useTheme } from '../src/theme/ThemeContext';
import { typography } from '../src/theme/typography';
import { LargeTitleHeader } from '../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../src/components/ios/GlassCircleButton';
import { InsetGroup, GroupedRow } from '../src/components/ios/InsetGroup';
import { FilterChip } from '../src/components/ios/FilterChip';
import { useIntelligenceStore } from '../src/store/intelligenceStore';
import {
  useNotificationInboxStore,
  countUnread,
  isDelivered,
  dayLabel,
  InboxEntry,
  InboxIcon,
  InboxKind,
  InboxTone,
} from '../src/store/notificationInboxStore';
import { refreshInbox } from '../src/services/notificationInbox';
import { safeGoBack } from '../src/utils/navigation';

const FILTERS: Array<'All' | InboxKind> = ['All', 'Reminders', 'Insights', 'Community', 'System'];

const ICONS: Record<InboxIcon, React.ComponentProps<typeof GroupedRow>['icon']> = {
  droplet: Droplet,
  flame: Flame,
  battery: BatteryMedium,
  message: MessageSquare,
  at: AtSign,
  sun: Sun,
  'cloud-rain': CloudRain,
  sparkles: Sparkles,
  'file-check': FileCheck,
  pill: Pill,
  bell: Bell,
  shield: ShieldAlert,
  help: MessageCircleQuestion,
  moon: Moon,
};

const TONES: Record<InboxTone, string> = {
  blue: '#007AFF',
  red: '#FF3B30',
  green: '#34C759',
  indigo: '#5856D6',
  orange: '#FF9500',
  teal: '#30B0C7',
  purple: '#AF52DE',
  gray: '#8E8E93',
};

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function NotificationsScreen() {
  const styles = useStyles();
  const { palette } = useTheme();
  const entries = useNotificationInboxStore(s => s.entries);
  const markRead = useNotificationInboxStore(s => s.markRead);
  const markAllRead = useNotificationInboxStore(s => s.markAllRead);
  const quiet = useIntelligenceStore(s => s.policy.quietHours);
  const [filter, setFilter] = useState<'All' | InboxKind>('All');

  useFocusEffect(
    useCallback(() => {
      refreshInbox().catch(() => {});
    }, []),
  );

  const now = Date.now();
  const delivered = useMemo(() => entries.filter(e => isDelivered(e, now)), [entries, now]);
  const unread = countUnread(entries, now);

  const groups = useMemo(() => {
    const shown = delivered.filter(e => filter === 'All' || e.kind === filter);
    const out: Array<{ title: string; rows: InboxEntry[] }> = [];
    for (const e of shown) {
      const title = dayLabel(e.at, now);
      const last = out[out.length - 1];
      if (last && last.title === title) last.rows.push(e);
      else out.push({ title, rows: [e] });
    }
    return out;
  }, [delivered, filter, now]);

  const open = (e: InboxEntry) => {
    markRead(e.id);
    if (e.route) router.push(e.route as never);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LargeTitleHeader
          title="Notifications"
          subtitle={unread > 0 ? `${unread} unread` : 'You’re all caught up'}
          leading={
            <GlassCircleButton accessibilityLabel="Go back" onPress={() => safeGoBack('/(tabs)/today')}>
              <ChevronLeft size={22} color={palette.text} strokeWidth={2.4} />
            </GlassCircleButton>
          }
          actions={
            <GlassCircleButton
              accessibilityLabel="Notification settings"
              onPress={() => router.push('/notification-settings')}
            >
              <Settings size={20} color={palette.text} strokeWidth={2.2} />
            </GlassCircleButton>
          }
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map(f => (
            <FilterChip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>

        {groups.length === 0 ? (
          <View style={styles.empty}>
            <BellOff size={32} color={palette.textSecondary} />
            <Text style={styles.emptyTitle}>
              {delivered.length === 0 ? 'No notifications yet' : 'Nothing here in this filter.'}
            </Text>
            {delivered.length === 0 ? (
              <Text style={styles.emptySub}>Reminders, heads-ups and check-ins will show up here.</Text>
            ) : null}
          </View>
        ) : (
          groups.map(g => (
            <InsetGroup key={g.title} title={g.title}>
              {g.rows.map(e => (
                <GroupedRow
                  key={e.id}
                  icon={ICONS[e.icon]}
                  tile={e.read ? TONES.gray : TONES[e.tone]}
                  label={e.title}
                  sub={e.body || undefined}
                  subLines={3}
                  value={`${e.read ? '' : '● '}${timeOf(e.at)}`}
                  valueColor={e.read ? undefined : palette.primaryText}
                  muted={e.read}
                  accessibilityLabel={`${e.read ? '' : 'Unread. '}${e.title}. ${e.body}. ${timeOf(e.at)}`}
                  onPress={() => open(e)}
                />
              ))}
            </InsetGroup>
          ))
        )}

        {quiet.enabled ? (
          <View style={styles.note}>
            <Moon size={18} color={palette.catMood} />
            <Text style={styles.noteText}>
              Notifications held during quiet hours ({quiet.start}–{quiet.end}) arrive when they end. Medication reminders still ring.
            </Text>
          </View>
        ) : null}

        <View style={styles.gutter}>
          <TouchableOpacity
            style={[styles.markAll, unread === 0 && styles.markAllOff]}
            onPress={() => markAllRead()}
            disabled={unread === 0}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
            accessibilityState={{ disabled: unread === 0 }}
          >
            <CheckCheck size={18} color={palette.text} />
            <Text style={styles.markAllText} maxFontSizeMultiplier={1.3}>Mark All as Read</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  safe: { flex: 1, backgroundColor: palette.background },
  scroll: { paddingTop: 6, paddingBottom: 48, gap: 18 },
  chips: { gap: 8, paddingHorizontal: 16 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 32 },
  emptyTitle: { ...typography.headline, color: palette.text, textAlign: 'center' },
  emptySub: { ...typography.subhead, color: palette.textSecondary, textAlign: 'center' },
  note: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, alignItems: 'flex-start' },
  noteText: { ...typography.subhead, color: palette.textSecondary, flex: 1 },
  gutter: { paddingHorizontal: 16 },
  markAll: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: palette.surfaceAlt,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllOff: { opacity: 0.5 },
  markAllText: { ...typography.headline, color: palette.text },
}));
