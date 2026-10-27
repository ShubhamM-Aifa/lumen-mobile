import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Check,
  ChevronRight,
  ChevronDown,
  Trash2,
  GripVertical,
} from 'lucide-react-native';
import { INoteBlock, NoteBlockType } from '../../shared/types';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface BlockRendererProps {
  block: INoteBlock;
  index: number;
  onUpdate: (updates: Partial<INoteBlock>) => void;
  onDelete: () => void;
  onEnterPress?: () => void;
  onSlashTrigger?: () => void;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  index,
  onUpdate,
  onDelete,
  onEnterPress,
  onSlashTrigger,
}) => {
  const { palette } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleChangeText = (text: string) => {
    // If user types '/' as the first character, trigger the Notion slash menu
    if (text === '/') {
      onSlashTrigger?.();
      return;
    }
    onUpdate({ content: text });
  };

  const handleToggleTodo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate({ completed: !block.completed });
  };

  const handleToggleCollapse = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate({ isCollapsed: !block.isCollapsed });
  };

  // Render specific block types
  const renderBlockContent = () => {
    switch (block.type) {
      case 'heading_1':
        return (
          <TextInput
            style={[styles.h1Input, { color: palette.text }]}
            placeholder="Heading 1"
            placeholderTextColor={palette.textDisabled}
            value={block.content}
            onChangeText={handleChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={onEnterPress}
            multiline
          />
        );

      case 'heading_2':
        return (
          <TextInput
            style={[styles.h2Input, { color: palette.text }]}
            placeholder="Heading 2"
            placeholderTextColor={palette.textDisabled}
            value={block.content}
            onChangeText={handleChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={onEnterPress}
            multiline
          />
        );

      case 'heading_3':
        return (
          <TextInput
            style={[styles.h3Input, { color: palette.text }]}
            placeholder="Heading 3"
            placeholderTextColor={palette.textDisabled}
            value={block.content}
            onChangeText={handleChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={onEnterPress}
            multiline
          />
        );

      case 'todo':
        return (
          <View style={styles.todoRow}>
            <TouchableOpacity
              style={[
                styles.todoCheckbox,
                {
                  borderColor: block.completed ? palette.primary : palette.textSecondary,
                  backgroundColor: block.completed ? palette.primary : 'transparent',
                },
              ]}
              onPress={handleToggleTodo}
            >
              {block.completed && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
            </TouchableOpacity>
            <TextInput
              style={[
                styles.todoInput,
                {
                  color: block.completed ? palette.textDisabled : palette.text,
                  textDecorationLine: block.completed ? 'line-through' : 'none',
                },
              ]}
              placeholder="To-do item"
              placeholderTextColor={palette.textDisabled}
              value={block.content}
              onChangeText={handleChangeText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onSubmitEditing={onEnterPress}
              multiline
            />
          </View>
        );

      case 'bullet_list':
        return (
          <View style={styles.bulletRow}>
            <Text style={[styles.bulletPoint, { color: palette.textSecondary }]}>•</Text>
            <TextInput
              style={[styles.bulletInput, { color: palette.text }]}
              placeholder="List item"
              placeholderTextColor={palette.textDisabled}
              value={block.content}
              onChangeText={handleChangeText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onSubmitEditing={onEnterPress}
              multiline
            />
          </View>
        );

      case 'numbered_list':
        return (
          <View style={styles.bulletRow}>
            <Text style={[styles.numberIndex, { color: palette.textSecondary }]}>{index + 1}.</Text>
            <TextInput
              style={[styles.bulletInput, { color: palette.text }]}
              placeholder="List item"
              placeholderTextColor={palette.textDisabled}
              value={block.content}
              onChangeText={handleChangeText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onSubmitEditing={onEnterPress}
              multiline
            />
          </View>
        );

      case 'callout':
        return (
          <View
            style={[
              styles.calloutBox,
              {
                backgroundColor: block.calloutColor ? `${block.calloutColor}18` : palette.tint + '1F',
                borderColor: block.calloutColor ? `${block.calloutColor}40` : palette.tint + '4D',
              },
            ]}
          >
            <Text style={styles.calloutEmoji}>{block.calloutIcon || '💡'}</Text>
            <TextInput
              style={[styles.calloutInput, { color: palette.text }]}
              placeholder="Callout text or alert..."
              placeholderTextColor={palette.textDisabled}
              value={block.content}
              onChangeText={handleChangeText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              multiline
            />
          </View>
        );

      case 'toggle':
        return (
          <View style={styles.toggleWrapper}>
            <View style={styles.toggleHeader}>
              <TouchableOpacity onPress={handleToggleCollapse} style={styles.toggleIconBtn}>
                {block.isCollapsed ? (
                  <ChevronRight size={16} color={palette.textSecondary} />
                ) : (
                  <ChevronDown size={16} color={palette.textSecondary} />
                )}
              </TouchableOpacity>
              <TextInput
                style={[styles.toggleTitleInput, { color: palette.text }]}
                placeholder="Toggle header"
                placeholderTextColor={palette.textDisabled}
                value={block.content}
                onChangeText={handleChangeText}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                multiline
              />
            </View>
            {!block.isCollapsed && block.children && block.children.length > 0 && (
              <View style={styles.toggleChildren}>
                {block.children.map((child, cIdx) => (
                  <View key={child.id} style={styles.childRow}>
                    <Text style={{ color: palette.textSecondary, marginRight: 6 }}>•</Text>
                    <Text style={{ color: palette.text, fontSize: 14 }}>{child.content}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      case 'quote':
        return (
          <View style={[styles.quoteBox, { borderLeftColor: palette.primary }]}>
            <TextInput
              style={[styles.quoteInput, { color: palette.text }]}
              placeholder="Quote or clinical takeaway..."
              placeholderTextColor={palette.textDisabled}
              value={block.content}
              onChangeText={handleChangeText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              multiline
            />
          </View>
        );

      case 'divider':
        return (
          <View style={styles.dividerWrapper}>
            <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
          </View>
        );

      case 'paragraph':
      default:
        return (
          <TextInput
            style={[styles.paragraphInput, { color: palette.text }]}
            placeholder="Type '/' for commands..."
            placeholderTextColor={palette.textDisabled}
            value={block.content}
            onChangeText={handleChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={onEnterPress}
            multiline
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.blockRow}>
        <View style={styles.contentArea}>{renderBlockContent()}</View>

        {/* Delete block action (reveals on focus or hovering) */}
        {isFocused && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={14} color={palette.errorText} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 3,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  contentArea: {
    flex: 1,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 6,
    alignSelf: 'center',
  },
  paragraphInput: {
    ...typography.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  h1Input: {
    ...typography.h1,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginTop: 10,
    marginBottom: 4,
    padding: 0,
  },
  h2Input: {
    ...typography.h2,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginTop: 8,
    marginBottom: 4,
    padding: 0,
  },
  h3Input: {
    ...typography.h3,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 2,
    padding: 0,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 2,
  },
  todoCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  todoInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    padding: 0,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 2,
  },
  bulletPoint: {
    fontSize: 18,
    lineHeight: 22,
  },
  numberIndex: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  bulletInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    padding: 0,
  },
  calloutBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 6,
  },
  calloutEmoji: {
    fontSize: 18,
    marginTop: 1,
  },
  calloutInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    padding: 0,
  },
  toggleWrapper: {
    marginVertical: 4,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleIconBtn: {
    padding: 2,
  },
  toggleTitleInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    padding: 0,
  },
  toggleChildren: {
    paddingLeft: 24,
    paddingTop: 6,
    gap: 4,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quoteBox: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 4,
    marginVertical: 6,
  },
  quoteInput: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
    padding: 0,
  },
  dividerWrapper: {
    paddingVertical: 12,
  },
  dividerLine: {
    height: 1,
    width: '100%',
  },
});
