import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Sun, Bell, Calendar, Repeat, Tag, Zap, FolderInput, HeartPulse, Trash2, Star, Check, Plus, X, MoreHorizontal, ArrowUpRight, Inbox,
} from 'lucide-react-native';
import { ScreenTopBar } from '../../../src/components/ios/ScreenTopBar';
import { InsetGroup, GroupedRow } from '../../../src/components/ios/InsetGroup';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';
import { useTaskStore } from '../../../src/store/taskStore';
import { useBoundaryHour, useTodayStr, useTodoBootstrap } from '../../../src/hooks/useTodo';
import { safeGoBack } from '../../../src/utils/navigation';
import { formatDue, formatReminder, formatDateShort, toDateStr } from '../../../src/utils/todo/dates';
import { describeRepeat } from '../../../src/utils/todo/recurrence';
import { listTextColor } from '../../../src/components/todo/listTheme';
import { DueDateSheet, ReminderSheet, RepeatSheet } from '../../../src/components/todo/pickers';
import { OptionsSheet, SheetOption } from '../../../src/components/todo/OptionsSheet';
import { ITaskStep, TaskEnergyCost } from '../../../src/shared/types';

const ENERGY: Array<{ key: TaskEnergyCost; label: string }> = [
  { key: 'gentle', label: 'Gentle' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'demanding', label: 'High energy' },
];

/** Saves `value` shortly after the user stops typing, on blur, and when the screen closes. */
function useAutoSave(value: string, committed: string, save: (v: string) => void, delay = 700) {
  const latest = useRef({ value, committed, save });
  latest.current = { value, committed, save };
  const flush = useCallback(() => {
    const { value: v, committed: c, save: s } = latest.current;
    if (v !== c) s(v);
  }, []);
  useEffect(() => {
    if (value === committed) return;
    const t = setTimeout(flush, delay);
    return () => clearTimeout(t);
  }, [value, committed, delay, flush]);
  useEffect(() => flush, [flush]);
  return flush;
}

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const styles = useStyles();
  const todayStr = useTodayStr();
  const boundaryHour = useBoundaryHour();
  useTodoBootstrap();

  const task = useTaskStore((s) => s.tasks.find((t) => t._id === id));
  const lists = useTaskStore((s) => s.lists);
  const categories = useTaskStore((s) => s.categories);
  const store = useTaskStore.getState;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [newStep, setNewStep] = useState('');
  const [stepMenu, setStepMenu] = useState<ITaskStep | null>(null);
  const [sheet, setSheet] = useState<null | 'due' | 'reminder' | 'repeat' | 'category' | 'energy' | 'list'>(null);

  // Load the text fields once per task, not on every store change (that would fight the keyboard).
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (task && loadedFor.current !== task._id) {
      loadedFor.current = task._id;
      setTitle(task.title);
      setNotes(task.notes ?? '');
    }
  }, [task]);

  const flushTitle = useAutoSave(title, task?.title ?? '', (v) => {
    const clean = v.trim();
    if (task && clean && clean !== task.title) void store().updateTask(task._id, { title: clean });
  });
  const flushNotes = useAutoSave(notes, task?.notes ?? '', (v) => {
    if (task) void store().updateTask(task._id, { notes: v.trim() ? v : null });
  });

  if (!task) {
    return (
      <View style={styles.container}>
        <ScreenTopBar fallbackRoute="/todo" />
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>Task not found</Text>
          <Text style={styles.missingBody}>It may have been deleted.</Text>
        </View>
      </View>
    );
  }

  const listName = task.listId ? lists.find((l) => l._id === task.listId)?.name : undefined;
  const list = task.listId ? lists.find((l) => l._id === task.listId) : undefined;
  const tick = list ? listTextColor(list.color, false) : palette.primary;
  const update = (patch: Parameters<ReturnType<typeof store>['updateTask']>[1]) => void store().updateTask(task._id, patch);
  /** Reserves room at the end of a row for the clear button, which sits on top as a sibling (no nested buttons). */
  const spacer = <View style={{ width: 28 }} />;
  const withClear = (row: React.ReactNode, patch: Parameters<ReturnType<typeof store>['updateTask']>[1] | null) => (
    <View>
      {row}
      {patch ? (
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => update(patch)}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Clear"
        >
          <X size={18} color={palette.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const toggleCategory = (name: string) => {
    const cur = task.categories ?? [];
    void store().setTaskCategories(task._id, cur.includes(name) ? cur.filter((c) => c !== name) : [...cur, name]);
  };

  const categoryOptions: SheetOption[] = categories.length
    ? categories.map((c) => ({
        key: c._id,
        label: c.name,
        iconColor: c.color,
        selected: (task.categories ?? []).includes(c.name),
        keepOpen: true,
        onPress: () => toggleCategory(c.name),
      }))
    : [{ key: 'manage', label: 'Create categories in To Do settings', icon: Tag, onPress: () => router.push('/todo/settings' as never) }];

  const listOptions: SheetOption[] = [
    { key: 'inbox', label: 'Tasks', icon: Inbox, selected: !task.listId, onPress: () => void store().moveTask(task._id, null) },
    ...lists.map<SheetOption>((l) => ({ key: l._id, label: l.name, icon: FolderInput, selected: task.listId === l._id, onPress: () => void store().moveTask(task._id, l._id) })),
  ];

  const stepsDone = (task.steps ?? []).filter((s) => s.completed).length;

  return (
    <View style={styles.container}>
      <ScreenTopBar fallbackRoute="/todo" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          {/* Title, tick, star and steps */}
          <View style={styles.card}>
            <View style={styles.titleRow}>
              <TouchableOpacity
                style={[styles.circle, task.isCompleted && { backgroundColor: tick, borderColor: tick }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  void store().toggleTaskCompleted(task._id, boundaryHour);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="checkbox"
                accessibilityLabel={`Complete ${task.title}`}
                accessibilityState={{ checked: task.isCompleted }}
              >
                {task.isCompleted ? <Check size={15} color="#FFFFFF" strokeWidth={3} /> : null}
              </TouchableOpacity>
              <TextInput
                style={[styles.titleInput, task.isCompleted && styles.titleDone]}
                value={title}
                onChangeText={setTitle}
                onBlur={flushTitle}
                multiline
                blurOnSubmit
                maxLength={300}
                placeholder="Task title"
                placeholderTextColor={palette.placeholder}
                accessibilityLabel="Task title"
              />
              <TouchableOpacity
                onPress={() => void store().toggleTaskImportant(task._id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={task.isImportant ? 'Unmark important' : 'Mark important'}
              >
                <Star
                  size={24}
                  color={task.isImportant ? palette.warning : palette.textSecondary}
                  fill={task.isImportant ? palette.warning : 'transparent'}
                  strokeWidth={task.isImportant ? 2 : 1.6}
                />
              </TouchableOpacity>
            </View>

            {(task.steps ?? []).map((s) => (
              <View key={s.id} style={styles.stepRow}>
                <TouchableOpacity
                  style={[styles.stepCircle, s.completed && { backgroundColor: tick, borderColor: tick }]}
                  onPress={() => void store().toggleStep(task._id, s.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Step: ${s.title}`}
                  accessibilityState={{ checked: s.completed }}
                >
                  {s.completed ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
                </TouchableOpacity>
                <StepInput step={s} taskId={task._id} />
                <TouchableOpacity
                  onPress={() => setStepMenu(s)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Options for step ${s.title}`}
                >
                  <MoreHorizontal size={20} color={palette.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.stepRow}>
              <Plus size={20} color={palette.primaryText} strokeWidth={2.4} />
              <TextInput
                style={styles.addStepInput}
                value={newStep}
                onChangeText={setNewStep}
                placeholder={(task.steps ?? []).length ? 'Next step' : 'Add step'}
                placeholderTextColor={palette.primaryText}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => {
                  if (newStep.trim()) void store().addStep(task._id, newStep);
                  setNewStep('');
                }}
                onBlur={() => {
                  if (newStep.trim()) void store().addStep(task._id, newStep);
                  setNewStep('');
                }}
                accessibilityLabel="Add step"
              />
              {(task.steps ?? []).length > 0 ? <Text style={styles.stepCount}>{stepsDone}/{task.steps.length}</Text> : null}
            </View>
          </View>

          <InsetGroup>
            {withClear(
              <GroupedRow
                icon={Sun}
                tile="#007AFF"
                label={task.inMyDay ? 'Added to My Day' : 'Add to My Day'}
                onPress={() => void store().toggleTaskMyDay(task._id, boundaryHour)}
                trailing={task.inMyDay ? spacer : undefined}
              />,
              task.inMyDay ? { inMyDay: false, myDayDate: null } : null
            )}
          </InsetGroup>

          <InsetGroup>
            {withClear(
              <GroupedRow
                icon={Bell}
                tile="#FF9500"
                label="Remind me"
                value={task.reminderTime ? formatReminder(task.reminderTime) : undefined}
                valueColor={palette.primaryText}
                onPress={() => setSheet('reminder')}
                trailing={task.reminderTime ? spacer : undefined}
                chevron={!task.reminderTime}
              />,
              task.reminderTime ? { reminderTime: null } : null
            )}
            {withClear(
              <GroupedRow
                icon={Calendar}
                tile="#34C759"
                label="Add due date"
                value={task.dueDate ? formatDue(task.dueDate, todayStr).label : undefined}
                valueColor={task.dueDate && formatDue(task.dueDate, todayStr).overdue && !task.isCompleted ? palette.errorText : palette.primaryText}
                onPress={() => setSheet('due')}
                trailing={task.dueDate ? spacer : undefined}
                chevron={!task.dueDate}
              />,
              task.dueDate ? { dueDate: null } : null
            )}
            {withClear(
              <GroupedRow
                icon={Repeat}
                tile="#5856D6"
                label="Repeat"
                value={task.repeat ? describeRepeat(task.repeat) : undefined}
                valueColor={palette.primaryText}
                onPress={() => setSheet('repeat')}
                trailing={task.repeat ? spacer : undefined}
                chevron={!task.repeat}
              />,
              task.repeat ? { repeat: null } : null
            )}
          </InsetGroup>

          <InsetGroup>
            <GroupedRow
              icon={Tag}
              tile="#AF52DE"
              label="Pick a category"
              value={(task.categories ?? []).join(', ') || undefined}
              valueColor={palette.primaryText}
              chevron
              onPress={() => setSheet('category')}
            />
            {withClear(
              <GroupedRow
                icon={Zap}
                tile="#FF2D55"
                label="Energy cost"
                value={task.energyCost ? ENERGY.find((e) => e.key === task.energyCost)?.label : undefined}
                valueColor={palette.primaryText}
                onPress={() => setSheet('energy')}
                trailing={task.energyCost ? spacer : undefined}
                chevron={!task.energyCost}
              />,
              task.energyCost ? { energyCost: null } : null
            )}
            <GroupedRow
              icon={FolderInput}
              tile="#8E8E93"
              label="List"
              value={listName ?? 'Tasks'}
              chevron
              onPress={() => setSheet('list')}
            />
          </InsetGroup>

          <View style={styles.noteCard}>
            <TextInput
              style={styles.noteInput}
              value={notes}
              onChangeText={setNotes}
              onBlur={flushNotes}
              placeholder="Add note"
              placeholderTextColor={palette.placeholder}
              multiline
              maxLength={5000}
              textAlignVertical="top"
              accessibilityLabel="Task note"
            />
          </View>

          {!task.isCompleted ? (
            <InsetGroup footer="Moves it out of today and pushes the date back, for a flare day.">
              <GroupedRow
                icon={HeartPulse}
                tile="#FF3B30"
                label="Postpone 2 days (flare)"
                onPress={() => {
                  void store().deferForFlare(task._id, 2, boundaryHour);
                  safeGoBack('/todo');
                }}
              />
            </InsetGroup>
          ) : null}

          <InsetGroup>
            <GroupedRow
              icon={Trash2}
              tile="#FF3B30"
              label="Delete task"
              destructive
              onPress={() => {
                void store().deleteTask(task._id);
                safeGoBack('/todo');
              }}
            />
          </InsetGroup>

          <Text style={styles.created}>Created {formatDateShort(toDateStr(new Date(task.createdAt)), todayStr)}</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <DueDateSheet
        visible={sheet === 'due'}
        onClose={() => setSheet(null)}
        value={task.dueDate}
        todayStr={todayStr}
        onSelect={(d) => update({ dueDate: d })}
      />
      <ReminderSheet visible={sheet === 'reminder'} onClose={() => setSheet(null)} value={task.reminderTime} onSelect={(iso) => update({ reminderTime: iso })} />
      <RepeatSheet
        visible={sheet === 'repeat'}
        onClose={() => setSheet(null)}
        value={task.repeat}
        onSelect={(r) => update(r ? { repeat: r, dueDate: task.dueDate ?? todayStr } : { repeat: null })}
      />
      <OptionsSheet visible={sheet === 'category'} onClose={() => setSheet(null)} title="Categories" options={categoryOptions} />
      <OptionsSheet
        visible={sheet === 'energy'}
        onClose={() => setSheet(null)}
        title="Energy cost"
        subtitle="How much of your energy this takes"
        options={ENERGY.map((e) => ({ key: e.key, label: e.label, selected: task.energyCost === e.key, onPress: () => update({ energyCost: e.key }) }))}
      />
      <OptionsSheet visible={sheet === 'list'} onClose={() => setSheet(null)} title="Move to list" options={listOptions} />
      <OptionsSheet
        visible={!!stepMenu}
        onClose={() => setStepMenu(null)}
        title={stepMenu?.title}
        options={[
          {
            key: 'promote',
            label: 'Promote to task',
            icon: ArrowUpRight,
            onPress: () => {
              if (stepMenu) void store().promoteStepToTask(task._id, stepMenu.id);
            },
          },
          {
            key: 'delete',
            label: 'Delete step',
            icon: Trash2,
            destructive: true,
            onPress: () => {
              if (stepMenu) void store().deleteStep(task._id, stepMenu.id);
            },
          },
        ]}
      />
    </View>
  );
}

/** A step title you can edit in place; saved when you leave the field. */
function StepInput({ step, taskId }: { step: ITaskStep; taskId: string }) {
  const { palette } = useTheme();
  const styles = useStyles();
  const [text, setText] = useState(step.title);
  useEffect(() => setText(step.title), [step.title]);
  const commit = () => {
    const clean = text.trim();
    if (!clean) setText(step.title);
    else if (clean !== step.title) void useTaskStore.getState().renameStep(taskId, step.id, clean);
  };
  return (
    <TextInput
      style={[styles.stepInput, step.completed && { color: palette.textSecondary, textDecorationLine: 'line-through' }]}
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onSubmitEditing={commit}
      blurOnSubmit
      maxLength={300}
      accessibilityLabel={`Step title ${step.title}`}
    />
  );
}

const useStyles = createThemedStyles(palette => ({
  container: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { gap: 18, paddingBottom: 48, paddingTop: 8 },
  card: { marginHorizontal: 16, backgroundColor: palette.surface, borderRadius: 26, paddingHorizontal: 16, paddingVertical: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  circle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.8, borderColor: palette.textSecondary, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  titleInput: { flex: 1, ...typography.title2, color: palette.text, padding: 0, minHeight: 32 },
  titleDone: { color: palette.textSecondary, textDecorationLine: 'line-through' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, borderTopWidth: 0.5, borderTopColor: palette.border },
  stepCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.6, borderColor: palette.textSecondary, alignItems: 'center', justifyContent: 'center' },
  stepInput: { flex: 1, ...typography.bodyLarge, color: palette.text, padding: 0 },
  addStepInput: { flex: 1, ...typography.bodyLarge, color: palette.primaryText, padding: 0 },
  stepCount: { ...typography.footnote, color: palette.textSecondary },
  noteCard: { marginHorizontal: 16, backgroundColor: palette.surface, borderRadius: 26, padding: 16, minHeight: 110 },
  noteInput: { ...typography.bodyLarge, color: palette.text, padding: 0, minHeight: 80 },
  clearBtn: { position: 'absolute', right: 16, top: 0, bottom: 0, width: 28, alignItems: 'center', justifyContent: 'center' },
  created: { ...typography.footnote, color: palette.textSecondary, textAlign: 'center' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  missingTitle: { ...typography.title2, color: palette.text },
  missingBody: { ...typography.subhead, color: palette.textSecondary },
}));
