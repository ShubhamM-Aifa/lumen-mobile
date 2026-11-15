import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Table,
  Kanban,
  Plus,
  SlidersHorizontal,
  Settings,
  Filter,
  ArrowUpDown,
} from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../../theme/ThemeContext';
import { typography } from '../../../theme/typography';
import {
  IDatabaseConfig,
  IDatabaseProperty,
  IDatabaseView,
  INote,
} from '../../../shared/types';
import { useNoteStore } from '../../../store/noteStore';
import { TableView } from './TableView';
import { BoardView } from './BoardView';
import { DatabasePropertyManagerModal } from './DatabasePropertyManagerModal';
import { DatabaseFilterSortModal } from './DatabaseFilterSortModal';

interface DatabaseViewProps {
  noteId: string;
  databaseConfig?: IDatabaseConfig;
  onUpdateConfig: (config: IDatabaseConfig) => void;
}

const DEFAULT_CONFIG: IDatabaseConfig = {
  properties: [
    {
      id: 'prop_status',
      name: 'Status',
      type: 'select',
      options: [
        { id: 'opt_todo', name: 'To Do', color: '#6B7280' },
        { id: 'opt_in_progress', name: 'In Progress', color: '#3B82F6' },
        { id: 'opt_done', name: 'Done', color: '#10B981' },
      ],
    },
    {
      id: 'prop_priority',
      name: 'Priority',
      type: 'select',
      options: [
        { id: 'opt_low', name: 'Low', color: '#10B981' },
        { id: 'opt_medium', name: 'Medium', color: '#F59E0B' },
        { id: 'opt_high', name: 'High', color: '#EF4444' },
      ],
    },
  ],
  views: [
    { id: 'view_table_1', name: 'Table', type: 'table' },
    { id: 'view_board_1', name: 'Board', type: 'board', groupBy: 'prop_status' },
  ],
};

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  noteId,
  databaseConfig = DEFAULT_CONFIG,
  onUpdateConfig,
}) => {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useStyles();

  const notes = useNoteStore((state) => state.notes);
  const createNote = useNoteStore((state) => state.createNote);
  const updateNote = useNoteStore((state) => state.updateNote);

  // Rows of this database are all notes whose parentNoteId === noteId and not in trash
  const rawRows = useMemo(() => {
    return notes.filter((n) => n.parentNoteId === noteId && !n.deletedAt);
  }, [notes, noteId]);

  const [activeViewId, setActiveViewId] = useState<string>(
    databaseConfig.views?.[0]?.id || 'view_table_1'
  );
  const [propertyManagerOpen, setPropertyManagerOpen] = useState(false);
  const [filterSortOpen, setFilterSortOpen] = useState(false);

  const activeView =
    databaseConfig.views.find((v) => v.id === activeViewId) ||
    databaseConfig.views[0] || {
      id: 'view_table_1',
      name: 'Table',
      type: 'table' as const,
    };

  // Filter and sort rows based on active view settings
  const filteredAndSortedRows = useMemo(() => {
    let result = [...rawRows];

    // Apply Filter
    if (activeView.filter && activeView.filter.propId) {
      const { propId, operator, value } = activeView.filter;
      result = result.filter((r) => {
        const propVal = r.rowProps?.[propId];
        if (operator === 'is_checked') {
          return Boolean(propVal) === Boolean(value);
        }
        if (operator === 'equals') {
          return propVal === value;
        }
        if (operator === 'contains') {
          return String(propVal ?? '')
            .toLowerCase()
            .includes(String(value ?? '').toLowerCase());
        }
        return true;
      });
    }

    // Apply Sort
    if (activeView.sort && activeView.sort.propId) {
      const { propId, direction } = activeView.sort;
      result.sort((a, b) => {
        const aVal = a.rowProps?.[propId] ?? '';
        const bVal = b.rowProps?.[propId] ?? '';
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rawRows, activeView.filter, activeView.sort]);

  const handleUpdateProperties = (properties: IDatabaseProperty[]) => {
    const nextConfig: IDatabaseConfig = {
      ...databaseConfig,
      properties,
    };
    onUpdateConfig(nextConfig);
  };

  const handleUpdateActiveView = (updates: Partial<IDatabaseView>) => {
    const nextViews = databaseConfig.views.map((v) =>
      v.id === activeView.id ? { ...v, ...updates } : v
    );
    onUpdateConfig({
      ...databaseConfig,
      views: nextViews,
    });
  };

  const handleAddView = (type: 'table' | 'board') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newView: IDatabaseView = {
      id: 'view_' + Date.now(),
      name: type === 'table' ? `Table ${databaseConfig.views.length + 1}` : `Board ${databaseConfig.views.length + 1}`,
      type,
    };
    const nextViews = [...databaseConfig.views, newView];
    onUpdateConfig({
      ...databaseConfig,
      views: nextViews,
    });
    setActiveViewId(newView.id);
  };

  const handleAddRow = async (initialProps?: Record<string, any>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await createNote({
      parentNoteId: noteId,
      title: 'Untitled',
      icon: '📄',
      rowProps: initialProps || {},
    });
  };

  const handleUpdateRowProp = (rowId: string, propId: string, value: any) => {
    const targetRow = rawRows.find((r) => r._id === rowId);
    const nextRowProps = { ...(targetRow?.rowProps || {}), [propId]: value };
    updateNote(rowId, { rowProps: nextRowProps });
  };

  const handleUpdateRowTitle = (rowId: string, title: string) => {
    updateNote(rowId, { title });
  };

  const handleOpenRow = (rowId: string) => {
    router.push(`/notes/${rowId}`);
  };

  const hasFilter = Boolean(activeView.filter?.propId);
  const hasSort = Boolean(activeView.sort?.propId);

  return (
    <View style={styles.container}>
      {/* Top Database Toolbar */}
      <View style={[styles.toolbar, { borderBottomColor: palette.border }]}>
        {/* View Switcher Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.viewsScroll}>
          {databaseConfig.views.map((v) => {
            const isActive = v.id === activeView.id;
            const Icon = v.type === 'board' ? Kanban : Table;
            return (
              <TouchableOpacity
                key={v.id}
                style={[
                  styles.viewTab,
                  isActive && {
                    backgroundColor: palette.surfaceAlt,
                    borderBottomColor: palette.primary,
                    borderBottomWidth: 2,
                  },
                ]}
                onPress={() => setActiveViewId(v.id)}
              >
                <Icon size={14} color={isActive ? palette.primary : palette.textSecondary} />
                <Text
                  style={[
                    styles.viewTabText,
                    {
                      color: isActive ? palette.text : palette.textSecondary,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {v.name}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Quick Add View */}
          <TouchableOpacity
            style={styles.addViewBtn}
            onPress={() => handleAddView(activeView.type === 'table' ? 'board' : 'table')}
          >
            <Plus size={14} color={palette.textSecondary} />
          </TouchableOpacity>
        </ScrollView>

        {/* Right Tools (Sort/Filter/Properties) */}
        <View style={styles.rightTools}>
          <TouchableOpacity
            style={[
              styles.toolBtn,
              (hasFilter || hasSort) && { backgroundColor: palette.primary + '20' },
            ]}
            onPress={() => setFilterSortOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Filter and Sort"
          >
            <SlidersHorizontal
              size={15}
              color={hasFilter || hasSort ? palette.primary : palette.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => setPropertyManagerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Properties manager"
          >
            <Settings size={15} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Database Content View */}
      {activeView.type === 'board' ? (
        <BoardView
          rows={filteredAndSortedRows}
          properties={databaseConfig.properties}
          groupByPropId={activeView.groupBy}
          onOpenRow={handleOpenRow}
          onUpdateRowProp={handleUpdateRowProp}
          onAddRowWithProp={(propId, val) => handleAddRow(val ? { [propId]: val } : {})}
        />
      ) : (
        <TableView
          rows={filteredAndSortedRows}
          properties={databaseConfig.properties}
          onOpenRow={handleOpenRow}
          onUpdateRowTitle={handleUpdateRowTitle}
          onUpdateRowProp={handleUpdateRowProp}
          onAddRow={() => handleAddRow()}
        />
      )}

      {/* Property Manager Modal */}
      <DatabasePropertyManagerModal
        visible={propertyManagerOpen}
        onClose={() => setPropertyManagerOpen(false)}
        properties={databaseConfig.properties}
        onSaveProperties={handleUpdateProperties}
      />

      {/* Filter & Sort Modal */}
      <DatabaseFilterSortModal
        visible={filterSortOpen}
        onClose={() => setFilterSortOpen(false)}
        properties={databaseConfig.properties}
        view={activeView}
        onUpdateView={handleUpdateActiveView}
      />
    </View>
  );
};

const useStyles = createThemedStyles((palette) => ({
  container: {
    marginVertical: 12,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  viewsScroll: {
    flexDirection: 'row',
  },
  viewTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 4,
    borderRadius: 8,
  },
  viewTabText: {
    fontSize: 13,
  },
  addViewBtn: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

