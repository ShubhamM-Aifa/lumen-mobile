import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useCommunityStore } from '../../store/communityStore';
import { useTheme } from '../../theme/ThemeContext';

interface EmpathyReactionBarProps {
  messageId: string;
  reactions: Record<string, number>;
  userReactions: string[];
}

const EMPATHY_EMOJIS = [
  { emoji: '🥄', label: 'Spoon' },
  { emoji: '🫂', label: 'Hug' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '💡', label: 'Helpful' },
  { emoji: '✨', label: 'Win' },
];

export const EmpathyReactionBar: React.FC<EmpathyReactionBarProps> = ({
  messageId,
  reactions,
  userReactions = [],
}) => {
  const { palette } = useTheme();
  const { toggleReaction } = useCommunityStore();

  const handleReact = (emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleReaction(messageId, emoji);
  };

  // Any emoji can be a reaction: the five empathy ones first (in their usual order), then the rest.
  const known = new Set(EMPATHY_EMOJIS.map((e) => e.emoji));
  const extra = Array.from(new Set([...Object.keys(reactions), ...userReactions]))
    .filter((emoji) => !known.has(emoji))
    .map((emoji) => ({ emoji, label: emoji }));
  const activeEmojis = [...EMPATHY_EMOJIS, ...extra].filter(({ emoji }) => {
    const count = reactions[emoji] || 0;
    const hasReacted = userReactions.includes(emoji);
    return count > 0 || hasReacted;
  });

  if (activeEmojis.length === 0) return null;

  return (
    <View style={styles.container}>
      {activeEmojis.map(({ emoji, label }) => {
        const count = reactions[emoji] || 0;
        const hasReacted = userReactions.includes(emoji);

        return (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.reactionPill,
              hasReacted
                ? { backgroundColor: 'rgba(88, 101, 242, 0.25)', borderColor: '#5865F2' }
                : { backgroundColor: '#2B2D31', borderColor: 'transparent' },
            ]}
            onPress={() => handleReact(emoji)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`React with ${label}, ${count} reactions`}
          >
            <Text style={styles.emojiText}>{emoji}</Text>
            <Text
              style={[
                styles.countText,
                { color: hasReacted ? '#C9CDFB' : '#949BA4' },
              ]}
            >
              {count > 0 ? count : 1}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  emojiText: {
    fontSize: 14,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
