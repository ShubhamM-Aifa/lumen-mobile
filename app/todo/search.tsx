import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Search, X } from 'lucide-react-native';
import { safeGoBack } from '../../src/utils/navigation';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { useTaskStore } from '../../src/store/taskStore';
import { useBoundaryHour, useTodayStr, useTodoBootstrap } from '../../src/hooks/useTodo';
import { searchTasks } from '../../src/utils/todo/views';
import { TaskRow } from '../../src/components/todo/TaskRow';
import { ITask } from '../../src/shared/types';

export default function TodoSearchScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const todayStr = useTodayStr();
  const boundaryHour = useBoundaryHour();
  useTodoBootstrap();
  const [query, setQuery] = useState('');

  const tasks = useTaskStore((s) => s.tasks);
  const lists = useTaskStore((s) => s.lists);
  const categories = useTaskStore((s) => s.categories);
  const categoryColors = useMemo(() => Object.fromEntries(categories.map((c) => [c.name, c.color])), [categories]);
  const store = useTaskStore.getState;

  const sections = useMemo(() => {
    const found = searchTasks(tasks, query);
    const byList = new Map<string, ITask[]>();
    for (const t of found) {
      const key = t.listId ?? 'inbox';
      byList.set(key, [...(byList.get(key) ?? []), t]);
    }
    return [...byList.entries()].map(([key, items]) => ({
      key,
      title: key === 'inbox' ? 'Tasks' : lists.find((l) => l._id === key)?.name ?? 'List',
      items,
    }));
  }, [tasks, lists, query]);

  const hasQuery = query.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.bar}>
        <GlassCircleButton accessibilityLabel="Go back" onPress={() => safeGoBack('/todo')}>
          <ArrowLeft size={22} color={palette.text} strokeWidth={2.2} />
        </GlassCircleButton>
        <View style={styles.field}>
          <Search size={17} color={palette.textSecondary} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search tasks, notes and steps"
            placeholderTextColor={palette.placeholder}
            autoFocus
            returnKeyType="search"
            accessibilityLabel="Search tasks"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={17} color={palette.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {!hasQuery ? (
          <Text style={styles.hint}>Search across every list, including notes and steps.</Text>
        ) : sections.length === 0 ? (
          <Text style={styles.hint}>No tasks match "{query.trim()}".</Text>
        ) : (
          sections.map((s) => (
            <View key={s.key} style={styles.section}>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              {s.items.map((t) => (
                <TaskRow
                  key={t._id}
                  task={t}
                  todayStr={todayStr}
                  categoryColors={categoryColors}
                  onPress={() => router.push(`/todo/task/${t._id}` as never)}
                  onToggleComplete={() => void store().toggleTaskCompleted(t._id, boundaryHour)}
                  onToggleImportant={() => void store().toggleTaskImportant(t._id)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  container: { flex: 1, backgroundColor: palette.background },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderRadius: 22, paddingHorizontal: 14, backgroundColor: palette.surface },
  input: { flex: 1, ...typography.bodyLarge, color: palette.text, padding: 0 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 18 },
  section: { gap: 8 },
  sectionTitle: { ...typography.subheadBold, color: palette.textSecondary, paddingHorizontal: 4 },
  hint: { ...typography.subhead, color: palette.textSecondary, textAlign: 'center', paddingTop: 48, paddingHorizontal: 24 },
}));
