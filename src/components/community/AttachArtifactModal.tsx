import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, FileText, CheckSquare, ClipboardList, Check } from 'lucide-react-native';
import { useNoteStore } from '../../store/noteStore';
import { useTaskStore } from '../../store/taskStore';
import { useConfigStore } from '../../store/configStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import {
  CommunityEmbedType,
  INoteEmbedPayload,
  ITodoEmbedPayload,
  ILogTemplateEmbedPayload,
} from '../../shared/types';

interface AttachArtifactModalProps {
  visible: boolean;
  onClose: () => void;
  onAttach: (type: CommunityEmbedType, data: any) => void;
}

export const AttachArtifactModal: React.FC<AttachArtifactModalProps> = ({
  visible,
  onClose,
  onAttach,
}) => {
  const { palette } = useTheme();
  const { notes } = useNoteStore();
  const { lists, tasks } = useTaskStore();
  const { config } = useConfigStore();

  const [activeTab, setActiveTab] = useState<'notes' | 'todos' | 'templates'>('notes');

  const handleSelectNote = (note: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const payload: INoteEmbedPayload = {
      noteId: note._id,
      title: note.title,
      icon: note.icon || '📝',
      coverGradient: note.coverGradient,
      tags: note.tags || [],
      blocksPreview: (note.blocks || []).slice(0, 2).map((b: any) => ({
        type: b.type,
        content: b.content,
      })),
      blocksFull: note.blocks || [],
    };
    onAttach('note', { note: payload });
    onClose();
  };

  const handleSelectTodoList = (list: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const listTasks = tasks.filter((t) => t.listId === list._id);
    const payload: ITodoEmbedPayload = {
      listName: list.name,
      tasks: listTasks.map((t) => ({
        title: t.title,
        energyCost: t.energyCost,
        steps: (t.steps || []).map((s) => ({ title: s.title })),
      })),
    };
    onAttach('todo_list', { todo: payload });
    onClose();
  };

  const handleSelectLogTemplate = (category: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const payload: ILogTemplateEmbedPayload = {
      title: `${category.name} Logging Template`,
      conditionTags: [category.role || 'symptom'],
      categories: [category],
      quickActions: (config?.quickActions || []).slice(0, 3),
    };
    onAttach('log_template', { logTemplate: payload });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={styles.topBar}>
            <Text style={[styles.title, { color: palette.text }]}>Share Health Artifact</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'notes' && {
                  backgroundColor: 'rgba(56, 189, 248, 0.18)',
                  borderColor: '#38BDF8',
                },
              ]}
              onPress={() => setActiveTab('notes')}
            >
              <FileText size={15} color={activeTab === 'notes' ? '#38BDF8' : palette.textSecondary} />
              <Text style={[styles.tabText, { color: activeTab === 'notes' ? '#38BDF8' : palette.textSecondary }]}>
                Notes ({notes.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'todos' && {
                  backgroundColor: 'rgba(16, 185, 129, 0.18)',
                  borderColor: '#10B981',
                },
              ]}
              onPress={() => setActiveTab('todos')}
            >
              <CheckSquare size={15} color={activeTab === 'todos' ? '#10B981' : palette.textSecondary} />
              <Text style={[styles.tabText, { color: activeTab === 'todos' ? '#10B981' : palette.textSecondary }]}>
                To-Dos ({lists.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'templates' && {
                  backgroundColor: 'rgba(168, 85, 247, 0.18)',
                  borderColor: '#A855F7',
                },
              ]}
              onPress={() => setActiveTab('templates')}
            >
              <ClipboardList size={15} color={activeTab === 'templates' ? '#A855F7' : palette.textSecondary} />
              <Text style={[styles.tabText, { color: activeTab === 'templates' ? '#A855F7' : palette.textSecondary }]}>
                Trackers
              </Text>
            </TouchableOpacity>
          </View>

          {/* List Content */}
          <ScrollView style={styles.listArea} showsVerticalScrollIndicator={false}>
            {activeTab === 'notes' && (
              notes.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={{ color: palette.textSecondary }}>No notes created yet.</Text>
                </View>
              ) : (
                notes.map((n) => (
                  <TouchableOpacity
                    key={n._id}
                    style={styles.itemCard}
                    onPress={() => handleSelectNote(n)}
                  >
                    <Text style={styles.itemEmoji}>{n.icon || '📝'}</Text>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemTitle, { color: palette.text }]}>{n.title}</Text>
                      <Text style={[styles.itemSub, { color: palette.textSecondary }]}>
                        {n.blocks.length} blocks • {(n.tags || []).join(', ') || 'No tags'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )
            )}

            {activeTab === 'todos' && (
              lists.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={{ color: palette.textSecondary }}>No custom task lists created yet.</Text>
                </View>
              ) : (
                lists.map((l) => (
                  <TouchableOpacity
                    key={l._id}
                    style={styles.itemCard}
                    onPress={() => handleSelectTodoList(l)}
                  >
                    <Text style={styles.itemEmoji}>{l.icon || '📋'}</Text>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemTitle, { color: palette.text }]}>{l.name}</Text>
                      <Text style={[styles.itemSub, { color: palette.textSecondary }]}>
                        {tasks.filter((t) => t.listId === l._id).length} tasks in list
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )
            )}

            {activeTab === 'templates' && (
              (config?.categories || []).map((c) => (
                <TouchableOpacity
                  key={c._id}
                  style={styles.itemCard}
                  onPress={() => handleSelectLogTemplate(c)}
                >
                  <Text style={styles.itemEmoji}>{c.icon || '📊'}</Text>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemTitle, { color: palette.text }]}>{c.name}</Text>
                    <Text style={[styles.itemSub, { color: palette.textSecondary }]}>
                      Role: {c.role} • Share symptom telemetry structure
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    ...typography.h3,
    fontSize: 18,
  },
  closeBtn: {
    padding: 4,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listArea: {
    paddingHorizontal: 20,
  },
  emptyBox: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  itemEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  itemSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
