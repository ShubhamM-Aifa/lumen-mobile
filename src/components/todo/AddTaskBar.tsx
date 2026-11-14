import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Plus, Calendar, Bell, Repeat, Star, Zap, X } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { ITaskRepeat, TaskEnergyCost } from '../../shared/types';
import { DueDateSheet, ReminderSheet, RepeatSheet } from './pickers';
import { OptionsSheet } from './OptionsSheet';
import { formatDue, formatReminder } from '../../utils/todo/dates';
import { describeRepeat } from '../../utils/todo/recurrence';

export interface TaskDraft {
  title: string;
  dueDate?: string;
  reminderTime?: string;
  repeat?: ITaskRepeat;
  isImportant: boolean;
  energyCost?: TaskEnergyCost;
}

interface Props {
  placeholder: string;
  todayStr: string;
  /** Starts new tasks starred (e.g. when adding inside Important). */
  defaultImportant?: boolean;
  /** Starts new tasks with this due date (e.g. when adding inside Planned). */
  defaultDueDate?: string;
  keyboardVisible: boolean;
  onSubmit: (draft: TaskDraft) => void;
  /** Accent for the + disc, matching the list colour. */
  accent?: string;
}

const ENERGY: Array<{ key: TaskEnergyCost; label: string }> = [
  { key: 'gentle', label: 'Gentle' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'demanding', label: 'High energy' },
];

/** "Add a task" bar, with quick due / reminder / repeat / star / energy like Microsoft To Do. */
export function AddTaskBar({ placeholder, todayStr, defaultImportant, defaultDueDate, keyboardVisible, onSubmit, accent }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [focused, setFocused] = useState(false);
  const [dueDate, setDueDate] = useState<string | undefined>();
  const [reminderTime, setReminderTime] = useState<string | undefined>();
  const [repeat, setRepeat] = useState<ITaskRepeat | undefined>();
  const [important, setImportant] = useState<boolean | null>(null);
  const [energy, setEnergy] = useState<TaskEnergyCost | undefined>();
  const [sheet, setSheet] = useState<null | 'due' | 'reminder' | 'repeat' | 'energy'>(null);

  const isImportant = important ?? !!defaultImportant;
  const effectiveDue = dueDate ?? defaultDueDate;
  const hasDraft = !!(dueDate || reminderTime || repeat || energy || important !== null);
  const showTools = focused || title.length > 0 || sheet !== null || hasDraft;
  // Tapping a tool blurs the input first; hiding the tools immediately would swallow that tap.
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  const submit = () => {
    const clean = title.trim();
    if (!clean) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSubmit({
      title: clean,
      dueDate: repeat && !effectiveDue ? todayStr : effectiveDue, // a repeat needs a date to repeat from
      reminderTime,
      repeat,
      isImportant,
      energyCost: energy,
    });
    setTitle('');
    setDueDate(undefined);
    setReminderTime(undefined);
    setRepeat(undefined);
    setImportant(null);
    setEnergy(undefined);
  };

  const bottomPad = keyboardVisible ? 8 : (Platform.OS === 'android' ? Math.max(insets.bottom, 24) : Math.max(insets.bottom, 12)) + 6;
  const tool = (on: boolean) => [styles.tool, on && { backgroundColor: palette.primary + '1F' }];

  return (
    <View style={[styles.wrap, { marginBottom: bottomPad }]}>
      {showTools ? (
        <View style={styles.tools}>
          <TouchableOpacity style={tool(!!effectiveDue)} onPress={() => setSheet('due')} accessibilityRole="button" accessibilityLabel="Set due date">
            <Calendar size={16} color={effectiveDue ? palette.primaryText : palette.textSecondary} />
            {effectiveDue ? <Text style={styles.toolText}>{formatDue(effectiveDue, todayStr).label}</Text> : null}
          </TouchableOpacity>
          <TouchableOpacity style={tool(!!reminderTime)} onPress={() => setSheet('reminder')} accessibilityRole="button" accessibilityLabel="Set reminder">
            <Bell size={16} color={reminderTime ? palette.primaryText : palette.textSecondary} />
            {reminderTime ? <Text style={styles.toolText}>{formatReminder(reminderTime)}</Text> : null}
          </TouchableOpacity>
          <TouchableOpacity style={tool(!!repeat)} onPress={() => setSheet('repeat')} accessibilityRole="button" accessibilityLabel="Set repeat">
            <Repeat size={16} color={repeat ? palette.primaryText : palette.textSecondary} />
            {repeat ? <Text style={styles.toolText}>{describeRepeat(repeat)}</Text> : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={tool(isImportant)}
            onPress={() => setImportant(!isImportant)}
            accessibilityRole="button"
            accessibilityState={{ selected: isImportant }}
            accessibilityLabel="Mark new task important"
          >
            <Star size={16} color={isImportant ? palette.warningText : palette.textSecondary} fill={isImportant ? palette.warning : 'transparent'} />
          </TouchableOpacity>
          <TouchableOpacity style={tool(!!energy)} onPress={() => setSheet('energy')} accessibilityRole="button" accessibilityLabel="Set energy cost">
            <Zap size={16} color={energy ? palette.primaryText : palette.textSecondary} />
            {energy ? <Text style={styles.toolText}>{ENERGY.find((e) => e.key === energy)?.label}</Text> : null}
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <View style={[styles.plus, { backgroundColor: accent ?? palette.primary }]}>
          <Plus size={18} color="#FFFFFF" strokeWidth={2.6} />
        </View>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={palette.placeholder}
          value={title}
          onChangeText={setTitle}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setFocused(false), 300);
          }}
          onSubmitEditing={submit}
          blurOnSubmit={false}
          returnKeyType="done"
          accessibilityLabel="New task title"
        />
        {title.trim().length > 0 ? (
          <TouchableOpacity style={styles.add} onPress={submit} accessibilityRole="button" accessibilityLabel="Add task">
            <Text style={styles.addText}>Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <DueDateSheet
        visible={sheet === 'due'}
        onClose={() => setSheet(null)}
        value={effectiveDue}
        todayStr={todayStr}
        onSelect={(d) => setDueDate(d ?? undefined)}
      />
      <ReminderSheet visible={sheet === 'reminder'} onClose={() => setSheet(null)} value={reminderTime} onSelect={(iso) => setReminderTime(iso ?? undefined)} />
      <RepeatSheet visible={sheet === 'repeat'} onClose={() => setSheet(null)} value={repeat} onSelect={(r) => setRepeat(r ?? undefined)} />
      <OptionsSheet
        visible={sheet === 'energy'}
        onClose={() => setSheet(null)}
        title="Energy cost"
        options={[
          ...ENERGY.map((e) => ({ key: e.key, label: e.label, selected: energy === e.key, onPress: () => setEnergy(e.key) })),
          ...(energy ? [{ key: 'none', label: 'No energy cost', icon: X, destructive: true, onPress: () => setEnergy(undefined) }] : []),
        ]}
      />
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  wrap: {
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 26,
    gap: 8,
    backgroundColor: palette.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34, minWidth: 38, paddingHorizontal: 10, borderRadius: 17, backgroundColor: palette.surfaceAlt, justifyContent: 'center' },
  toolText: { ...typography.footnote, color: palette.primaryText, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  plus: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, ...typography.bodyLarge, color: palette.text, padding: 0 },
  add: { minHeight: 34, paddingHorizontal: 16, borderRadius: 17, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  addText: { ...typography.subheadBold, color: '#FFFFFF' },
}));
