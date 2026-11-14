import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sun, Star, CheckCircle2, FolderInput, Trash2 } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  count: number;
  total: number;
  onToggleAll: () => void;
  onMyDay: () => void;
  onStar: () => void;
  onComplete: () => void;
  onMove: () => void;
  onDelete: () => void;
}

/** Replaces the add bar while tasks are being selected. */
export function SelectionBar({ count, total, onToggleAll, onMyDay, onStar, onComplete, onMove, onDelete }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const disabled = count === 0;
  const items = [
    { key: 'myday', label: 'My Day', icon: Sun, onPress: onMyDay },
    { key: 'star', label: 'Important', icon: Star, onPress: onStar },
    { key: 'done', label: 'Complete', icon: CheckCircle2, onPress: onComplete },
    { key: 'move', label: 'Move', icon: FolderInput, onPress: onMove },
    { key: 'delete', label: 'Delete', icon: Trash2, onPress: onDelete, destructive: true },
  ];
  return (
    <View style={[styles.wrap, { marginBottom: (Platform.OS === 'android' ? Math.max(insets.bottom, 24) : Math.max(insets.bottom, 12)) + 6 }]}>
      <View style={styles.top}>
        <Text style={styles.count} accessibilityLiveRegion="polite">{count === 0 ? 'Select tasks' : `${count} selected`}</Text>
        <TouchableOpacity onPress={onToggleAll} accessibilityRole="button" accessibilityLabel={count === total ? 'Deselect all' : 'Select all'} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.link}>{count === total ? 'Deselect all' : 'Select all'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.actions}>
        {items.map((it) => {
          const Icon = it.icon;
          const color = it.destructive ? palette.errorText : palette.text;
          return (
            <TouchableOpacity
              key={it.key}
              style={[styles.action, disabled && { opacity: 0.35 }]}
              onPress={it.onPress}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={it.label}
              accessibilityState={{ disabled }}
            >
              <Icon size={22} color={color} strokeWidth={1.9} />
              <Text style={[styles.actionText, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{it.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  wrap: {
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 26,
    gap: 8,
    backgroundColor: palette.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { ...typography.subheadBold, color: palette.text },
  link: { ...typography.subheadBold, color: palette.primaryText },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { flex: 1, alignItems: 'center', gap: 3, minHeight: 52, justifyContent: 'center' },
  actionText: { ...typography.footnote },
}));
