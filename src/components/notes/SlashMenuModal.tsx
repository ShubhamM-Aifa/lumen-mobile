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
import {
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  List,
  ListOrdered,
  Lightbulb,
  ChevronRightSquare,
  Quote,
  Minus,
  Type,
  X,
  Search,
} from 'lucide-react-native';
import { NoteBlockType } from '../../shared/types';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface SlashMenuItem {
  type: NoteBlockType;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface SlashMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectBlock: (type: NoteBlockType) => void;
}

export const SlashMenuModal: React.FC<SlashMenuModalProps> = ({
  visible,
  onClose,
  onSelectBlock,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();
  const [filterQuery, setFilterQuery] = useState('');

  const menuItems: SlashMenuItem[] = [
    {
      type: 'paragraph',
      title: 'Text',
      description: 'Just start writing with plain text.',
      icon: <Type size={18} color={palette.textSecondary} />,
    },
    {
      type: 'heading_1',
      title: 'Heading 1',
      description: 'Big section heading.',
      icon: <Heading1 size={18} color={palette.tint} />,
    },
    {
      type: 'heading_2',
      title: 'Heading 2',
      description: 'Medium section heading.',
      icon: <Heading2 size={18} color="#5856D6" />,
    },
    {
      type: 'heading_3',
      title: 'Heading 3',
      description: 'Small section heading.',
      icon: <Heading3 size={18} color={palette.catMeds} />,
    },
    {
      type: 'todo',
      title: 'To-do list',
      description: 'Track tasks with a checkable checkbox.',
      icon: <CheckSquare size={18} color={palette.success} />,
    },
    {
      type: 'callout',
      title: 'Callout Box',
      description: 'Make clinical guidelines or alerts stand out with an emoji.',
      icon: <Lightbulb size={18} color={palette.warning} />,
    },
    {
      type: 'toggle',
      title: 'Toggle List',
      description: 'Toggles can show and hide nested medical notes.',
      icon: <ChevronRightSquare size={18} color="#FF2D55" />,
    },
    {
      type: 'bullet_list',
      title: 'Bulleted list',
      description: 'Create a simple bulleted list of symptoms or points.',
      icon: <List size={18} color={palette.tint} />,
    },
    {
      type: 'numbered_list',
      title: 'Numbered list',
      description: 'Create a sequential list (1, 2, 3...).',
      icon: <ListOrdered size={18} color={palette.warning} />,
    },
    {
      type: 'quote',
      title: 'Quote',
      description: 'Capture a doctor instruction or literature takeaway.',
      icon: <Quote size={18} color={palette.secondary} />,
    },
    {
      type: 'divider',
      title: 'Divider',
      description: 'Visually divide blocks with a clean line.',
      icon: <Minus size={18} color={palette.textSecondary} />,
    },
  ];

  const filteredItems = menuItems.filter(
    (item) =>
      item.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleSelect = (type: NoteBlockType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectBlock(type);
    onClose();
    setFilterQuery('');
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
            <Text style={[styles.sheetTitle, { color: palette.text }]}>Add Block</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search filter input */}
          <View style={[styles.searchRow, { backgroundColor: palette.surfaceAlt }]}>
            <Search size={16} color={palette.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: palette.text }]}
              placeholder="Filter blocks (e.g. h1, todo, callout)..."
              placeholderTextColor={palette.textDisabled}
              value={filterQuery}
              onChangeText={setFilterQuery}
              autoFocus
            />
          </View>

          {/* Block Items List */}
          <ScrollView style={styles.itemList} showsVerticalScrollIndicator={false}>
            {filteredItems.map((item) => (
              <TouchableOpacity
                key={item.type}
                style={styles.itemRow}
                onPress={() => handleSelect(item.type)}
                activeOpacity={0.7}
              >
                <View style={styles.iconBox}>{item.icon}</View>
                <View style={styles.textCol}>
                  <Text style={[styles.itemTitle, { color: palette.text }]}>{item.title}</Text>
                  <Text style={[styles.itemDesc, { color: palette.textSecondary }]}>
                    {item.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const useStyles = createThemedStyles(palette => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  sheetTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  closeBtn: {
    padding: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  itemList: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    gap: 14,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  itemDesc: {
    fontSize: 12,
    marginTop: 2,
  },
}));
