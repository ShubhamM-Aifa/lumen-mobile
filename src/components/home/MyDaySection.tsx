import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useTaskStore } from '../../store/taskStore';
import { SectionTitle } from '../ios/SectionTitle';
import { ProgressRing } from '../ios/ProgressRing';

const MAX_ROWS = 5;

/** "My Day": today's tasks as a grouped list with a quick-add row. */
export function MyDaySection({ boundaryHour }: { boundaryHour: number }) {
  const styles = useStyles();
  const { palette } = useTheme();
  const tasks = useTaskStore(s => s.tasks);
  const toggleTaskCompleted = useTaskStore(s => s.toggleTaskCompleted);
  const addTask = useTaskStore(s => s.addTask);
  const [draft, setDraft] = useState('');

  const myDay = tasks.filter(t => t.inMyDay);
  const open = myDay.filter(t => !t.isCompleted);
  const done = myDay.filter(t => t.isCompleted);
  const total = myDay.length;
  const doneCount = done.length;
  const progress = total > 0 ? doneCount / total : 0;
  const isAllDone = total > 0 && doneCount === total;
  const rows = [...open, ...done].slice(0, MAX_ROWS);
  const hidden = myDay.length - rows.length;

  const submit = async () => {
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    try {
      await addTask({ title, inMyDay: true }, boundaryHour);
      Haptics.selectionAsync().catch(() => {});
    } catch {
      setDraft(title);
    }
  };

  return (
    <View style={styles.wrap}>
      <SectionTitle
        title="My Day"
        actionLabel="All"
        onAction={() => router.push('/todo/list/my-day' as never)}
        rightAccessory={
          total > 0 ? (
            <View style={styles.counterRow}>
              <ProgressRing
                size={16}
                strokeWidth={2.4}
                progress={progress}
                color={isAllDone ? palette.success : palette.tint}
                trackColor={palette.divider}
              />
              <Text style={styles.counterText}>
                {`${doneCount} of ${total} done`}
              </Text>
            </View>
          ) : null
        }
      />
      <View style={styles.card}>
        {rows.map(t => (
          <View key={t._id} style={styles.row}>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync().catch(() => {}); toggleTaskCompleted(t._id, boundaryHour); }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: t.isCompleted }}
              accessibilityLabel={`Complete ${t.title}`}
            >
              <View style={[styles.check, t.isCompleted ? { backgroundColor: palette.tint, borderColor: palette.tint } : { borderColor: palette.border }]}>
                {t.isCompleted ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.textTap}
              onPress={() => router.push(`/todo/task/${t._id}` as never)}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={`Open ${t.title}`}
            >
              <Text
                style={[styles.taskText, t.isCompleted && { color: palette.textSecondary, textDecorationLine: 'line-through' }]}
                numberOfLines={2}
                maxFontSizeMultiplier={1.4}
              >
                {t.title}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
        {hidden > 0 ? (
          <TouchableOpacity style={styles.row} onPress={() => router.push('/todo/list/my-day' as never)} accessibilityRole="button" accessibilityLabel={`${hidden} more tasks`}>
            <Text style={styles.more}>{hidden} more</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.row}>
          <View style={styles.plus}><Plus size={16} color={palette.tint} strokeWidth={2.6} /></View>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            returnKeyType="done"
            placeholder="Add a task for today"
            placeholderTextColor={palette.placeholder}
            accessibilityLabel="Add a task for today"
            maxFontSizeMultiplier={1.4}
          />
        </View>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  wrap: { gap: 10 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  counterText: { ...typography.subhead, color: palette.textSecondary },
  card: { marginHorizontal: 16, backgroundColor: palette.surface, borderRadius: 26, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  plus: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  textTap: { flex: 1, justifyContent: 'center', minHeight: 52 },
  taskText: { ...typography.bodyLarge, color: palette.text, paddingVertical: 8 },
  more: { ...typography.subhead, color: palette.textSecondary },
  input: { ...typography.bodyLarge, color: palette.text, flex: 1, minHeight: 52 },
}));
