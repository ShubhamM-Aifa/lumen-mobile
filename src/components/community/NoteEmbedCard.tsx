import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BookmarkPlus, Check, ArrowDownToLine, FileText } from 'lucide-react-native';
import { INoteEmbedPayload } from '../../shared/types';
import { useCommunityStore } from '../../store/communityStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface NoteEmbedCardProps {
  embed: INoteEmbedPayload;
  messageId?: string;
}

export const NoteEmbedCard: React.FC<NoteEmbedCardProps> = ({
  embed,
  messageId,
}) => {
  const { palette } = useTheme();
  const { cloneNoteToPersonal } = useCommunityStore();
  const [imported, setImported] = useState(false);

  const handleClone = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await cloneNoteToPersonal(embed, messageId);
    setImported(true);
    Alert.alert(
      'Note Saved!',
      `"${embed.title}" has been saved into your personal Notes & Docs library. Tap Notes to view or customize.`
    );
  };

  const previewSnippet =
    embed.blocksPreview && embed.blocksPreview.length > 0
      ? embed.blocksPreview.map((b) => b.content).filter(Boolean).join(' • ')
      : 'Contains structured Notion blocks and clinical takeaways.';

  return (
    <View style={[styles.card, { backgroundColor: palette.surface }]}>
      {/* Mini Cover Banner */}
      <View style={styles.banner}>
        <LinearGradient
          colors={['#1E1B4B', '#312E81']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.badge}>
          <FileText size={11} color="#38BDF8" />
          <Text style={styles.badgeText}>LUMEN NOTE</Text>
        </View>
      </View>

      {/* Body Area */}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{embed.icon || '📝'}</Text>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {embed.title}
          </Text>
        </View>

        <Text style={[styles.snippet, { color: palette.textSecondary }]} numberOfLines={2}>
          {previewSnippet}
        </Text>

        {/* Tags Row */}
        {(embed.tags || []).length > 0 && (
          <View style={styles.tagsRow}>
            {embed.tags.map((t, idx) => (
              <View key={idx} style={[styles.tag, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}>
                <Text style={[styles.tagText, { color: palette.textSecondary }]}>#{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 1-Tap Save Action Button */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            imported
              ? { backgroundColor: 'rgba(34, 197, 94, 0.2)', borderColor: '#22C55E' }
              : { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: '#38BDF8' },
          ]}
          onPress={handleClone}
          disabled={imported}
          activeOpacity={0.7}
        >
          {imported ? (
            <>
              <Check size={14} color="#22C55E" strokeWidth={2.5} />
              <Text style={[styles.actionBtnText, { color: '#22C55E' }]}>Saved to My Notes</Text>
            </>
          ) : (
            <>
              <ArrowDownToLine size={14} color="#38BDF8" strokeWidth={2.5} />
              <Text style={[styles.actionBtnText, { color: '#38BDF8' }]}>Save to My Notes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginVertical: 6,
    width: '100%',
  },
  banner: {
    height: 38,
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  body: {
    padding: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  icon: {
    fontSize: 18,
  },
  title: {
    ...typography.h3,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  snippet: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
