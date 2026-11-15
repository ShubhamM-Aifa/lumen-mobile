import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  X,
  Plus,
  Trash2,
  Tag,
  Hash,
  Calendar,
  CheckSquare,
  Link,
  AlignLeft,
  List,
} from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../../theme/ThemeContext';
import { typography } from '../../../theme/typography';
import {
  IDatabaseProperty,
  DatabasePropertyType,
  IDatabasePropertyOption,
} from '../../../shared/types';

interface DatabasePropertyManagerModalProps {
  visible: boolean;
  onClose: () => void;
  properties: IDatabaseProperty[];
  onSaveProperties: (properties: IDatabaseProperty[]) => void;
}

const PROPERTY_TYPES: { type: DatabasePropertyType; label: string; icon: any }[] = [
  { type: 'text', label: 'Text', icon: AlignLeft },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'select', label: 'Select', icon: Tag },
  { type: 'multi_select', label: 'Multi-select', icon: List },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'url', label: 'URL', icon: Link },
];

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#6B7280',
];

export const DatabasePropertyManagerModal: React.FC<DatabasePropertyManagerModalProps> = ({
  visible,
  onClose,
  properties,
  onSaveProperties,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();

  const [propList, setPropList] = useState<IDatabaseProperty[]>(properties);
  const [editingPropId, setEditingPropId] = useState<string | null>(null);
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState<DatabasePropertyType>('text');
  const [newOptionName, setNewOptionName] = useState('');

  // Sync state if modal opens
  React.useEffect(() => {
    setPropList(properties);
  }, [properties, visible]);

  const handleAddProperty = () => {
    if (!newPropName.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newProp: IDatabaseProperty = {
      id: 'prop_' + Date.now(),
      name: newPropName.trim(),
      type: newPropType,
      options: newPropType === 'select' || newPropType === 'multi_select'
        ? [
            { id: 'opt_1', name: 'Option 1', color: PRESET_COLORS[0] },
            { id: 'opt_2', name: 'Option 2', color: PRESET_COLORS[1] },
          ]
        : undefined,
    };

    const next = [...propList, newProp];
    setPropList(next);
    onSaveProperties(next);
    setNewPropName('');
    setNewPropType('text');
  };

  const handleDeleteProperty = (id: string) => {
    Alert.alert('Delete Property', 'Are you sure you want to delete this column?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const next = propList.filter((p) => p.id !== id);
          setPropList(next);
          onSaveProperties(next);
        },
      },
    ]);
  };

  const handleAddOption = (propId: string) => {
    if (!newOptionName.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
    const newOption: IDatabasePropertyOption = {
      id: 'opt_' + Date.now(),
      name: newOptionName.trim(),
      color,
    };

    const next = propList.map((p) => {
      if (p.id !== propId) return p;
      return {
        ...p,
        options: [...(p.options || []), newOption],
      };
    });

    setPropList(next);
    onSaveProperties(next);
    setNewOptionName('');
  };

  const handleDeleteOption = (propId: string, optionId: string) => {
    const next = propList.map((p) => {
      if (p.id !== propId) return p;
      return {
        ...p,
        options: (p.options || []).filter((opt) => opt.id !== optionId),
      };
    });
    setPropList(next);
    onSaveProperties(next);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <View>
              <Text style={[styles.title, { color: palette.text }]}>Database Properties</Text>
              <Text style={[styles.sub, { color: palette.textSecondary }]}>
                Customize columns, fields and select tags
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Existing Properties List */}
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
              Current Columns ({propList.length})
            </Text>

            {propList.map((prop) => {
              const TypeIcon = PROPERTY_TYPES.find((t) => t.type === prop.type)?.icon || AlignLeft;
              const isEditing = editingPropId === prop.id;

              return (
                <View
                  key={prop.id}
                  style={[
                    styles.propCard,
                    { backgroundColor: palette.background, borderColor: palette.border },
                  ]}
                >
                  <View style={styles.propRow}>
                    <View style={styles.propLeft}>
                      <View style={[styles.typeBadge, { backgroundColor: palette.surfaceAlt }]}>
                        <TypeIcon size={14} color={palette.primary} />
                      </View>
                      <View>
                        <Text style={[styles.propName, { color: palette.text }]}>{prop.name}</Text>
                        <Text style={[styles.propTypeLabel, { color: palette.textSecondary }]}>
                          {prop.type}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.propActions}>
                      {(prop.type === 'select' || prop.type === 'multi_select') && (
                        <TouchableOpacity
                          style={[styles.smallBtn, { backgroundColor: palette.surfaceAlt }]}
                          onPress={() => setEditingPropId(isEditing ? null : prop.id)}
                        >
                          <Text style={[styles.smallBtnText, { color: palette.text }]}>
                            {isEditing ? 'Done' : 'Options'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => handleDeleteProperty(prop.id)}
                        style={styles.deletePropBtn}
                      >
                        <Trash2 size={16} color={palette.errorText} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Options Manager when select/multi_select */}
                  {isEditing && (prop.type === 'select' || prop.type === 'multi_select') && (
                    <View style={[styles.optionsDrawer, { borderTopColor: palette.border }]}>
                      <Text style={[styles.optionsTitle, { color: palette.textSecondary }]}>
                        Tag Options:
                      </Text>
                      <View style={styles.optionsWrap}>
                        {(prop.options || []).map((opt) => (
                          <View
                            key={opt.id}
                            style={[
                              styles.optionPill,
                              { backgroundColor: (opt.color || palette.primary) + '22' },
                            ]}
                          >
                            <View
                              style={[
                                styles.colorDot,
                                { backgroundColor: opt.color || palette.primary },
                              ]}
                            />
                            <Text
                              style={[
                                styles.optionText,
                                { color: opt.color || palette.text },
                              ]}
                            >
                              {opt.name}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleDeleteOption(prop.id, opt.id)}
                              style={styles.removeOptBtn}
                            >
                              <X size={12} color={opt.color || palette.text} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>

                      {/* Add Option Input */}
                      <View style={styles.addOptionRow}>
                        <TextInput
                          style={[
                            styles.optionInput,
                            {
                              backgroundColor: palette.surface,
                              borderColor: palette.border,
                              color: palette.text,
                            },
                          ]}
                          placeholder="New option label..."
                          placeholderTextColor={palette.placeholder}
                          value={newOptionName}
                          onChangeText={setNewOptionName}
                        />
                        <TouchableOpacity
                          style={[styles.addOptBtn, { backgroundColor: palette.primary }]}
                          onPress={() => handleAddOption(prop.id)}
                        >
                          <Plus size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Add New Property Section */}
            <Text style={[styles.sectionTitle, { color: palette.textSecondary, marginTop: 20 }]}>
              Add New Property
            </Text>
            <View
              style={[
                styles.addCard,
                { backgroundColor: palette.background, borderColor: palette.border },
              ]}
            >
              <TextInput
                style={[
                  styles.nameInput,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    color: palette.text,
                  },
                ]}
                placeholder="Property name (e.g. Status, Priority, Due Date)"
                placeholderTextColor={palette.placeholder}
                value={newPropName}
                onChangeText={setNewPropName}
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.typeSelector}
              >
                {PROPERTY_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = newPropType === t.type;
                  return (
                    <TouchableOpacity
                      key={t.type}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor: isSelected ? palette.primary : palette.surfaceAlt,
                          borderColor: isSelected ? palette.primary : palette.border,
                        },
                      ]}
                      onPress={() => setNewPropType(t.type)}
                    >
                      <Icon size={14} color={isSelected ? '#FFFFFF' : palette.text} />
                      <Text
                        style={[
                          styles.typeChipText,
                          { color: isSelected ? '#FFFFFF' : palette.text },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[
                  styles.createPropBtn,
                  {
                    backgroundColor: newPropName.trim() ? palette.primary : palette.border,
                  },
                ]}
                onPress={handleAddProperty}
                disabled={!newPropName.trim()}
              >
                <Plus size={18} color="#FFFFFF" />
                <Text style={styles.createPropBtnText}>Add Property</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
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
    maxHeight: '85%',
    paddingBottom: 24,
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
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginVertical: 10,
  },
  propCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  propRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  propLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propName: {
    fontSize: 14,
    fontWeight: '600',
  },
  propTypeLabel: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  propActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  smallBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deletePropBtn: {
    padding: 6,
  },
  optionsDrawer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionsTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  colorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  removeOptBtn: {
    padding: 2,
  },
  addOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  optionInput: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  addOptBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  nameInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  typeSelector: {
    flexDirection: 'row',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  createPropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
  },
  createPropBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
}));

