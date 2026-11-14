import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, Settings, ChevronDown, ChevronRight, FolderPlus, Plus, Folder } from 'lucide-react-native';
import { safeGoBack } from '../../src/utils/navigation';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { InsetGroup, GroupedRow } from '../../src/components/ios/InsetGroup';
import { useTaskStore } from '../../src/store/taskStore';
import { useTodoPrefs } from '../../src/store/todoPrefsStore';
import { useOutboxStore, flushOutbox } from '../../src/services/todo/outbox';
import { useTodayStr, useTodoBootstrap } from '../../src/hooks/useTodo';
import { countOpen } from '../../src/utils/todo/views';
import { SMART_LISTS, DEFAULT_LIST_COLOR } from '../../src/components/todo/listTheme';
import { ListEditorModal } from '../../src/components/todo/ListEditorModal';
import { ListActions } from '../../src/components/todo/ListActions';
import { NamePromptModal } from '../../src/components/todo/NamePromptModal';
import { OptionsSheet } from '../../src/components/todo/OptionsSheet';
import { confirmAction } from '../../src/utils/todo/confirm';
import { ITaskList, ITaskListGroup } from '../../src/shared/types';

export default function TodoHomeScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const todayStr = useTodayStr();
  useTodoBootstrap();

  const tasks = useTaskStore((s) => s.tasks);
  const lists = useTaskStore((s) => s.lists);
  const groups = useTaskStore((s) => s.groups);
  const settings = useTodoPrefs((s) => s.settings);
  const pending = useOutboxStore((s) => s.pending);

  const [newList, setNewList] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  const [actionList, setActionList] = useState<ITaskList | null>(null);
  const [groupMenu, setGroupMenu] = useState<ITaskListGroup | null>(null);
  const [renameGroup, setRenameGroup] = useState<ITaskListGroup | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Community embeds link here with ?listId=...; send them to that list.
  useEffect(() => {
    if (listId) router.replace(`/todo/list/${listId}` as never);
  }, [listId]);

  const ctx = useMemo(() => ({ todayStr, dueTodayInMyDay: settings.dueTodayInMyDay }), [todayStr, settings.dueTodayInMyDay]);

  const smart = SMART_LISTS.map((s) => ({ ...s, count: countOpen(tasks, s.id, ctx) })).filter((s) => {
    if (settings.hiddenSmartLists.includes(s.id)) return false;
    if (settings.hideEmptySmartLists && s.count === 0 && s.id !== 'my-day' && s.id !== 'tasks') return false;
    return true;
  });

  const open = (id: string) => router.push(`/todo/list/${id}` as never);
  const ungrouped = lists.filter((l) => !l.groupId || !groups.some((g) => g._id === l.groupId));

  const renderList = (l: ITaskList) => (
    <GroupedRow
      key={l._id}
      emoji={l.icon || '📋'}
      icon={Folder}
      tile={l.color || DEFAULT_LIST_COLOR}
      label={l.name}
      value={String(countOpen(tasks, l._id, ctx))}
      chevron
      onPress={() => open(l._id)}
      onLongPress={() => setActionList(l)}
      accessibilityLabel={`${l.name} list, ${countOpen(tasks, l._id, ctx)} tasks`}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LargeTitleHeader
          title="To Do"
          subtitle={pending > 0 ? undefined : 'Plan your day, one step at a time'}
          leading={
            <GlassCircleButton accessibilityLabel="Go back" onPress={() => safeGoBack('/(tabs)/today')}>
              <ArrowLeft size={22} color={palette.text} strokeWidth={2.2} />
            </GlassCircleButton>
          }
          actions={
            <>
              <GlassCircleButton accessibilityLabel="Search tasks" onPress={() => router.push('/todo/search' as never)}>
                <Search size={20} color={palette.text} strokeWidth={2.2} />
              </GlassCircleButton>
              <GlassCircleButton accessibilityLabel="To Do settings" onPress={() => router.push('/todo/settings' as never)}>
                <Settings size={20} color={palette.text} strokeWidth={2.2} />
              </GlassCircleButton>
            </>
          }
        />

        {pending > 0 ? (
          <TouchableOpacity onPress={() => void flushOutbox()} accessibilityRole="button" accessibilityLabel="Retry sync" style={styles.syncNote}>
            <Text style={styles.syncText}>
              {pending} change{pending === 1 ? '' : 's'} waiting to sync · Tap to retry
            </Text>
          </TouchableOpacity>
        ) : null}

        <InsetGroup>
          {smart.map((s) => (
            <GroupedRow
              key={s.id}
              icon={s.icon}
              tile={s.color}
              label={s.title}
              value={s.count > 0 ? String(s.count) : undefined}
              chevron
              onPress={() => open(s.id)}
              accessibilityLabel={`${s.title}, ${s.count} tasks`}
            />
          ))}
        </InsetGroup>

        {ungrouped.length > 0 ? <InsetGroup title="Lists">{ungrouped.map(renderList)}</InsetGroup> : null}

        {groups.map((g) => {
          const members = lists.filter((l) => l.groupId === g._id);
          const isCollapsed = !!collapsed[g._id];
          return (
            <View key={g._id} style={styles.groupBlock}>
              <TouchableOpacity
                style={styles.groupHeader}
                onPress={() => setCollapsed((c) => ({ ...c, [g._id]: !c[g._id] }))}
                onLongPress={() => setGroupMenu(g)}
                accessibilityRole="button"
                accessibilityState={{ expanded: !isCollapsed }}
                accessibilityLabel={`Group ${g.name}, ${members.length} lists`}
              >
                {isCollapsed ? <ChevronRight size={16} color={palette.textSecondary} /> : <ChevronDown size={16} color={palette.textSecondary} />}
                <Text style={styles.groupName} numberOfLines={1}>{g.name}</Text>
                <Text style={styles.groupCount}>{members.length}</Text>
              </TouchableOpacity>
              {!isCollapsed ? (
                members.length > 0 ? (
                  <InsetGroup>{members.map(renderList)}</InsetGroup>
                ) : (
                  <Text style={styles.emptyGroup}>Long-press a list and choose "Move to group" to add it here.</Text>
                )
              ) : null}
            </View>
          );
        })}

        <InsetGroup>
          <GroupedRow icon={Plus} tile={palette.tint} label="New list" onPress={() => setNewList(true)} />
          <GroupedRow icon={FolderPlus} tile="#8E8E93" label="New group" onPress={() => setNewGroup(true)} />
        </InsetGroup>
      </ScrollView>

      <ListEditorModal
        visible={newList}
        title="New list"
        onClose={() => setNewList(false)}
        onSave={async (v) => {
          setNewList(false);
          const created = await useTaskStore.getState().createList(v.name, v.icon, v.color);
          open(created._id);
        }}
      />
      <NamePromptModal
        visible={newGroup}
        title="New group"
        placeholder="Group name"
        onClose={() => setNewGroup(false)}
        onSave={(name) => {
          setNewGroup(false);
          void useTaskStore.getState().createGroup(name);
        }}
      />
      <NamePromptModal
        visible={!!renameGroup}
        title="Rename group"
        placeholder="Group name"
        initial={renameGroup?.name}
        onClose={() => setRenameGroup(null)}
        onSave={(name) => {
          if (renameGroup) void useTaskStore.getState().renameGroup(renameGroup._id, name);
          setRenameGroup(null);
        }}
      />
      <OptionsSheet
        visible={!!groupMenu}
        onClose={() => setGroupMenu(null)}
        title={groupMenu?.name}
        options={[
          { key: 'rename', label: 'Rename group', opensModal: true, onPress: () => setRenameGroup(groupMenu) },
          {
            key: 'ungroup',
            label: 'Ungroup lists',
            destructive: true,
            onPress: () => {
              const g = groupMenu;
              if (g) confirmAction('Ungroup lists?', `The lists in "${g.name}" are kept and the group is removed.`, 'Ungroup', () => void useTaskStore.getState().deleteGroup(g._id));
            },
          },
        ]}
      />
      <ListActions list={actionList} onClose={() => setActionList(null)} />
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { gap: 18, paddingBottom: 40, paddingTop: 6 },
  syncNote: { marginHorizontal: 20, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: palette.warning + '26' },
  syncText: { ...typography.footnote, color: palette.warningText },
  groupBlock: { gap: 7 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 20 },
  groupName: { ...typography.subheadBold, color: palette.textSecondary, flexShrink: 1 },
  groupCount: { ...typography.footnote, color: palette.textSecondary },
  emptyGroup: { ...typography.footnote, color: palette.textSecondary, paddingHorizontal: 20 },
}));
