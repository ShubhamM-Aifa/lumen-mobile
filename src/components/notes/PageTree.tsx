import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Plus,
  Star,
  FolderInput,
  Copy,
  Trash2,
  Edit2,
  Table,
} from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { INoteTreeNode } from '../../shared/types';

interface PageTreeProps {
  tree: INoteTreeNode[];
  onOpenPage: (id: string) => void;
  onCreateSubPage: (parentId: string) => void;
  onCreateSubDatabase: (parentId: string) => void;
  onRenamePage: (id: string, currentTitle: string) => void;
  onToggleFavorite: (id: string) => void;
  onMovePage: (id: string) => void;
  onDuplicatePage: (id: string) => void;
  onDeletePage: (id: string, title: string) => void;
  onReorderSiblings?: (orderedIds: string[]) => void;
}

export const PageTree: React.FC<PageTreeProps> = ({
  tree,
  onOpenPage,
  onCreateSubPage,
  onCreateSubDatabase,
  onRenamePage,
  onToggleFavorite,
  onMovePage,
  onDuplicatePage,
  onDeletePage,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();

  // Track expanded folder/node ids
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Group tree by parentNoteId
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, INoteTreeNode[]>();
    for (const node of tree) {
      const pid = node.parentNoteId && tree.some((v) => v._id === node.parentNoteId)
        ? node.parentNoteId
        : null;
      if (!map.has(pid)) {
        map.set(pid, []);
      }
      map.get(pid)!.push(node);
    }
    // Sort siblings by sortOrder
    for (const [_, children] of map.entries()) {
      children.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    return map;
  }, [tree]);

  const toggleExpand = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOpenActionMenu = (node: INoteTreeNode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Alert.alert(
      node.title || 'Untitled Page',
      'Select action:',
      [
        {
          text: 'Add Sub-Page',
          onPress: () => {
            setExpandedIds((prev) => new Set(prev).add(node._id));
            onCreateSubPage(node._id);
          },
        },
        {
          text: 'Add Sub-Database',
          onPress: () => {
            setExpandedIds((prev) => new Set(prev).add(node._id));
            onCreateSubDatabase(node._id);
          },
        },
        {
          text: 'Rename',
          onPress: () => onRenamePage(node._id, node.title),
        },
        {
          text: node.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
          onPress: () => onToggleFavorite(node._id),
        },
        {
          text: 'Move To...',
          onPress: () => onMovePage(node._id),
        },
        {
          text: 'Duplicate',
          onPress: () => onDuplicatePage(node._id),
        },
        {
          text: 'Move to Trash',
          style: 'destructive',
          onPress: () => onDeletePage(node._id, node.title),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const renderNode = (node: INoteTreeNode, depth: number) => {
    const children = childrenMap.get(node._id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(node._id);

    return (
      <View key={node._id}>
        <TouchableOpacity
          style={[
            styles.nodeRow,
            { paddingLeft: 14 + depth * 18 },
          ]}
          onPress={() => onOpenPage(node._id)}
          onLongPress={() => handleOpenActionMenu(node)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${node.title}, page`}
        >
          {/* Chevron for expandable nodes */}
          <TouchableOpacity
            style={styles.chevronBtn}
            onPress={() => hasChildren && toggleExpand(node._id)}
            disabled={!hasChildren}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={14} color={palette.textSecondary} />
              ) : (
                <ChevronRight size={14} color={palette.textSecondary} />
              )
            ) : (
              <View style={{ width: 14 }} />
            )}
          </TouchableOpacity>

          {/* Emoji / Kind Icon */}
          <Text style={styles.nodeIcon}>
            {node.icon || (node.kind === 'database' ? '📊' : '📄')}
          </Text>

          {/* Node Title */}
          <Text
            style={[styles.nodeTitle, { color: palette.text }]}
            numberOfLines={1}
          >
            {node.title || 'Untitled'}
          </Text>

          {/* Sub-pages count pill if any */}
          {hasChildren && (
            <View style={[styles.countBadge, { backgroundColor: palette.surfaceAlt }]}>
              <Text style={[styles.countText, { color: palette.textSecondary }]}>
                {children.length}
              </Text>
            </View>
          )}

          {/* Favorite Indicator */}
          {node.isFavorite && (
            <Star size={12} color={palette.warning} fill={palette.warning} style={styles.favIcon} />
          )}

          {/* Context Action Button */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenActionMenu(node)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MoreHorizontal size={15} color={palette.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Render nested children if expanded */}
        {hasChildren && isExpanded && (
          <View style={styles.childrenContainer}>
            {children.map((child) => renderNode(child, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  const rootNodes = childrenMap.get(null) || [];

  if (rootNodes.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {rootNodes.map((node) => renderNode(node, 0))}
    </View>
  );
};

const useStyles = createThemedStyles((palette) => ({
  container: {
    paddingVertical: 4,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 16,
    borderRadius: 8,
    minHeight: 44,
  },
  chevronBtn: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  nodeIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  nodeTitle: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
  },
  favIcon: {
    marginRight: 6,
  },
  actionBtn: {
    padding: 4,
  },
  childrenContainer: {
    position: 'relative',
  },
}));

