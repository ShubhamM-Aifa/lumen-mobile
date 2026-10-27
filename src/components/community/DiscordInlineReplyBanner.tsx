import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CornerDownRight, X } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  reply: {
    messageId: string;
    senderDisplayName: string;
    snippet: string;
  };
  onDismiss: () => void;
}

export const DiscordInlineReplyBanner: React.FC<Props> = ({ reply, onDismiss }) => {
  const { palette } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: palette.surface, borderLeftColor: palette.primary }]}>
      <CornerDownRight size={14} color={palette.primaryText} style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={[styles.replyingTo, { color: palette.textSecondary }]} numberOfLines={1}>
          Replying to <Text style={{ color: palette.primaryText, fontWeight: '700' }}>@{reply.senderDisplayName}</Text>
        </Text>
        <Text style={[styles.snippet, { color: palette.textDisabled }]} numberOfLines={1}>
          "{reply.snippet}"
        </Text>
      </View>
      <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={15} color={palette.textSecondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderLeftWidth: 3,
    borderRadius: 8,
    marginBottom: 6,
    marginHorizontal: 12,
  },
  icon: {
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  replyingTo: {
    fontSize: 12,
    fontWeight: '600',
  },
  snippet: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 1,
  },
  dismissBtn: {
    padding: 4,
  },
});
