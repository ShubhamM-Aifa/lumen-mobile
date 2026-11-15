import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';

export interface NoteEditorNativeToolbarProps {
  onSlashPress?: () => void;
  onBoldPress?: () => void;
  onItalicPress?: () => void;
  onTodoPress?: () => void;
  onBulletPress?: () => void;
  onCalloutPress?: () => void;
  onImagePress?: () => void;
  onFilePress?: () => void;
  onUndoPress?: () => void;
  onRedoPress?: () => void;
}

export function NoteEditorNativeToolbar({
  onSlashPress,
  onBoldPress,
  onItalicPress,
  onTodoPress,
  onBulletPress,
  onCalloutPress,
  onImagePress,
  onFilePress,
  onUndoPress,
  onRedoPress,
}: NoteEditorNativeToolbarProps) {
  const { palette } = useTheme();

  const buttons = [
    { label: '/', action: onSlashPress, tooltip: 'Commands' },
    { label: 'B', action: onBoldPress, style: { fontWeight: '700' as const } },
    { label: 'I', action: onItalicPress, style: { fontStyle: 'italic' as const } },
    { label: '☑️', action: onTodoPress },
    { label: '• List', action: onBulletPress },
    { label: '💡', action: onCalloutPress },
    { label: '🖼️', action: onImagePress },
    { label: '📎', action: onFilePress },
    { label: '↩️', action: onUndoPress },
    { label: '↪️', action: onRedoPress },
  ];

  return (
    <View style={[styles.container, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
      >
        {buttons.map((b, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.button, { backgroundColor: palette.surface }]}
            onPress={b.action}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonText, { color: palette.text }, b.style]}>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  button: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
