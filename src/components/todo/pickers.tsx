import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, CalendarClock, CalendarDays, CalendarPlus, Repeat, Bell, BellRing, Trash2, X, Minus, Plus } from 'lucide-react-native';
import { OptionsSheet, SheetOption } from './OptionsSheet';
import { AppDateTimePicker } from '../common/AppDateTimePicker';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { ITaskRepeat } from '../../shared/types';
import { duePresets, formatDue, formatReminder, reminderPresets, toDateStr, parseDateStr } from '../../utils/todo/dates';
import { describeRepeat } from '../../utils/todo/recurrence';
import { ensureReminderPermission } from '../../services/todo/taskReminders';

// AppDateTimePicker stops at "now" by default; due dates and reminders live in the future.
const FAR_FUTURE = new Date(2100, 0, 1);

// ───────── due date ─────────

interface DueProps {
  visible: boolean;
  onClose: () => void;
  value?: string;
  todayStr: string;
  onSelect: (date: string | null) => void;
}

export function DueDateSheet({ visible, onClose, value, todayStr, onSelect }: DueProps) {
  const [picking, setPicking] = useState(false);
  const options: SheetOption[] = [
    ...duePresets(todayStr).map<SheetOption>((p) => ({
      key: p.key,
      label: p.label,
      hint: p.hint,
      icon: p.key === 'today' ? Calendar : p.key === 'tomorrow' ? CalendarPlus : CalendarDays,
      selected: value === p.date,
      onPress: () => onSelect(p.date),
    })),
    { key: 'pick', label: 'Pick a date', icon: CalendarClock, opensModal: true, onPress: () => setPicking(true) },
  ];
  if (value) options.push({ key: 'clear', label: 'Remove due date', icon: Trash2, destructive: true, onPress: () => onSelect(null) });

  return (
    <>
      <OptionsSheet visible={visible} onClose={onClose} title="Due" subtitle={value ? formatDue(value, todayStr).label : undefined} options={options} />
      <AppDateTimePicker
        visible={picking}
        onClose={() => setPicking(false)}
        mode="date"
        title="Due date"
        value={value ? parseDateStr(value) : new Date()}
        maximumDate={FAR_FUTURE}
        onChange={(d) => {
          setPicking(false);
          onSelect(toDateStr(d));
        }}
      />
    </>
  );
}

// ───────── reminder ─────────

interface ReminderProps {
  visible: boolean;
  onClose: () => void;
  value?: string;
  onSelect: (iso: string | null) => void;
}

export function ReminderSheet({ visible, onClose, value, onSelect }: ReminderProps) {
  const [picking, setPicking] = useState(false);
  const choose = (iso: string | null) => {
    if (iso) void ensureReminderPermission();
    onSelect(iso);
  };
  const options: SheetOption[] = [
    ...reminderPresets().map<SheetOption>((p) => ({
      key: p.key,
      label: p.label,
      hint: p.hint,
      icon: Bell,
      selected: value === p.iso,
      onPress: () => choose(p.iso),
    })),
    { key: 'pick', label: 'Pick a date & time', icon: BellRing, opensModal: true, onPress: () => setPicking(true) },
  ];
  if (value) options.push({ key: 'clear', label: 'Remove reminder', icon: Trash2, destructive: true, onPress: () => choose(null) });

  const start = useMemo(() => {
    if (value) return new Date(value);
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  }, [value, picking]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <OptionsSheet visible={visible} onClose={onClose} title="Remind me" subtitle={value ? formatReminder(value) : undefined} options={options} />
      <AppDateTimePicker
        visible={picking}
        onClose={() => setPicking(false)}
        mode="datetime"
        title="Reminder"
        value={start}
        minimumDate={new Date()}
        maximumDate={FAR_FUTURE}
        onChange={(d) => {
          setPicking(false);
          choose(d.toISOString());
        }}
      />
    </>
  );
}

// ───────── repeat ─────────

interface RepeatProps {
  visible: boolean;
  onClose: () => void;
  value?: ITaskRepeat;
  onSelect: (repeat: ITaskRepeat | null) => void;
}

const SIMPLE: Array<{ key: string; label: string; repeat: ITaskRepeat }> = [
  { key: 'daily', label: 'Daily', repeat: { frequency: 'daily' } },
  { key: 'weekdays', label: 'Weekdays', repeat: { frequency: 'weekdays' } },
  { key: 'weekly', label: 'Weekly', repeat: { frequency: 'weekly' } },
  { key: 'monthly', label: 'Monthly', repeat: { frequency: 'monthly' } },
  { key: 'yearly', label: 'Yearly', repeat: { frequency: 'yearly' } },
];

function sameSimple(value: ITaskRepeat | undefined, r: ITaskRepeat): boolean {
  return !!value && value.frequency === r.frequency && (value.interval ?? 1) === 1 && !(value.daysOfWeek && value.daysOfWeek.length);
}

export function RepeatSheet({ visible, onClose, value, onSelect }: RepeatProps) {
  const [custom, setCustom] = useState(false);
  const isCustomValue = !!value && !SIMPLE.some((s) => sameSimple(value, s.repeat));
  const options: SheetOption[] = [
    ...SIMPLE.map<SheetOption>((s) => ({ key: s.key, label: s.label, icon: Repeat, selected: sameSimple(value, s.repeat), onPress: () => onSelect(s.repeat) })),
    { key: 'custom', label: 'Custom…', hint: isCustomValue && value ? describeRepeat(value) : undefined, icon: Repeat, selected: isCustomValue, opensModal: true, onPress: () => setCustom(true) },
  ];
  if (value) options.push({ key: 'clear', label: 'Never repeat', icon: Trash2, destructive: true, onPress: () => onSelect(null) });

  return (
    <>
      <OptionsSheet visible={visible} onClose={onClose} title="Repeat" subtitle={value ? describeRepeat(value) : undefined} options={options} />
      <RepeatCustomModal
        visible={custom}
        onClose={() => setCustom(false)}
        value={value}
        onSave={(r) => {
          setCustom(false);
          onSelect(r);
        }}
      />
    </>
  );
}

type Unit = 'day' | 'week' | 'month' | 'year';
const UNITS: Array<{ key: Unit; label: string }> = [
  { key: 'day', label: 'Days' },
  { key: 'week', label: 'Weeks' },
  { key: 'month', label: 'Months' },
  { key: 'year', label: 'Years' },
];
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function unitOf(r?: ITaskRepeat): Unit {
  if (!r) return 'week';
  if (r.frequency === 'daily') return 'day';
  if (r.frequency === 'monthly') return 'month';
  if (r.frequency === 'yearly') return 'year';
  return 'week';
}

export function repeatFromUnit(unit: Unit, interval: number, days: number[]): ITaskRepeat {
  const n = Math.max(1, Math.min(99, interval));
  const base = (frequency: ITaskRepeat['frequency']): ITaskRepeat => (n > 1 ? { frequency, interval: n } : { frequency });
  switch (unit) {
    case 'day': return base('daily');
    case 'month': return base('monthly');
    case 'year': return base('yearly');
    default: {
      const r = base('weekly');
      return days.length > 0 ? { ...r, daysOfWeek: [...days].sort((a, b) => a - b) } : r;
    }
  }
}

interface CustomProps {
  visible: boolean;
  onClose: () => void;
  value?: ITaskRepeat;
  onSave: (repeat: ITaskRepeat) => void;
}

export function RepeatCustomModal({ visible, onClose, value, onSave }: CustomProps) {
  const styles = useStyles();
  const { palette } = useTheme();
  const [unit, setUnit] = useState<Unit>(unitOf(value));
  const [interval, setIntervalValue] = useState(value?.interval ?? 1);
  const [days, setDays] = useState<number[]>(value?.daysOfWeek ?? (value?.frequency === 'weekdays' ? [1, 2, 3, 4, 5] : []));

  React.useEffect(() => {
    if (visible) {
      setUnit(unitOf(value));
      setIntervalValue(value?.interval ?? 1);
      setDays(value?.daysOfWeek ?? (value?.frequency === 'weekdays' ? [1, 2, 3, 4, 5] : []));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel" style={styles.headerBtn}>
              <X size={22} color={palette.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Custom repeat</Text>
            <TouchableOpacity onPress={() => onSave(repeatFromUnit(unit, interval, days))} accessibilityRole="button" accessibilityLabel="Save repeat" style={styles.headerBtn}>
              <Text style={styles.save}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.intervalRow}>
            <Text style={styles.every}>Every</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setIntervalValue((n) => Math.max(1, n - 1))} accessibilityRole="button" accessibilityLabel="Decrease interval">
              <Minus size={18} color={palette.text} />
            </TouchableOpacity>
            <Text style={styles.intervalValue} accessibilityLabel={`Every ${interval}`}>{interval}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setIntervalValue((n) => Math.min(99, n + 1))} accessibilityRole="button" accessibilityLabel="Increase interval">
              <Plus size={18} color={palette.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.unitRow}>
            {UNITS.map((u) => (
              <TouchableOpacity
                key={u.key}
                style={[styles.unit, unit === u.key && styles.unitOn]}
                onPress={() => setUnit(u.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: unit === u.key }}
              >
                <Text style={[styles.unitText, unit === u.key && styles.unitTextOn]}>{u.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {unit === 'week' ? (
            <View>
              <Text style={styles.sub}>On these days (optional)</Text>
              <View style={styles.daysRow}>
                {WEEKDAY_LETTERS.map((l, d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.day, days.includes(d) && styles.dayOn]}
                    onPress={() => toggleDay(d)}
                    accessibilityRole="button"
                    accessibilityLabel={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]}
                    accessibilityState={{ selected: days.includes(d) }}
                  >
                    <Text style={[styles.dayText, days.includes(d) && styles.dayTextOn]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          <Text style={styles.preview}>{describeRepeat(repeatFromUnit(unit, interval, days))}</Text>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyles(palette => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingBottom: 16, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  headerBtn: { minWidth: 56, minHeight: 44, justifyContent: 'center' },
  headerTitle: { ...typography.headline, color: palette.text },
  save: { ...typography.headline, color: palette.primaryText, textAlign: 'right' },
  intervalRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  every: { ...typography.bodyLarge, color: palette.text, flex: 1 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  intervalValue: { ...typography.title2, color: palette.text, minWidth: 36, textAlign: 'center' },
  unitRow: { flexDirection: 'row', gap: 8 },
  unit: { flex: 1, minHeight: 40, borderRadius: 20, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  unitOn: { backgroundColor: palette.primary },
  unitText: { ...typography.subheadBold, color: palette.text },
  unitTextOn: { color: '#FFFFFF' },
  sub: { ...typography.footnote, color: palette.textSecondary, marginBottom: 8 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: palette.primary },
  dayText: { ...typography.subheadBold, color: palette.text },
  dayTextOn: { color: '#FFFFFF' },
  preview: { ...typography.subhead, color: palette.textSecondary, textAlign: 'center' },
}));

