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

  return (
    <View style={styles.container}>
      {EMPATHY_EMOJIS.map(({ emoji, label }) => {
        const count = reactions[emoji] || 0;
        const hasReacted = userReactions.includes(emoji);

        return (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.reactionPill,
              hasReacted
                ? { backgroundColor: 'rgba(56, 189, 248, 0.2)', borderColor: '#38BDF8' }
                : { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderColor: 'rgba(255, 255, 255, 0.08)' },
            ]}
            onPress={() => handleReact(emoji)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`React with ${label}`}
          >
            <Text style={styles.emojiText}>{emoji}</Text>
            {count > 0 && (
              <Text
                style={[
                  styles.countText,
                  { color: hasReacted ? '#38BDF8' : palette.textSecondary },
                ]}
              >
                {count}
              </Text>
            )}
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
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1,
  },
  emojiText: {
    fontSize: 13,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
