import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Star, Stethoscope, Pill, Calendar } from 'lucide-react-native';
import { INote } from '../../shared/types';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { formatTimeRelative } from '../../utils/dayBoundary';

interface NoteCardProps {
  note: INote;
  onPress: () => void;
  onTogglePin: () => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onPress,
  onTogglePin,
}) => {
  const { palette } = useTheme();

  const handlePin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTogglePin();
  };

  // Find first text content for preview snippet
  const snippet =
    note.blocks?.find((b) => b.content && b.content.trim().length > 0)?.content ||
    'Empty note...';

  const linkedSymptomsCount = note.linkedSymptomIds?.length || 0;
  const linkedMedsCount = note.linkedMedicationIds?.length || 0;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: palette.surface }]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Note: ${note.title}`}
    >
      {/* Mini Cover Gradient Banner */}
      <View style={styles.coverArea}>
        <LinearGradient
          colors={['#1E1B4B', '#312E81']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Star / Pin Button */}
        <TouchableOpacity
          style={styles.pinBtn}
          onPress={handlePin}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Star
            size={16}
            color={note.isPinned ? '#F59E0B' : 'rgba(255, 255, 255, 0.4)'}
            fill={note.isPinned ? '#F59E0B' : 'transparent'}
          />
        </TouchableOpacity>
      </View>

      {/* Body Area */}
      <View style={styles.body}>
        {/* Overlapping Icon Badge */}
        <View style={[styles.iconBadge, { backgroundColor: palette.surface }]}>
          <Text style={styles.iconEmoji}>{note.icon || '📝'}</Text>
        </View>

        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
          {note.title || 'Untitled Note'}
        </Text>

        <Text style={[styles.snippet, { color: palette.textSecondary }]} numberOfLines={2}>
          {snippet}
        </Text>

        {/* Tags and Health Links Row */}
        <View style={styles.metaRow}>
          {linkedSymptomsCount > 0 && (
            <View style={[styles.metaChip, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Stethoscope size={10} color="#EF4444" />
              <Text style={[styles.metaChipText, { color: '#EF4444' }]}>
                {linkedSymptomsCount}
              </Text>
            </View>
          )}

          {linkedMedsCount > 0 && (
            <View style={[styles.metaChip, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
              <Pill size={10} color="#A855F7" />
              <Text style={[styles.metaChipText, { color: '#A855F7' }]}>
                {linkedMedsCount}
              </Text>
            </View>
          )}

          {(note.tags || []).slice(0, 2).map((t, i) => (
            <View key={i} style={[styles.tagChip, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}>
              <Text style={[styles.tagText, { color: palette.textSecondary }]}>#{t}</Text>
            </View>
          ))}

          <Text style={[styles.timeText, { color: palette.textDisabled }]}>
            {formatTimeRelative(note.updatedAt || note.createdAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  coverArea: {
    height: 48,
    position: 'relative',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 8,
  },
  pinBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 0,
    position: 'relative',
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconEmoji: {
    fontSize: 16,
  },
  title: {
    ...typography.h3,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  snippet: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 11,
    marginLeft: 'auto',
  },
});
