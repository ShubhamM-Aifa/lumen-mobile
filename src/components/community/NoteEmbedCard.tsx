import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Check, ArrowDownToLine, FileText, Eye } from 'lucide-react-native';
import { router } from 'expo-router';
import { INoteEmbedPayload } from '../../shared/types';
import { useCommunityStore } from '../../store/communityStore';
import { useNoteStore } from '../../store/noteStore';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface NoteEmbedCardProps {
  embed: INoteEmbedPayload;
  messageId?: string;
  senderId?: string;
  isAuthor?: boolean;
}

export const NoteEmbedCard: React.FC<NoteEmbedCardProps> = ({
  embed,
  messageId,
  senderId,
  isAuthor,
}) => {
  const { palette } = useTheme();
  const { user } = useAuthStore();
  const { notes } = useNoteStore();
  const { cloneNoteToPersonal } = useCommunityStore();

  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

  // Check if current user is author of the message or note
  const isSender = Boolean(isAuthor) || (Boolean(user?._id) && Boolean(senderId) && user?._id === senderId);

  // Check if note is already in personal notes library
  const existingNote = notes.find(
    (n) =>
      (embed.noteId && n._id === embed.noteId) ||
      (n.title && embed.title && n.title.trim().toLowerCase() === embed.title.trim().toLowerCase())
  );

  const isSaved = Boolean(existingNote) || Boolean(savedNoteId);

  const handleOpenNote = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const targetId = savedNoteId || existingNote?._id || embed.noteId;
    if (targetId) {
      router.push(`/notes/${targetId}` as any);
    } else {
      router.push('/notes' as any);
    }
  };

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const createdNote = await cloneNoteToPersonal(embed, messageId);
    if (createdNote?._id) {
      setSavedNoteId(createdNote._id);
    }
    Alert.alert(
      'Note Saved!',
      `"${embed.title}" has been saved into your personal Notes & Docs library.`
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
      <TouchableOpacity
        style={styles.body}
        activeOpacity={isSender || isSaved ? 0.75 : 1}
        onPress={isSender || isSaved ? handleOpenNote : undefined}
      >
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

        {/* Context-Aware Action Button */}
        {isSender ? (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: '#38BDF8' },
            ]}
            onPress={handleOpenNote}
            activeOpacity={0.7}
          >
            <Eye size={14} color="#38BDF8" strokeWidth={2.5} />
            <Text style={[styles.actionBtnText, { color: '#38BDF8' }]}>View Note</Text>
          </TouchableOpacity>
        ) : isSaved ? (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: '#22C55E' },
            ]}
            onPress={handleOpenNote}
            activeOpacity={0.7}
          >
            <Check size={14} color="#22C55E" strokeWidth={2.5} />
            <Text style={[styles.actionBtnText, { color: '#22C55E' }]}>Saved • View Note</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: '#38BDF8' },
            ]}
            onPress={handleSave}
            activeOpacity={0.7}
          >
            <ArrowDownToLine size={14} color="#38BDF8" strokeWidth={2.5} />
            <Text style={[styles.actionBtnText, { color: '#38BDF8' }]}>Save to My Notes</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
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
