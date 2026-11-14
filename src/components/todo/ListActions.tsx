import React, { useEffect, useState } from 'react';
import { Pencil, FolderInput, Copy, Trash2, FolderPlus, FolderMinus, Folder } from 'lucide-react-native';
import { OptionsSheet } from './OptionsSheet';
import { ListEditorModal } from './ListEditorModal';
import { NamePromptModal } from './NamePromptModal';
import { useTaskStore } from '../../store/taskStore';
import { ITaskList } from '../../shared/types';
import { confirmAction } from '../../utils/todo/confirm';

interface Props {
  /** The list being acted on; null when nothing is open. */
  list: ITaskList | null;
  onClose: () => void;
  /** Called after the list was deleted, so a list page can leave itself. */
  onDeleted?: () => void;
}

/** Everything you can do to a list: rename / theme, move to a group, duplicate, delete. */
export function ListActions({ list, onClose, onDeleted }: Props) {
  const groups = useTaskStore((s) => s.groups);
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const [pickGroup, setPickGroup] = useState(false);
  const [newGroup, setNewGroup] = useState(false);

  useEffect(() => {
    setMenu(!!list);
    setEdit(false);
    setPickGroup(false);
    setNewGroup(false);
  }, [list?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!list) return null;
  const store = useTaskStore.getState;

  const finish = () => {
    setMenu(false);
    setEdit(false);
    setPickGroup(false);
    setNewGroup(false);
    onClose();
  };

  return (
    <>
      <OptionsSheet
        visible={menu}
        onClose={finish}
        onChosen={() => setMenu(false)}
        title={list.name}
        options={[
          { key: 'edit', label: 'Rename list & theme', icon: Pencil, opensModal: true, onPress: () => setEdit(true) },
          { key: 'group', label: 'Move to group', icon: FolderInput, opensModal: true, onPress: () => setPickGroup(true) },
          {
            key: 'dup',
            label: 'Duplicate list',
            icon: Copy,
            onPress: () => {
              void store().duplicateList(list._id);
              finish();
            },
          },
          {
            key: 'delete',
            label: 'Delete list',
            icon: Trash2,
            destructive: true,
            onPress: () =>
              confirmAction('Delete list?', `"${list.name}" will be deleted. Its tasks are kept and move to Tasks.`, 'Delete', () => {
                void store().deleteList(list._id);
                onDeleted?.();
                finish();
              }),
          },
        ]}
      />

      <ListEditorModal
        visible={edit}
        title="Rename list"
        initial={{ name: list.name, icon: list.icon, color: list.color }}
        onClose={finish}
        onSave={(v) => {
          void store().updateList(list._id, v);
          finish();
        }}
      />

      <OptionsSheet
        visible={pickGroup}
        onClose={finish}
        onChosen={() => setPickGroup(false)}
        title="Move to group"
        options={[
          ...groups.map((g) => ({
            key: g._id,
            label: g.name,
            icon: Folder,
            selected: list.groupId === g._id,
            onPress: () => {
              void store().updateList(list._id, { groupId: g._id });
              finish();
            },
          })),
          { key: 'new', label: 'New group…', icon: FolderPlus, opensModal: true, onPress: () => setNewGroup(true) },
          ...(list.groupId
            ? [{
                key: 'none',
                label: 'Remove from group',
                icon: FolderMinus,
                onPress: () => {
                  void store().updateList(list._id, { groupId: null });
                  finish();
                },
              }]
            : []),
        ]}
      />

      <NamePromptModal
        visible={newGroup}
        title="New group"
        placeholder="Group name"
        onClose={finish}
        onSave={async (name) => {
          const g = await store().createGroup(name);
          await store().updateList(list._id, { groupId: g._id });
          finish();
        }}
      />
    </>
  );
}
