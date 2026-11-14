import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTaskStore } from '../../store/taskStore';
import { createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

const VISIBLE_MS = 6000;

interface Props {
  /** Distance from the bottom of the screen, to sit above the add bar. */
  bottomOffset?: number;
}

/** "Task deleted · Undo" snackbar. Shows for six seconds, then the undo is forgotten. */
export function TodoUndoToast({ bottomOffset = 96 }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const entry = useTaskStore((s) => s.undoEntry);
  const undoLast = useTaskStore((s) => s.undoLast);
  const clearUndo = useTaskStore((s) => s.clearUndo);

  useEffect(() => {
    if (!entry) return;
    const id = entry.id;
    const timer = setTimeout(() => {
      if (useTaskStore.getState().undoEntry?.id === id) clearUndo();
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [entry, clearUndo]);

  if (!entry) return null;
  return (
    <View style={[styles.wrap, { bottom: bottomOffset + insets.bottom }]} pointerEvents="box-none" accessibilityLiveRegion="polite">
      <View style={styles.toast}>
        <Text style={styles.text} numberOfLines={1}>{entry.label}</Text>
        <TouchableOpacity onPress={() => void undoLast()} accessibilityRole="button" accessibilityLabel="Undo" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.undo}>Undo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 50 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: '#2C2C2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  text: { ...typography.subhead, color: '#FFFFFF', flexShrink: 1 },
  undo: { ...typography.subheadBold, color: '#64D2FF' },
}));
