import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Plus, ExternalLink, Calendar } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../../theme/ThemeContext';
import {
  IDatabaseProperty,
  IDatabasePropertyOption,
  INote,
} from '../../../shared/types';

interface TableViewProps {
  rows: INote[];
  properties: IDatabaseProperty[];
  onOpenRow: (id: string) => void;
  onUpdateRowTitle: (id: string, title: string) => void;
  onUpdateRowProp: (id: string, propId: string, value: any) => void;
  onAddRow: () => void;
}

export const TableView: React.FC<TableViewProps> = ({
  rows,
  properties,
  onOpenRow,
  onUpdateRowTitle,
  onUpdateRowProp,
  onAddRow,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();

  const [activeSelectMenu, setActiveSelectMenu] = useState<{
    rowId: string;
    propId: string;
    options: IDatabasePropertyOption[];
  } | null>(null);

  const renderCellContent = (row: INote, prop: IDatabaseProperty) => {
    const val = row.rowProps?.[prop.id];

    switch (prop.type) {
      case 'checkbox': {
        const checked = Boolean(val);
        return (
          <TouchableOpacity
            style={[
              styles.checkboxCell,
              checked && { backgroundColor: palette.primary, borderColor: palette.primary },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onUpdateRowProp(row._id, prop.id, !checked);
            }}
          >
            {checked && <Check size={12} color="#FFFFFF" />}
          </TouchableOpacity>
        );
      }

      case 'select': {
        const selectedOpt = (prop.options || []).find((o) => o.id === val || o.name === val);
        return (
          <TouchableOpacity
            style={[
              styles.selectPill,
              selectedOpt
                ? { backgroundColor: (selectedOpt.color || palette.primary) + '22' }
                : { backgroundColor: palette.surfaceAlt },
            ]}
            onPress={() => {
              setActiveSelectMenu({
                rowId: row._id,
                propId: prop.id,
                options: prop.options || [],
              });
            }}
          >
            <Text
              style={[
                styles.selectPillText,
                { color: selectedOpt?.color || palette.textSecondary },
              ]}
              numberOfLines={1}
            >
              {selectedOpt ? selectedOpt.name : 'Empty'}
            </Text>
          </TouchableOpacity>
        );
      }

      case 'multi_select': {
        const selectedIds: string[] = Array.isArray(val) ? val : [];
        const opts = (prop.options || []).filter(
          (o) => selectedIds.includes(o.id) || selectedIds.includes(o.name)
        );
        return (
          <TouchableOpacity
            style={styles.multiSelectCell}
            onPress={() => {
              setActiveSelectMenu({
                rowId: row._id,
                propId: prop.id,
                options: prop.options || [],
              });
            }}
          >
            {opts.length > 0 ? (
              <View style={styles.multiWrap}>
                {opts.map((opt) => (
                  <View
                    key={opt.id}
                    style={[
                      styles.smallPill,
                      { backgroundColor: (opt.color || palette.primary) + '25' },
                    ]}
                  >
                    <Text style={[styles.smallPillText, { color: opt.color || palette.text }]}>
                      {opt.name}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ color: palette.placeholder, fontSize: 13 }}>Empty</Text>
            )}
          </TouchableOpacity>
        );
      }

      case 'number': {
        return (
          <TextInput
            style={[styles.cellInput, { color: palette.text }]}
            keyboardType="numeric"
            value={val !== undefined && val !== null ? String(val) : ''}
            placeholder="-"
            placeholderTextColor={palette.placeholder}
            onChangeText={(txt) => {
              const num = txt.trim() === '' ? null : Number(txt);
              onUpdateRowProp(row._id, prop.id, num);
            }}
          />
        );
      }

      case 'url': {
        const urlStr = val ? String(val) : '';
        return (
          <View style={styles.urlCell}>
            <TextInput
              style={[styles.cellInput, { flex: 1, color: palette.primary }]}
              value={urlStr}
              placeholder="https://..."
              placeholderTextColor={palette.placeholder}
              onChangeText={(txt) => onUpdateRowProp(row._id, prop.id, txt)}
            />
            {urlStr.startsWith('http') && (
              <TouchableOpacity
                onPress={() => Linking.openURL(urlStr).catch(() => { })}
                style={styles.urlIconBtn}
              >
                <ExternalLink size={14} color={palette.primary} />
              </TouchableOpacity>
            )}
          </View>
        );
      }

      case 'date': {
        return (
          <TextInput
            style={[styles.cellInput, { color: palette.text }]}
            value={val ? String(val) : ''}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={palette.placeholder}
            onChangeText={(txt) => onUpdateRowProp(row._id, prop.id, txt)}
          />
        );
      }

      case 'text':
      default: {
        return (
          <TextInput
            style={[styles.cellInput, { color: palette.text }]}
            value={val ? String(val) : ''}
            placeholder="Empty"
            placeholderTextColor={palette.placeholder}
            onChangeText={(txt) => onUpdateRowProp(row._id, prop.id, txt)}
          />
        );
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.horizontalScroll}>
        <View>
          {/* Table Header Row */}
          <View style={[styles.headerRow, { borderBottomColor: palette.border }]}>
            {/* Title / Name Column Header */}
            <View style={[styles.colHeader, styles.titleCol, { borderRightColor: palette.border }]}>
              <Text style={[styles.headerText, { color: palette.textSecondary }]}>Name</Text>
            </View>

            {/* Property Headers */}
            {properties.map((prop) => (
              <View
                key={prop.id}
                style={[styles.colHeader, styles.propCol, { borderRightColor: palette.border }]}
              >
                <Text style={[styles.headerText, { color: palette.textSecondary }]}>
                  {prop.name}
                </Text>
              </View>
            ))}
          </View>

          {/* Table Body Rows */}
          {rows.map((row) => (
            <View
              key={row._id}
              style={[styles.tableRow, { borderBottomColor: palette.border }]}
            >
              {/* Title / Open Cell */}
              <View
                style={[styles.cell, styles.titleCol, { borderRightColor: palette.border }]}
              >
                <TouchableOpacity
                  onPress={() => onOpenRow(row._id)}
                  style={styles.openPageBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${row.title}`}
                >
                  <Text style={styles.rowIcon}>{row.icon || '📄'}</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.titleInput, { color: palette.text }]}
                  value={row.title}
                  placeholder="Untitled"
                  placeholderTextColor={palette.placeholder}
                  onChangeText={(txt) => onUpdateRowTitle(row._id, txt)}
                />
              </View>

              {/* Property Cells */}
              {properties.map((prop) => (
                <View
                  key={prop.id}
                  style={[styles.cell, styles.propCol, { borderRightColor: palette.border }]}
                >
                  {renderCellContent(row, prop)}
                </View>
              ))}
            </View>
          ))}

          {/* Add Row Button */}
          <TouchableOpacity
            style={[styles.addRowBtn, { borderBottomColor: palette.border }]}
            onPress={onAddRow}
            accessibilityRole="button"
            accessibilityLabel="New page row"
          >
            <Plus size={16} color={palette.textSecondary} />
            <Text style={[styles.addRowText, { color: palette.textSecondary }]}>
              New page
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Popover / Overlay for selecting option */}
      {activeSelectMenu && (
        <View style={styles.selectOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setActiveSelectMenu(null)}
          />
          <View
            style={[
              styles.selectSheet,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.selectSheetTitle, { color: palette.textSecondary }]}>
              Select Tag:
            </Text>
            <TouchableOpacity
              style={styles.selectOptionRow}
              onPress={() => {
                onUpdateRowProp(activeSelectMenu.rowId, activeSelectMenu.propId, null);
                setActiveSelectMenu(null);
              }}
            >
              <Text style={{ color: palette.errorText, fontSize: 13 }}>None (Clear)</Text>
            </TouchableOpacity>
            {activeSelectMenu.options.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.selectOptionRow,
                  { backgroundColor: (opt.color || palette.primary) + '15' },
                ]}
                onPress={() => {
                  onUpdateRowProp(activeSelectMenu.rowId, activeSelectMenu.propId, opt.id);
                  setActiveSelectMenu(null);
                }}
              >
                <View
                  style={[
                    styles.colorDot,
                    { backgroundColor: opt.color || palette.primary },
                  ]}
                />
                <Text style={[styles.selectOptionText, { color: opt.color || palette.text }]}>
                  {opt.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const useStyles = createThemedStyles((palette) => ({
  container: {
    position: 'relative',
    minHeight: 200,
  },
  horizontalScroll: {
    flexGrow: 0,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
  },
  colHeader: {
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  titleCol: {
    width: 220,
    flexDirection: 'row',
    alignItems: 'center',
  },
  propCol: {
    width: 150,
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    height: 44,
    borderRightWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  openPageBtn: {
    marginRight: 6,
  },
  rowIcon: {
    fontSize: 16,
  },
  titleInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
  cellInput: {
    fontSize: 13,
    padding: 0,
    width: '100%',
  },
  checkboxCell: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  selectPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  multiSelectCell: {
    flex: 1,
    justifyContent: 'center',
  },
  multiWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  smallPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  smallPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  urlCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  urlIconBtn: {
    padding: 2,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addRowText: {
    fontSize: 13,
    fontWeight: '500',
  },
  selectOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  selectSheet: {
    width: 200,
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  selectSheetTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    paddingHorizontal: 6,
  },
  selectOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 2,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  selectOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
}));