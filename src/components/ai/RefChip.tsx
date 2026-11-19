import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { REF_KIND_META, type ChatRef } from '../../utils/ai/refs';

interface Props {
  ref_: ChatRef;
  /** "composer": on the input bar, with a remove button. "sent": inside the member's own bubble. */
  variant: 'composer' | 'sent';
  onPress?: () => void;
  onRemove?: () => void;
}

/** One attached Lumen item: kind emoji, kind and title. Container is a View so the open and remove buttons are siblings. */
export function RefChip({ ref_: ref, variant, onPress, onRemove }: Props) {
  const styles = useStyles();
  const { palette } = useTheme();
  const meta = REF_KIND_META[ref.kind];
  const sent = variant === 'sent';
  return (
    <View style={[styles.chip, sent ? styles.sentChip : styles.composerChip]}>
      <TouchableOpacity
        style={styles.main}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${meta.label}: ${ref.title}${onPress ? '. Open' : ''}`}
      >
        <Text style={styles.emoji}>{meta.emoji}</Text>
        <View style={styles.texts}>
          <Text style={[styles.kind, sent && styles.sentKind]} maxFontSizeMultiplier={1.2} numberOfLines={1}>{meta.label}</Text>
          <Text style={[styles.title, sent && styles.sentTitle]} maxFontSizeMultiplier={1.2} numberOfLines={1}>{ref.title}</Text>
        </View>
      </TouchableOpacity>
      {onRemove ? (
        <TouchableOpacity style={styles.remove} onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${ref.title}`} hitSlop={6}>
          <X size={14} color={palette.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, maxWidth: 240 },
  composerChip: { backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border, paddingLeft: 10 },
  sentChip: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, alignSelf: 'flex-end' },
  main: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, flexShrink: 1, paddingVertical: 4 },
  emoji: { fontSize: 18 },
  texts: { flexShrink: 1 },
  kind: { ...typography.caption, color: palette.textSecondary },
  title: { ...typography.footnote, fontWeight: '600', color: palette.text },
  sentKind: { color: 'rgba(255,255,255,0.8)' },
  sentTitle: { color: '#FFFFFF' },
  remove: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
}));
