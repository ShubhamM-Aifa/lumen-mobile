import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, Tag } from 'lucide-react-native';
import { safeGoBack } from '../../src/utils/navigation';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { InsetGroup, GroupedRow } from '../../src/components/ios/InsetGroup';
import { useTaskStore } from '../../src/store/taskStore';
import { useTodoPrefs } from '../../src/store/todoPrefsStore';
import { useTodoBootstrap } from '../../src/hooks/useTodo';
import { SMART_LISTS, LIST_COLORS } from '../../src/components/todo/listTheme';
import { NamePromptModal } from '../../src/components/todo/NamePromptModal';
import { OptionsSheet } from '../../src/components/todo/OptionsSheet';
import { confirmAction } from '../../src/utils/todo/confirm';
import { ITaskCategory } from '../../src/shared/types';

export default function TodoSettingsScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  useTodoBootstrap();
  const settings = useTodoPrefs((s) => s.settings);
  const setSettings = useTodoPrefs((s) => s.setSettings);
  const toggleSmartList = useTodoPrefs((s) => s.toggleSmartList);
  const categories = useTaskStore((s) => s.categories);
  const tasks = useTaskStore((s) => s.tasks);
  const store = useTaskStore.getState;

  const [newCategory, setNewCategory] = useState(false);
  const [editing, setEditing] = useState<ITaskCategory | null>(null);
  const [renaming, setRenaming] = useState<ITaskCategory | null>(null);
  const [recolor, setRecolor] = useState<ITaskCategory | null>(null);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LargeTitleHeader
          title="To Do Settings"
          leading={
            <GlassCircleButton accessibilityLabel="Go back" onPress={() => safeGoBack('/todo')}>
              <ArrowLeft size={22} color={palette.text} strokeWidth={2.2} />
            </GlassCircleButton>
          }
        />

        <InsetGroup title="Adding tasks">
          <GroupedRow label="Add new tasks on top" toggle toggled={settings.addOnTop} onToggle={(v) => setSettings({ addOnTop: v })} />
          <GroupedRow
            label="Show tasks due today in My Day"
            sub="They appear there even if you did not add them"
            toggle
            toggled={settings.dueTodayInMyDay}
            onToggle={(v) => setSettings({ dueTodayInMyDay: v })}
          />
        </InsetGroup>

        <InsetGroup title="Sorting and deleting">
          <GroupedRow label="Move starred tasks to the top" toggle toggled={settings.starredToTop} onToggle={(v) => setSettings({ starredToTop: v })} />
          <GroupedRow label="Confirm before deleting" sub="Deleting always shows an Undo" toggle toggled={settings.confirmDelete} onToggle={(v) => setSettings({ confirmDelete: v })} />
        </InsetGroup>

        <InsetGroup title="Smart lists" footer="Choose which lists appear on the To Do home.">
          {SMART_LISTS.map((s) => (
            <GroupedRow
              key={s.id}
              icon={s.icon}
              tile={s.color}
              label={s.title}
              toggle
              toggled={!settings.hiddenSmartLists.includes(s.id)}
              onToggle={() => toggleSmartList(s.id)}
            />
          ))}
          <GroupedRow label="Hide empty smart lists" toggle toggled={settings.hideEmptySmartLists} onToggle={(v) => setSettings({ hideEmptySmartLists: v })} />
        </InsetGroup>

        <InsetGroup title="Categories" footer="Label tasks with a coloured category, then filter any list by it.">
          {categories.map((c) => (
            <GroupedRow
              key={c._id}
              icon={Tag}
              tile={c.color}
              label={c.name}
              value={String(tasks.filter((t) => (t.categories ?? []).includes(c.name)).length)}
              chevron
              onPress={() => setEditing(c)}
            />
          ))}
          <GroupedRow icon={Plus} tile={palette.tint} label="New category" onPress={() => setNewCategory(true)} />
        </InsetGroup>
      </ScrollView>

      <NamePromptModal
        visible={newCategory}
        title="New category"
        placeholder="Category name"
        maxLength={50}
        onClose={() => setNewCategory(false)}
        onSave={(name) => {
          setNewCategory(false);
          if (!categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
            void store().createCategory(name, LIST_COLORS[categories.length % LIST_COLORS.length].light);
          }
        }}
      />
      <NamePromptModal
        visible={!!renaming}
        title="Rename category"
        placeholder="Category name"
        initial={renaming?.name}
        maxLength={50}
        onClose={() => setRenaming(null)}
        onSave={(name) => {
          if (renaming) void store().updateCategory(renaming._id, { name });
          setRenaming(null);
        }}
      />
      <OptionsSheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.name}
        options={[
          { key: 'rename', label: 'Rename', opensModal: true, onPress: () => setRenaming(editing) },
          { key: 'color', label: 'Change colour', opensModal: true, onPress: () => setRecolor(editing) },
          {
            key: 'delete',
            label: 'Delete category',
            destructive: true,
            onPress: () => {
              const c = editing;
              if (c) confirmAction('Delete category?', `"${c.name}" is removed from every task that uses it.`, 'Delete', () => void store().deleteCategory(c._id));
            },
          },
        ]}
      />
      <OptionsSheet
        visible={!!recolor}
        onClose={() => setRecolor(null)}
        title="Colour"
        options={LIST_COLORS.map((c) => ({
          key: c.key,
          label: c.key[0].toUpperCase() + c.key.slice(1),
          icon: Tag,
          iconColor: c.light,
          selected: recolor?.color.toLowerCase() === c.light.toLowerCase(),
          onPress: () => {
            if (recolor) void store().updateCategory(recolor._id, { color: c.light });
          },
        }))}
      />
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { gap: 18, paddingBottom: 48, paddingTop: 6 },
}));
