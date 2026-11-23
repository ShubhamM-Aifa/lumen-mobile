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
  Ban,
  Languages,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ICommunityMessage } from '../../shared/types';
import { Share2 } from 'lucide-react-native';

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
  onReport?: (message: ICommunityMessage) => void;
  onTranslate?: (message: ICommunityMessage) => void;
  onBlock?: (message: ICommunityMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  /** Forward this message to other chats (direct chats and groups). */
  onForward?: (message: ICommunityMessage) => void;
  /** Opens the full emoji picker to react with any emoji. */
  onMoreReactions?: (message: ICommunityMessage) => void;
}

const QUICK_REACTIONS = ['🥄', '👍', '❤️', '💡', '✨', '💯'];

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
  onReport,
  onTranslate,
  onBlock,
  onReact,
  onMoreReactions,
  onForward,
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
            <View style={styles.sheet}>
              {/* Header drag indicator */}
              <View style={styles.sheetHandle} />

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Quick Reactions Bar (Matching Discord Mobile Screenshot 2) */}
                <View style={styles.reactionSection}>
                  <View style={styles.reactionRow}>
                    {QUICK_REACTIONS.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          onReact(message._id, emoji);
                          onClose();
                        }}
                        style={styles.reactionBtn}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                    {onMoreReactions ? (
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onMoreReactions(message);
                          onClose();
                        }}
                        style={styles.reactionBtn}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="More reactions"
                      >
                        <Text style={styles.reactionEmoji}>➕</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text style={styles.quickReactHint}>Double tap a message to ❤️ React</Text>
                </View>

                {/* Card Block 1: Primary actions */}
                <View style={styles.actionCard}>
                  {isAuthor && (
                    <>
                      <TouchableOpacity
                        style={styles.actionRow}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onClose();
                          onEdit(message);
                        }}
                      >
                        <Pencil size={18} color="#FFFFFF" style={styles.actionIcon} />
                        <Text style={styles.actionLabel}>Edit Message</Text>
                      </TouchableOpacity>
                      <View style={styles.actionDivider} />
                    </>
                  )}

                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                      onReply(message);
                    }}
                  >
                    <CornerDownRight size={18} color="#FFFFFF" style={styles.actionIcon} />
                    <Text style={styles.actionLabel}>Reply</Text>
                  </TouchableOpacity>

                  {onForward && !message.isSystem ? (
                    <>
                      <View style={styles.actionDivider} />
                      <TouchableOpacity
                        style={styles.actionRow}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onClose();
                          onForward(message);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Forward message"
                      >
                        <Share2 size={18} color="#FFFFFF" style={styles.actionIcon} />
                        <Text style={styles.actionLabel}>Forward</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}

                  <View style={styles.actionDivider} />

                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                      onOpenThread(message);
                    }}
                  >
                    <MessageSquare size={18} color="#FFFFFF" style={styles.actionIcon} />
                    <Text style={styles.actionLabel}>
                      {message.threadMeta?.replyCount ? `View Thread (${message.threadMeta.replyCount})` : 'Start Thread'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Card Block 2: Secondary utilities */}
                <View style={styles.actionCard}>
                  {Boolean(message.content) && (
                    <>
                      <TouchableOpacity style={styles.actionRow} onPress={handleCopy}>
                        <Copy size={18} color="#FFFFFF" style={styles.actionIcon} />
                        <Text style={styles.actionLabel}>Copy Text</Text>
                      </TouchableOpacity>
                      <View style={styles.actionDivider} />
                    </>
                  )}

                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onClose();
                      onTogglePin(message);
                    }}
                  >
                    <Pin size={18} color="#FFFFFF" style={styles.actionIcon} />
                    <Text style={styles.actionLabel}>
                      {message.isPinned ? 'Unpin Message' : 'Pin Message'}
                    </Text>
                  </TouchableOpacity>

                  {Boolean(message.content) && onTranslate && (
                    <>
                      <View style={styles.actionDivider} />
                      <TouchableOpacity
                        style={styles.actionRow}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onClose();
                          onTranslate(message);
                        }}
                      >
                        <Languages size={18} color="#FFFFFF" style={styles.actionIcon} />
                        <Text style={styles.actionLabel}>Translate (Lumen AI)</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {!isAuthor && onReport && (
                    <>
                      <View style={styles.actionDivider} />
                      <TouchableOpacity
                        style={styles.actionRow}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onClose();
                          onReport(message);
                        }}
                      >
                        <ShieldAlert size={18} color="#FFFFFF" style={styles.actionIcon} />
                        <Text style={styles.actionLabel}>Report Message</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {!isAuthor && onBlock && (
                    <>
                      <View style={styles.actionDivider} />
                      <TouchableOpacity
                        style={styles.actionRow}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onClose();
                          onBlock(message);
                        }}
                      >
                        <Ban size={18} color="#FFFFFF" style={styles.actionIcon} />
                        <Text style={styles.actionLabel}>Block Author</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {isModerator && !isAuthor && onTimeoutMember && !message.isAnonymous && (
                    <>
                      <View style={styles.actionDivider} />
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
                    </>
                  )}
                </View>

                {/* Card Block 3: Destructive Delete */}
                {(isAuthor || isModerator) && (
                  <View style={styles.actionCard}>
                    <TouchableOpacity
                      style={styles.actionRow}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        onClose();
                        onDelete(message);
                      }}
                    >
                      <Trash2 size={18} color="#F23F43" style={styles.actionIcon} />
                      <Text style={[styles.actionLabel, { color: '#F23F43' }]}>
                        Delete Message
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1E1F22',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: 24,
    paddingHorizontal: 16,
    maxHeight: '82%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4E5058',
    alignSelf: 'center',
    marginBottom: 14,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 16,
  },
  reactionSection: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  reactionBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2B2D31',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: {
    fontSize: 22,
  },
  quickReactHint: {
    fontSize: 12,
    color: '#949BA4',
    textAlign: 'center',
  },
  actionCard: {
    backgroundColor: '#2B2D31',
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionIcon: {
    marginRight: 14,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1E1F22',
    marginLeft: 48,
  },
});
