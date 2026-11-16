import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import {
  CornerDownRight,
  MessageSquare,
  Pin,
  Pencil,
  Trash2,
  Copy,
  ShieldAlert,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ICommunityMessage } from '../../shared/types';

interface DiscordMessageActionModalProps {
  visible: boolean;
  message: ICommunityMessage | null;
  currentUserId?: string;
  isModerator?: boolean;
  onClose: () => void;
  onReply: (message: ICommunityMessage) => void;
  onOpenThread: (message: ICommunityMessage) => void;
  onTogglePin: (message: ICommunityMessage) => void;
  onEdit: (message: ICommunityMessage) => void;
  onDelete: (message: ICommunityMessage) => void;
  onTimeoutMember?: (userId: string, displayName: string) => void;
  onReact: (messageId: string, emoji: string) => void;
}

const QUICK_REACTIONS = ['🥄', '🫂', '❤️', '💡', '🌿', '💪'];

export const DiscordMessageActionModal: React.FC<DiscordMessageActionModalProps> = ({
  visible,
  message,
  currentUserId,
  isModerator = false,
  onClose,
  onReply,
  onOpenThread,
  onTogglePin,
  onEdit,
  onDelete,
  onTimeoutMember,
  onReact,
}) => {
  const { palette } = useTheme();

  if (!message) return null;

  const isAuthor =
    Boolean(currentUserId) &&
    (message.senderId === currentUserId ||
      message.senderId === 'me' ||
      (!message.isAnonymous && message.senderDisplayName === 'You'));

  const handleCopy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (message.content) {
      await Clipboard.setStringAsync(message.content);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              {/* Header drag indicator / close */}
              <View style={styles.sheetHandle} />

              {/* Quick Reactions Bar */}
              <View style={[styles.reactionRow, { borderBottomColor: palette.border }]}>
                {QUICK_REACTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onReact(message._id, emoji);
                      onClose();
                    }}
                    style={[styles.reactionBtn, { backgroundColor: palette.surface }]}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action list */}
              <View style={styles.actionsList}>
                {/* Reply */}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                    onReply(message);
                  }}
                >
                  <CornerDownRight size={18} color={palette.text} style={styles.actionIcon} />
                  <Text style={[styles.actionLabel, { color: palette.text }]}>Reply</Text>
                </TouchableOpacity>

                {/* Thread */}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                    onOpenThread(message);
                  }}
                >
                  <MessageSquare size={18} color={palette.text} style={styles.actionIcon} />
                  <Text style={[styles.actionLabel, { color: palette.text }]}>
                    {message.threadMeta?.replyCount ? `View Thread (${message.threadMeta.replyCount})` : 'Start Thread'}
                  </Text>
                </TouchableOpacity>

                {/* Pin / Unpin */}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onClose();
                    onTogglePin(message);
                  }}
                >
                  <Pin size={18} color="#F59E0B" style={styles.actionIcon} />
                  <Text style={[styles.actionLabel, { color: palette.text }]}>
                    {message.isPinned ? 'Unpin Message' : 'Pin Message'}
                  </Text>
                </TouchableOpacity>

                {/* Copy Text */}
                {Boolean(message.content) && (
                  <TouchableOpacity style={styles.actionRow} onPress={handleCopy}>
                    <Copy size={18} color={palette.text} style={styles.actionIcon} />
                    <Text style={[styles.actionLabel, { color: palette.text }]}>Copy Text</Text>
                  </TouchableOpacity>
                )}

                {/* Edit Message (Author only) */}
                {isAuthor && (
                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                      onEdit(message);
                    }}
                  >
                    <Pencil size={18} color={palette.primaryText || palette.primary} style={styles.actionIcon} />
                    <Text style={[styles.actionLabel, { color: palette.primaryText || palette.primary }]}>
                      Edit Message
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Timeout Member (Moderator only, non-author) */}
                {isModerator && !isAuthor && onTimeoutMember && !message.isAnonymous && (
                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onClose();
                      onTimeoutMember(message.senderId, message.senderDisplayName);
                    }}
                  >
                    <ShieldAlert size={18} color="#F59E0B" style={styles.actionIcon} />
                    <Text style={[styles.actionLabel, { color: '#F59E0B' }]}>
                      Timeout Member (1 hour)
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Delete Message (Author or Moderator) */}
                {(isAuthor || isModerator) && (
                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                      onClose();
                      onDelete(message);
                    }}
                  >
                    <Trash2 size={18} color={palette.error || '#EF4444'} style={styles.actionIcon} />
                    <Text style={[styles.actionLabel, { color: palette.error || '#EF4444' }]}>
                      Delete Message
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: 32,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
    alignSelf: 'center',
    marginBottom: 12,
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 14,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reactionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: {
    fontSize: 22,
  },
  actionsList: {
    gap: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  actionIcon: {
    marginRight: 14,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});
