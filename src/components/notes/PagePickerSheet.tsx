import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, Folder, ChevronRight, Check, Home } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useNoteStore } from '../../store/noteStore';
import { INoteTreeNode } from '../../shared/types';

interface PagePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  noteIdToMove: string;
  currentParentId?: string | null;
  onSelectParent: (newParentId: string | null) => void;
}

export const PagePickerSheet: React.FC<PagePickerSheetProps> = ({
  visible,
  onClose,
  noteIdToMove,
  currentParentId,
  onSelectParent,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();
  const tree = useNoteStore((state) => state.tree);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(currentParentId ?? null);

  // Compute descendants of noteIdToMove to prevent moving a note into its own child
  const invalidTargetIds = useMemo(() => {
    const invalid = new Set<string>([noteIdToMove]);
    let added = true;
    while (added) {
      added = false;
      for (const node of tree) {
        if (node.parentNoteId && invalid.has(node.parentNoteId) && !invalid.has(node._id)) {
          invalid.add(node._id);
          added = true;
        }
      }
    }
    return invalid;
  }, [tree, noteIdToMove]);

  // Build hierarchical list for picker
  const renderNodes = useMemo(() => {
    const validNodes = tree.filter((n) => !invalidTargetIds.has(n._id));
    const childrenMap = new Map<string | null, INoteTreeNode[]>();

    for (const node of validNodes) {
      const pid = node.parentNoteId && validNodes.some((v) => v._id === node.parentNoteId)
        ? node.parentNoteId
        : null;
      if (!childrenMap.has(pid)) {
        childrenMap.set(pid, []);
      }
      childrenMap.get(pid)!.push(node);
    }

    const flatList: Array<{ node: INoteTreeNode; depth: number }> = [];

    function traverse(pid: string | null, depth: number) {
      const children = childrenMap.get(pid) || [];
      children.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      for (const child of children) {
        flatList.push({ node: child, depth });
        traverse(child._id, depth + 1);
      }
    }

    traverse(null, 0);
    return flatList;
  }, [tree, invalidTargetIds]);

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSelectParent(selectedParentId);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <View>
              <Text style={[styles.title, { color: palette.text }]}>Move Page</Text>
              <Text style={[styles.sub, { color: palette.textSecondary }]}>
                Select destination workspace or page
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Hierarchy Scroll */}
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Root / Top-level option */}
            <TouchableOpacity
              style={[
                styles.itemRow,
                selectedParentId === null && { backgroundColor: palette.primary + '18' },
              ]}
              onPress={() => setSelectedParentId(null)}
              accessibilityRole="button"
              accessibilityLabel="Top Level Workspace"
            >
              <View style={styles.itemContent}>
                <Home size={18} color={palette.primary} />
                <Text style={[styles.itemText, { color: palette.text, fontWeight: '600' }]}>
                  Workspace (Root Level)
                </Text>
              </View>
              {selectedParentId === null && <Check size={18} color={palette.primary} />}
            </TouchableOpacity>

            {/* Tree Nodes */}
            {renderNodes.map(({ node, depth }) => {
              const isSelected = selectedParentId === node._id;
              return (
                <TouchableOpacity
                  key={node._id}
                  style={[
                    styles.itemRow,
                    { paddingLeft: 16 + depth * 20 },
                    isSelected && { backgroundColor: palette.primary + '18' },
                  ]}
                  onPress={() => setSelectedParentId(node._id)}
                  accessibilityRole="button"
                  accessibilityLabel={node.title}
                >
                  <View style={styles.itemContent}>
                    <Text style={styles.itemEmoji}>{node.icon || '📄'}</Text>
                    <Text
                      style={[styles.itemText, { color: palette.text }]}
                      numberOfLines={1}
                    >
                      {node.title || 'Untitled'}
                    </Text>
                  </View>
                  {isSelected && <Check size={18} color={palette.primary} />}
                </TouchableOpacity>
              );
            })}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Confirm Button */}
          <View style={[styles.footer, { borderTopColor: palette.border }]}>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: palette.primary }]}
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel="Move Here"
            >
              <Text style={styles.confirmBtnText}>Move Here</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const useStyles = createThemedStyles((palette) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    paddingVertical: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  itemEmoji: {
    fontSize: 16,
  },
  itemText: {
    fontSize: 14,
    flexShrink: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
}));

