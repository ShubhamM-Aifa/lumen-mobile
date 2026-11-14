import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Star, Sun, Calendar, Bell, Repeat, FileText, ListChecks } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { ITask } from '../../shared/types';
import { formatDue } from '../../utils/todo/dates';

export interface TaskRowProps {
  task: ITask;
  todayStr?: string;
  /** Shown first in the meta line (used by smart lists and search, where tasks come from many lists). */
  listName?: string;
  /** Colour of the tick when complete; defaults to the app blue. */
  accent?: string;
  /** Category name to colour, for the little category pills. */
  categoryColors?: Record<string, string>;
  selectionMode?: boolean;
  selected?: boolean;
  dragging?: boolean;
  /** Hides the card background (used inside another card, e.g. on Today). */
  flat?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleComplete: () => void;
  onToggleImportant: () => void;
}

interface Meta {
  key: string;
  icon?: React.ReactNode;
  text?: string;
  color: string;
  bold?: boolean;
}

export const TaskRow = React.memo(function TaskRow({
  task,
  todayStr,
  listName,
  accent,
  categoryColors,
  selectionMode,
  selected,
  dragging,
  flat,
  onPress,
  onLongPress,
  onToggleComplete,
  onToggleImportant,
}: TaskRowProps) {
  const { palette } = useTheme();
  const styles = useStyles();
  const today = todayStr ?? '';
  const tick = accent ?? palette.primary;

  const stepsTotal = task.steps?.length ?? 0;
  const stepsDone = task.steps?.filter((s) => s.completed).length ?? 0;
  const due = task.dueDate && today ? formatDue(task.dueDate, today) : null;
  const overdue = !!due?.overdue && !task.isCompleted;

  const metas: Meta[] = [];
  if (listName) metas.push({ key: 'list', text: listName, color: palette.textSecondary });
  if (task.inMyDay) metas.push({ key: 'myday', icon: <Sun size={13} color={palette.infoText} />, text: 'My Day', color: palette.infoText });
  if (stepsTotal > 0) metas.push({ key: 'steps', icon: <ListChecks size={13} color={palette.textSecondary} />, text: `${stepsDone} of ${stepsTotal}`, color: palette.textSecondary });
  if (task.dueDate && due) {
    const color = overdue ? palette.errorText : due.today ? palette.infoText : palette.textSecondary;
    metas.push({
      key: 'due',
      icon: <Calendar size={13} color={color} />,
      text: overdue ? `${due.label} · Overdue` : due.label === 'Today' ? 'Due today' : due.label,
      color,
      bold: overdue || due.today,
    });
  }
  if (task.reminderTime) metas.push({ key: 'bell', icon: <Bell size={13} color={palette.textSecondary} />, color: palette.textSecondary });
  if (task.repeat) metas.push({ key: 'repeat', icon: <Repeat size={13} color={palette.textSecondary} />, color: palette.textSecondary });
  if (task.notes) metas.push({ key: 'note', icon: <FileText size={13} color={palette.textSecondary} />, color: palette.textSecondary });

  const energy = task.energyCost
    ? {
        gentle: { label: 'Gentle', bg: palette.success + '26', text: palette.successText },
        moderate: { label: 'Moderate', bg: palette.warning + '26', text: palette.warningText },
        demanding: { label: 'High energy', bg: palette.error + '26', text: palette.errorText },
      }[task.energyCost]
    : null;

  const a11y = [
    task.title,
    task.isCompleted ? 'completed' : null,
    task.isImportant ? 'important' : null,
    due ? `due ${due.label}` : null,
    stepsTotal ? `${stepsDone} of ${stepsTotal} steps done` : null,
  ].filter(Boolean).join(', ');

  const handleToggle = () => {
    Haptics.impactAsync(task.isCompleted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onToggleComplete();
  };

  return (
    <View
      style={[styles.row, !flat && styles.card, dragging && styles.dragging, selected && styles.selectedRow, task.isCompleted && !selectionMode && styles.done]}
    >
      {selectionMode ? (
        <TouchableOpacity
          style={[styles.circle, selected && { backgroundColor: palette.primary, borderColor: palette.primary }]}
          onPress={onPress}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="checkbox"
          accessibilityLabel={`Select ${task.title}`}
          accessibilityState={{ checked: !!selected }}
        >
          {selected ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.circle, task.isCompleted && { backgroundColor: tick, borderColor: tick }]}
          onPress={handleToggle}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="checkbox"
          accessibilityLabel={`Complete ${task.title}`}
          accessibilityState={{ checked: task.isCompleted }}
        >
          {task.isCompleted ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.content}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel={`Task: ${a11y}`}
      >
        <Text style={[styles.title, task.isCompleted && styles.titleDone]} numberOfLines={3} maxFontSizeMultiplier={1.4}>
          {task.title}
        </Text>

        {metas.length > 0 || energy || (task.categories?.length ?? 0) > 0 ? (
          <View style={styles.metaRow}>
            {metas.map((m) => (
              <View key={m.key} style={styles.meta}>
                {m.icon}
                {m.text ? (
                  <Text style={[styles.metaText, { color: m.color }, m.bold && styles.metaBold]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
                    {m.text}
                  </Text>
                ) : null}
              </View>
            ))}
            {(task.categories ?? []).map((c) => (
              <View key={c} style={[styles.pill, { backgroundColor: (categoryColors?.[c] ?? palette.tint) + '26' }]}>
                <View style={[styles.dot, { backgroundColor: categoryColors?.[c] ?? palette.tint }]} />
                <Text style={[styles.pillText, { color: palette.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{c}</Text>
              </View>
            ))}
            {energy ? (
              <View style={[styles.pill, { backgroundColor: energy.bg }]}>
                <Text style={[styles.pillText, { color: energy.text, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>{energy.label}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>

      {!selectionMode ? (
        <TouchableOpacity
          style={styles.star}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onToggleImportant();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={task.isImportant ? 'Unmark important' : 'Mark important'}
        >
          <Star
            size={21}
            color={task.isImportant ? palette.warning : palette.textSecondary}
            fill={task.isImportant ? palette.warning : 'transparent'}
            strokeWidth={task.isImportant ? 2 : 1.6}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const useStyles = createThemedStyles(palette => ({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, paddingVertical: 13, paddingHorizontal: 16, minHeight: 56 },
  card: { backgroundColor: palette.surface, borderRadius: 16 },
  dragging: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  selectedRow: { backgroundColor: palette.tint + '1F' },
  done: { opacity: 0.75 },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.6,
    borderColor: palette.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  content: { flex: 1, gap: 4 },
  title: { ...typography.bodyLarge, color: palette.text },
  titleDone: { color: palette.textSecondary, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 10, rowGap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...typography.footnote },
  metaBold: { fontWeight: '600' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9 },
  pillText: { ...typography.footnote },
  dot: { width: 7, height: 7, borderRadius: 4 },
  star: { minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center', marginTop: -1 },
}));
