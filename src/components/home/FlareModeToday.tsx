/**
 * Today screen body while flare mode is on: only the essentials, in a calmer layout.
 * Everything else (feeling card, summary, pacing and pattern prompts) is hidden until
 * the patient turns flare mode off.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Flame, Stethoscope, Pill, Droplets, HeartHandshake } from 'lucide-react-native';
import { IQuickAction, IReminder } from '@lumen/shared';
import { createThemedStyles, useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { InsetGroup, GroupedRow, IconTile } from '../ios/InsetGroup';

interface Props {
  /** Up to three quick actions the patient needs most (medication, water, rest). */
  essentialActions: IQuickAction[];
  /** Renders the shared quick-tap tile so counts, undo and linked prompts behave as on the normal screen. */
  renderTile: (action: IQuickAction, width: number) => React.ReactNode;
  /** Open the symptom logging form. */
  onLogSymptom: () => void;
  reminders: IReminder[];
  onTurnOff: () => void;
  tileWidth: number;
}

/** Reminders that still fire in flare mode: medication and hydration. */
export function essentialReminders(reminders: IReminder[]): IReminder[] {
  return reminders.filter(r => r.enabled && !r.archivedAt && (r.category === 'MEDICATION' || r.category === 'HYDRATION'));
}

function reminderWhen(r: IReminder): string {
  if (r.scheduleType === 'INTERVAL') {
    const hours = Math.round(((r.intervalMinutes || 60) / 60) * 10) / 10;
    return `Every ${hours} h`;
  }
  return r.targetTime || r.schedule || '';
}

/** Choose the actions to show: medication, water and rest first, then any others, up to three. */
export function pickEssentialActions(actions: IQuickAction[]): IQuickAction[] {
  const text = (a: IQuickAction) => `${a.templateKey ?? ''} ${a.label}`.toLowerCase();
  const matchers = [/med|pill|tablet|dose/, /water|hydrat/, /rest|nap|lie|bed/];
  const picked: IQuickAction[] = [];
  for (const m of matchers) {
    const found = actions.find(a => m.test(text(a)) && !picked.includes(a));
    if (found) picked.push(found);
  }
  return picked;
}

export function FlareModeToday({ essentialActions, renderTile, onLogSymptom, reminders, onTurnOff, tileWidth }: Props) {
  const styles = useStyles();
  const { palette } = useTheme();
  const keep = essentialReminders(reminders);

  return (
    <>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.headTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3}>Take it easy today</Text>
          <Text style={styles.headSub}>Flare mode is on. Only the essentials are shown.</Text>
        </View>
        <TouchableOpacity
          style={styles.turnOff}
          onPress={onTurnOff}
          accessibilityRole="button"
          accessibilityLabel="Turn off flare mode"
        >
          <Text style={styles.turnOffText} maxFontSizeMultiplier={1.3}>Turn Off</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {essentialActions.map(a => renderTile(a, tileWidth))}
        <TouchableOpacity
          style={[styles.flareTile, { width: tileWidth }]}
          onPress={onLogSymptom}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Flare now, log how you feel"
        >
          <IconTile icon={Flame} color={palette.error} size={34} />
          <View>
            <Text style={styles.flareTitle} maxFontSizeMultiplier={1.3}>Flare Now</Text>
            <Text style={styles.flareSub} maxFontSizeMultiplier={1.3}>Tap to log it</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.gutter}>
        <TouchableOpacity
          style={styles.primary}
          onPress={onLogSymptom}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Log a symptom"
        >
          <Stethoscope size={20} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.primaryText} maxFontSizeMultiplier={1.3}>Log a Symptom</Text>
        </TouchableOpacity>
      </View>

      {keep.length > 0 ? (
        <InsetGroup
          title="Still on today"
          footer="Other reminders, pacing nudges and pattern prompts are paused until you turn flare mode off."
        >
          {keep.map(r => (
            <GroupedRow
              key={r._id}
              icon={r.category === 'MEDICATION' ? Pill : Droplets}
              tile={r.category === 'MEDICATION' ? palette.catMeds : palette.tint}
              label={r.name}
              value={reminderWhen(r)}
            />
          ))}
        </InsetGroup>
      ) : (
        <Text style={styles.noteOnly}>
          Other reminders, pacing nudges and pattern prompts are paused until you turn flare mode off.
        </Text>
      )}

      <View style={styles.kind}>
        <HeartHandshake size={20} color={palette.catMood} />
        <Text style={styles.kindText}>
          Logging less on bad days is fine. Anything you skip can be added later from Timeline.
        </Text>
      </View>
    </>
  );
}

const useStyles = createThemedStyles(palette => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 20, paddingRight: 16 },
  headText: { flex: 1, gap: 2 },
  headTitle: { ...typography.title2, color: palette.text },
  headSub: { ...typography.subhead, color: palette.textSecondary },
  turnOff: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: palette.tint + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnOffText: { ...typography.subheadBold, color: palette.primaryText },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  flareTile: {
    minHeight: 104,
    borderRadius: 22,
    backgroundColor: palette.surface,
    padding: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  flareTitle: { ...typography.subheadBold, color: palette.text },
  flareSub: { ...typography.footnote, color: palette.textSecondary },
  gutter: { paddingHorizontal: 16 },
  primary: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: palette.primary,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { ...typography.headline, color: '#FFFFFF' },
  noteOnly: { ...typography.footnote, color: palette.textSecondary, paddingHorizontal: 20 },
  kind: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, alignItems: 'flex-start' },
  kindText: { ...typography.subhead, color: palette.textSecondary, flex: 1 },
}));
