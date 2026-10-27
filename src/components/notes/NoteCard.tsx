import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Star, Stethoscope, Pill } from 'lucide-react-native';
import { INote } from '../../shared/types';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { formatTimeRelative } from '../../utils/dayBoundary';
import { IconTile } from '../ios/InsetGroup';

interface NoteCardProps {
  note: INote;
  onPress: () => void;
  onTogglePin: () => void;
}

/** One note as a list row. Rows sit inside a rounded group card on the Notes screen. */
export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onPress,
  onTogglePin,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();

  const handlePin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTogglePin();
  };

  const snippet =
    note.blocks?.find((b) => b.content && b.content.trim().length > 0)?.content ||
    'Empty note...';

  const linkedSymptomsCount = note.linkedSymptomIds?.length || 0;
  const linkedMedsCount = note.linkedMedicationIds?.length || 0;
  const title = note.title || 'Untitled Note';

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`Note: ${title}`}
    >
      <IconTile emoji={note.icon || '📝'} color="#FFB000" />

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.4}>{title}</Text>
        <Text style={styles.snippet} numberOfLines={2} maxFontSizeMultiplier={1.4}>{snippet}</Text>

        <View style={styles.metaRow}>
          {linkedSymptomsCount > 0 && (
            <View style={[styles.metaChip, { backgroundColor: palette.error + '26' }]}>
              <Stethoscope size={12} color={palette.errorText} />
              <Text style={[styles.metaChipText, { color: palette.errorText }]}>{linkedSymptomsCount}</Text>
            </View>
          )}

          {linkedMedsCount > 0 && (
            <View style={[styles.metaChip, { backgroundColor: palette.catMeds + '26' }]}>
              <Pill size={12} color={palette.text} />
              <Text style={[styles.metaChipText, { color: palette.text }]}>{linkedMedsCount}</Text>
            </View>
          )}

          {(note.tags || []).slice(0, 2).map((t, i) => (
            <View key={i} style={[styles.metaChip, { backgroundColor: palette.surfaceAlt }]}>
              <Text style={[styles.metaChipText, { color: palette.textSecondary, fontWeight: '500' }]}>#{t}</Text>
            </View>
          ))}

          <Text style={styles.timeText} maxFontSizeMultiplier={1.3}>
            {formatTimeRelative(note.updatedAt || note.createdAt)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.pinBtn}
        onPress={handlePin}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={note.isPinned ? `Unpin ${title}` : `Pin ${title}`}
      >
        <Star
          size={20}
          color={note.isPinned ? palette.warning : palette.textSecondary}
          fill={note.isPinned ? palette.warning : 'transparent'}
          strokeWidth={note.isPinned ? 2 : 1.6}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const useStyles = createThemedStyles(palette => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  body: { flex: 1, gap: 2 },
  title: { ...typography.bodyLarge, color: palette.text },
  snippet: { ...typography.footnote, color: palette.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  metaChipText: { ...typography.footnote, fontWeight: '700' },
  timeText: { ...typography.footnote, color: palette.textSecondary, marginLeft: 'auto' },
  pinBtn: { minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
}));
