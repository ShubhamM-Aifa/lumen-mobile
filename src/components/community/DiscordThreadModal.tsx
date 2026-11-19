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
  Alert,
  Image,
} from 'react-native';
import { X, MessageSquare, Send, CornerDownRight, TriangleAlert, ImagePlus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { ContentGate } from './ContentGate';
import { useTheme } from '../../theme/ThemeContext';
import { ICommunityMessage } from '../../shared/types';
import { useCommunityStore } from '../../store/communityStore';
import { useAuthStore } from '../../store/authStore';
import { ModularAvatar } from '../avatar/ModularAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboard } from '../../hooks/useKeyboard';

interface Props {
  visible: boolean;
  parent: ICommunityMessage | null;
  replies: ICommunityMessage[];
  onClose: () => void;
  onSendReply: (
    parentMessageId: string,
    text: string,
    opts?: { contentWarning?: string; photoUri?: string; photoMimeType?: string }
  ) => Promise<void>;
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
  const insets = useSafeAreaInsets();
  const { isKeyboardVisible } = useKeyboard();
  const { user } = useAuthStore();
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [warningOn, setWarningOn] = useState(false);
  const [warningText, setWarningText] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; mimeType?: string } | null>(null);

  if (!parent) return null;

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, exif: false });
      if (!result.canceled && result.assets?.[0]) setPhoto({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType || undefined });
    } catch (err: any) {
      Alert.alert('Photo', err?.message || 'Could not open your photos');
    }
  };

  const handleSend = async () => {
    if ((!replyText.trim() && !photo) || sending) return;
    setSending(true);
    try {
      await onSendReply(parent._id, replyText.trim(), {
        contentWarning: warningOn ? warningText.trim() || undefined : undefined,
        photoUri: photo?.uri,
        photoMimeType: photo?.mimeType,
      });
      setReplyText('');
      setPhoto(null);
      setWarningOn(false);
      setWarningText('');
    } catch (err: any) {
      Alert.alert('Reply not sent', err?.message || 'Could not send reply');
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
                {!parent.isAnonymous && (parent.senderId === user?._id || parent.senderId === 'me' || (user?.name && parent.senderDisplayName === user.name)) ? (
                  <View style={{ width: 24, height: 24, borderRadius: 12, overflow: 'hidden', marginRight: 6 }}>
                    <ModularAvatar size={24} animated={false} />
                  </View>
                ) : (
                  <Text style={{ fontSize: 16, marginRight: 6 }}>
                    {parent.senderAvatarEmoji || '🥄'}
                  </Text>
                )}
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
              <ContentGate warning={parent.contentWarning}>
                <Text style={[styles.messageContent, { color: palette.text }]}>{parent.content}</Text>
                {parent.embedType === 'photo' && Boolean(parent.embedData?.photoUrl) && (
                  <Image source={{ uri: parent.embedData!.photoUrl! }} style={styles.threadPhoto} resizeMode="cover" accessibilityLabel="Attached photo" />
                )}
              </ContentGate>
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
                    {!reply.isAnonymous && (reply.senderId === user?._id || reply.senderId === 'me' || (user?.name && reply.senderDisplayName === user.name)) ? (
                      <View style={{ width: 20, height: 20, borderRadius: 10, overflow: 'hidden', marginRight: 5 }}>
                        <ModularAvatar size={20} animated={false} />
                      </View>
                    ) : (
                      <Text style={{ fontSize: 14, marginRight: 4 }}>
                        {reply.senderAvatarEmoji || '🥄'}
                      </Text>
                    )}
                    <TouchableOpacity onPress={() => onPressProfile && onPressProfile(reply.senderId)}>
                      <Text style={[styles.authorName, { color: reply.senderRoleColor || palette.text }]}>
                        {reply.senderDisplayName}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <ContentGate warning={reply.contentWarning}>
                    {Boolean(reply.content) && <Text style={[styles.replyContent, { color: palette.text }]}>{reply.content}</Text>}
                    {reply.embedType === 'photo' && Boolean(reply.embedData?.photoUrl) && (
                      <Image source={{ uri: reply.embedData!.photoUrl! }} style={styles.threadPhoto} resizeMode="cover" accessibilityLabel="Attached photo" />
                    )}
                  </ContentGate>
                </View>
              </View>
            ))}
          </ScrollView>

          {warningOn && (
            <View style={[styles.warningRow, { backgroundColor: palette.background, borderTopColor: palette.border }]}>
              <TriangleAlert size={14} color="#F59E0B" />
              <TextInput
                style={{ flex: 1, color: palette.text, paddingVertical: 4 }}
                placeholder="Content warning, e.g. flare, hospital"
                placeholderTextColor={palette.textDisabled}
                value={warningText}
                onChangeText={setWarningText}
                maxLength={60}
                accessibilityLabel="Content warning text"
              />
            </View>
          )}
          {photo && (
            <View style={[styles.warningRow, { backgroundColor: palette.background, borderTopColor: palette.border }]}>
              <Image source={{ uri: photo.uri }} style={{ width: 36, height: 36, borderRadius: 6 }} />
              <Text style={{ flex: 1, color: palette.text, fontSize: 13 }}>Photo attached</Text>
              <TouchableOpacity onPress={() => setPhoto(null)} accessibilityRole="button" accessibilityLabel="Remove photo">
                <X size={16} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Composer */}
          <View
            style={[
              styles.composerRow,
              {
                backgroundColor: palette.surface,
                borderTopColor: palette.border,
                paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom, 10),
              },
            ]}
          >
            <TouchableOpacity onPress={() => setWarningOn((v) => !v)} style={styles.iconBtn} accessibilityRole="button" accessibilityState={{ selected: warningOn }} accessibilityLabel="Add a content warning">
              <TriangleAlert size={18} color={warningOn ? '#F59E0B' : palette.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={pickPhoto} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Attach a photo">
              <ImagePlus size={18} color={photo ? palette.primaryText || palette.primary : palette.textSecondary} />
            </TouchableOpacity>
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
              disabled={(!replyText.trim() && !photo) || sending}
              style={[
                styles.sendBtn,
                { backgroundColor: replyText.trim() || photo ? palette.primary : palette.border },
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
  threadPhoto: { width: 220, height: 220, borderRadius: 10, marginTop: 8 },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
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
