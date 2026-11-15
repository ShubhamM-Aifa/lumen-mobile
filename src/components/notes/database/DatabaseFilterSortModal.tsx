import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, ArrowUpDown, Filter, Check, Trash2 } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../../theme/ThemeContext';
import { typography } from '../../../theme/typography';
import { IDatabaseProperty, IDatabaseView } from '../../../shared/types';

interface DatabaseFilterSortModalProps {
  visible: boolean;
  onClose: () => void;
  properties: IDatabaseProperty[];
  view: IDatabaseView;
  onUpdateView: (viewUpdates: Partial<IDatabaseView>) => void;
}

export const DatabaseFilterSortModal: React.FC<DatabaseFilterSortModalProps> = ({
  visible,
  onClose,
  properties,
  view,
  onUpdateView,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();

  const [sortPropId, setSortPropId] = useState<string | undefined>(view.sort?.propId);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(view.sort?.direction || 'asc');

  const [filterPropId, setFilterPropId] = useState<string | undefined>(view.filter?.propId);
  const [filterValue, setFilterValue] = useState<string>(view.filter?.value ? String(view.filter.value) : '');

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updates: Partial<IDatabaseView> = {};

    if (sortPropId) {
      updates.sort = { propId: sortPropId, direction: sortDirection };
    } else {
      updates.sort = undefined;
    }

    if (filterPropId && filterValue.trim()) {
      const selectedProp = properties.find((p) => p.id === filterPropId);
      const op = selectedProp?.type === 'checkbox' ? 'is_checked' : 'contains';
      updates.filter = {
        propId: filterPropId,
        operator: op,
        value: selectedProp?.type === 'checkbox' ? filterValue === 'true' : filterValue.trim(),
      };
    } else {
      updates.filter = undefined;
    }

    onUpdateView(updates);
    onClose();
  };

  const handleClearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSortPropId(undefined);
    setFilterPropId(undefined);
    setFilterValue('');
    onUpdateView({ sort: undefined, filter: undefined });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <View>
              <Text style={[styles.title, { color: palette.text }]}>Sort & Filter</Text>
              <Text style={[styles.sub, { color: palette.textSecondary }]}>
                Configure sorting and filtering for {view.name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Sort Section */}
            <View style={styles.sectionHeader}>
              <ArrowUpDown size={15} color={palette.primary} />
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Sort By</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.propRow}>
              <TouchableOpacity
                style={[
                  styles.pill,
                  !sortPropId
                    ? { backgroundColor: palette.primary, borderColor: palette.primary }
                    : { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
                ]}
                onPress={() => setSortPropId(undefined)}
              >
                <Text style={[styles.pillText, { color: !sortPropId ? '#FFFFFF' : palette.text }]}>
                  None
                </Text>
              </TouchableOpacity>

              {properties.map((p) => {
                const isSelected = sortPropId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.pill,
                      isSelected
                        ? { backgroundColor: palette.primary, borderColor: palette.primary }
                        : { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
                    ]}
                    onPress={() => setSortPropId(p.id)}
                  >
                    <Text
                      style={[styles.pillText, { color: isSelected ? '#FFFFFF' : palette.text }]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {sortPropId && (
              <View style={styles.directionRow}>
                <TouchableOpacity
                  style={[
                    styles.directionBtn,
                    sortDirection === 'asc'
                      ? { backgroundColor: palette.primary }
                      : { backgroundColor: palette.surfaceAlt },
                  ]}
                  onPress={() => setSortDirection('asc')}
                >
                  <Text
                    style={[
                      styles.directionText,
                      { color: sortDirection === 'asc' ? '#FFFFFF' : palette.text },
                    ]}
                  >
                    Ascending (A → Z, 0 → 9)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.directionBtn,
                    sortDirection === 'desc'
                      ? { backgroundColor: palette.primary }
                      : { backgroundColor: palette.surfaceAlt },
                  ]}
                  onPress={() => setSortDirection('desc')}
                >
                  <Text
                    style={[
                      styles.directionText,
                      { color: sortDirection === 'desc' ? '#FFFFFF' : palette.text },
                    ]}
                  >
                    Descending (Z → A, 9 → 0)
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Filter Section */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Filter size={15} color={palette.primary} />
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Filter By</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.propRow}>
              <TouchableOpacity
                style={[
                  styles.pill,
                  !filterPropId
                    ? { backgroundColor: palette.primary, borderColor: palette.primary }
                    : { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
                ]}
                onPress={() => {
                  setFilterPropId(undefined);
                  setFilterValue('');
                }}
              >
                <Text style={[styles.pillText, { color: !filterPropId ? '#FFFFFF' : palette.text }]}>
                  None
                </Text>
              </TouchableOpacity>

              {properties.map((p) => {
                const isSelected = filterPropId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.pill,
                      isSelected
                        ? { backgroundColor: palette.primary, borderColor: palette.primary }
                        : { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
                    ]}
                    onPress={() => setFilterPropId(p.id)}
                  >
                    <Text
                      style={[styles.pillText, { color: isSelected ? '#FFFFFF' : palette.text }]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {filterPropId && (
              <View style={styles.filterValueBox}>
                <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>Contains value:</Text>
                <TextInput
                  style={[
                    styles.filterInput,
                    {
                      backgroundColor: palette.background,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
                  placeholder="Enter keyword to filter..."
                  placeholderTextColor={palette.placeholder}
                  value={filterValue}
                  onChangeText={setFilterValue}
                />
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: palette.border }]}>
            <TouchableOpacity
              style={[styles.clearBtn, { borderColor: palette.border }]}
              onPress={handleClearAll}
              accessibilityRole="button"
              accessibilityLabel="Clear all"
            >
              <Trash2 size={16} color={palette.errorText} />
              <Text style={[styles.clearText, { color: palette.errorText }]}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: palette.primary }]}
              onPress={handleApply}
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
            >
              <Text style={styles.applyBtnText}>Apply</Text>
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
    maxHeight: '75%',
    paddingBottom: 20,
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
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  propRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  directionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  directionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterValueBox: {
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  filterInput: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
}));

