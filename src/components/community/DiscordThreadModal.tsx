import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, MessageSquare, Send, CornerDownRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ICommunityMessage } from '../../shared/types';
import { useCommunityStore } from '../../store/communityStore';

interface Props {
  visible: boolean;
  parent: ICommunityMessage | null;
  replies: ICommunityMessage[];
  onClose: () => void;
  onSendReply: (parentMessageId: string, text: string) => Promise<void>;
  onPressProfile?: (userId: string) => void;
}

export const DiscordThreadModal: React.FC<Props> = ({
  visible,
  parent,
  replies,
  onClose,
  onSendReply,
  onPressProfile,
}) => {
  const { palette } = useTheme();
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  if (!parent) return null;

  const handleSend = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      await onSendReply(parent._id, replyText.trim());
      setReplyText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.container, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <View style={styles.headerLeft}>
              <MessageSquare size={16} color={palette.primaryText} style={{ marginRight: 6 }} />
              <Text style={[styles.headerTitle, { color: palette.text }]}>Thread Discussion</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Conversation Feed */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={{ padding: 14 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Parent Message Card */}
            <View style={[styles.parentCard, { backgroundColor: palette.background, borderLeftColor: palette.primary }]}>
              <View style={styles.authorRow}>
                <Text style={{ fontSize: 16, marginRight: 6 }}>
                  {parent.senderAvatarEmoji || '🥄'}
                </Text>
                <TouchableOpacity onPress={() => onPressProfile && onPressProfile(parent.senderId)}>
                  <Text style={[styles.authorName, { color: parent.senderRoleColor || palette.text }]}>
                    {parent.senderDisplayName}
                  </Text>
                </TouchableOpacity>
                {parent.senderRoleBadges?.[0] && (
                  <View style={[styles.badge, { backgroundColor: `${palette.primary}20` }]}>
                    <Text style={[styles.badgeText, { color: palette.primaryText }]}>
                      {parent.senderRoleBadges[0]}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.messageContent, { color: palette.text }]}>{parent.content}</Text>
            </View>

            <View style={styles.replyDivider}>
              <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
              <Text style={[styles.dividerText, { color: palette.textDisabled }]}>
                {replies.length} {replies.length === 1 ? 'REPLY' : 'REPLIES'}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
            </View>

            {/* Replies List */}
            {replies.map((reply) => (
              <View key={reply._id} style={styles.replyRow}>
                <CornerDownRight size={13} color={palette.textDisabled} style={styles.threadCurve} />
                <View style={[styles.replyBubble, { backgroundColor: palette.background }]}>
                  <View style={styles.authorRow}>
                    <Text style={{ fontSize: 14, marginRight: 4 }}>
                      {reply.senderAvatarEmoji || '🥄'}
                    </Text>
                    <TouchableOpacity onPress={() => onPressProfile && onPressProfile(reply.senderId)}>
                      <Text style={[styles.authorName, { color: reply.senderRoleColor || palette.text }]}>
                        {reply.senderDisplayName}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.replyContent, { color: palette.text }]}>{reply.content}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Composer */}
          <View style={[styles.composerRow, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
            <TextInput
              style={[
                styles.composerInput,
                { color: palette.text, backgroundColor: palette.background, borderColor: palette.border },
              ]}
              placeholder={`Reply to @${parent.senderDisplayName}...`}
              placeholderTextColor={palette.textDisabled}
              value={replyText}
              onChangeText={setReplyText}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!replyText.trim() || sending}
              style={[
                styles.sendBtn,
                { backgroundColor: replyText.trim() ? palette.primary : palette.border },
              ]}
            >
              <Send size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  scrollArea: {
    flex: 1,
  },
  parentCard: {
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    marginBottom: 14,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  authorName: {
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  replyDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginHorizontal: 10,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  threadCurve: {
    marginTop: 10,
    marginRight: 6,
  },
  replyBubble: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
  },
  replyContent: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 13,
    marginRight: 8,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
