import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  AlertButton,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Plus, MoreHorizontal, ArrowRight } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../../theme/ThemeContext';
import {
  IDatabaseProperty,
  IDatabasePropertyOption,
  INote,
} from '../../../shared/types';

interface BoardViewProps {
  rows: INote[];
  properties: IDatabaseProperty[];
  groupByPropId?: string;
  onOpenRow: (id: string) => void;
  onUpdateRowProp: (id: string, propId: string, value: any) => void;
  onAddRowWithProp: (propId: string, value: string | null) => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  rows,
  properties,
  groupByPropId,
  onOpenRow,
  onUpdateRowProp,
  onAddRowWithProp,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();

  // Find groupBy property: explicitly passed or first 'select' property
  const groupProp =
    properties.find((p) => p.id === groupByPropId) ||
    properties.find((p) => p.type === 'select') ||
    properties[0];

  const options: Array<{ id: string | null; name: string; color?: string }> = [
    { id: null, name: 'No ' + (groupProp?.name || 'Group'), color: palette.textSecondary },
    ...((groupProp?.options || []).map((o) => ({
      id: o.id,
      name: o.name,
      color: o.color,
    }))),
  ];

  const handleMoveCard = (row: INote) => {
    if (!groupProp) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const alertButtons: AlertButton[] = [
      ...options.map((opt) => ({
        text: opt.name,
        onPress: () => {
          onUpdateRowProp(row._id, groupProp.id, opt.id);
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ];

    Alert.alert(`Move to ${groupProp.name}`, 'Select target group:', alertButtons);
  };

  if (!groupProp) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
          Board view requires at least one Select property to group columns.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={true}
      contentContainerStyle={styles.boardScroll}
    >
      {options.map((opt) => {
        const columnRows = rows.filter((r) => {
          const val = r.rowProps?.[groupProp.id];
          if (opt.id === null) {
            return !val;
          }
          return val === opt.id || val === opt.name;
        });

        return (
          <View
            key={opt.id || 'none'}
            style={[
              styles.column,
              { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
            ]}
          >
            {/* Column Header */}
            <View style={[styles.colHeader, { borderBottomColor: palette.border }]}>
              <View style={styles.colTitleRow}>
                <View
                  style={[
                    styles.colorPill,
                    { backgroundColor: (opt.color || palette.primary) + '25' },
                  ]}
                >
                  <Text style={[styles.colorPillText, { color: opt.color || palette.text }]}>
                    {opt.name}
                  </Text>
                </View>
                <Text style={[styles.rowCount, { color: palette.textSecondary }]}>
                  {columnRows.length}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => onAddRowWithProp(groupProp.id, opt.id)}
                style={styles.colAddBtn}
                accessibilityRole="button"
                accessibilityLabel="Add card"
              >
                <Plus size={16} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Cards List */}
            <ScrollView style={styles.cardsScroll} showsVerticalScrollIndicator={false}>
              {columnRows.map((card) => (
                <TouchableOpacity
                  key={card._id}
                  style={[
                    styles.card,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                  ]}
                  onPress={() => onOpenRow(card._id)}
                  onLongPress={() => handleMoveCard(card)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Card ${card.title}`}
                >
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardEmoji}>{card.icon || '📄'}</Text>
                    <TouchableOpacity
                      onPress={() => handleMoveCard(card)}
                      style={styles.moveBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MoreHorizontal size={14} color={palette.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <Text
                    style={[styles.cardTitle, { color: palette.text }]}
                    numberOfLines={2}
                  >
                    {card.title || 'Untitled'}
                  </Text>

                  {/* Summary of other props */}
                  <View style={styles.cardFooter}>
                    {properties
                      .filter((p) => p.id !== groupProp.id && card.rowProps?.[p.id] !== undefined)
                      .slice(0, 2)
                      .map((p) => {
                        const v = card.rowProps![p.id];
                        return (
                          <View
                            key={p.id}
                            style={[
                              styles.miniTag,
                              { backgroundColor: palette.background },
                            ]}
                          >
                            <Text
                              style={[styles.miniTagText, { color: palette.textSecondary }]}
                              numberOfLines={1}
                            >
                              {p.name}: {String(v)}
                            </Text>
                          </View>
                        );
                      })}
                  </View>
                </TouchableOpacity>
              ))}

              {/* Add Card Button */}
              <TouchableOpacity
                style={styles.bottomAddBtn}
                onPress={() => onAddRowWithProp(groupProp.id, opt.id)}
              >
                <Plus size={14} color={palette.textSecondary} />
                <Text style={[styles.bottomAddText, { color: palette.textSecondary }]}>
                  New
                </Text>
              </TouchableOpacity>
              <View style={{ height: 16 }} />
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );
};

const useStyles = createThemedStyles((palette) => ({
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  boardScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  column: {
    width: 260,
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: 500,
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  colorPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rowCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  colAddBtn: {
    padding: 4,
  },
  cardsScroll: {
    padding: 8,
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardEmoji: {
    fontSize: 16,
  },
  moveBtn: {
    padding: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  miniTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: '100%',
  },
  miniTagText: {
    fontSize: 10,
    fontWeight: '500',
  },
  bottomAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  bottomAddText: {
    fontSize: 12,
    fontWeight: '500',
  },
}));
