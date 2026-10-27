import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Paperclip,
  Send,
  X,
  FileText,
  ListTodo,
  ClipboardList,
  ShieldAlert,
  MessageSquare,
  CornerDownRight,
  Bookmark,
} from 'lucide-react-native';
import { useCommunityStore } from '../../src/store/communityStore';
import { useAuthStore } from '../../src/store/authStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { NoteEmbedCard } from '../../src/components/community/NoteEmbedCard';
import { TodoEmbedCard } from '../../src/components/community/TodoEmbedCard';
import { LogTemplateEmbedCard } from '../../src/components/community/LogTemplateEmbedCard';
import { EmpathyReactionBar } from '../../src/components/community/EmpathyReactionBar';
import { AttachArtifactModal } from '../../src/components/community/AttachArtifactModal';
import { DiscordInlineReplyBanner } from '../../src/components/community/DiscordInlineReplyBanner';
import { DiscordProfilePopoutModal } from '../../src/components/community/DiscordProfilePopoutModal';
import { DiscordThreadModal } from '../../src/components/community/DiscordThreadModal';
import { DiscordForumView } from '../../src/components/community/DiscordForumView';
import { formatTimeRelative } from '../../src/utils/dayBoundary';
import { CommunityEmbedType, ICommunityMessage, IForumPost } from '../../src/shared/types';
import { useKeyboard } from '../../src/hooks/useKeyboard';

export default function ChannelChatScreen() {
  const insets = useSafeAreaInsets();
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const { palette } = useTheme();
  const { user } = useAuthStore();
  const { isKeyboardVisible } = useKeyboard();

  const {
    channels,
    activeChannel,
    messages,
    fetchChannels,
    fetchMessages,
    sendMessage,
    isAnonymous,
    toggleAnonymous,
    isLoading,
    replyingTo,
    setReplyingTo,
    popoutUser,
    fetchUserPopout,
    clearUserPopout,
    activeThreadParent,
    activeThreadReplies,
    openThread,
    closeThread,
    sendThreadReply,
    forumPosts,
  } = useCommunityStore();

  const [inputText, setInputText] = useState('');
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [pendingEmbed, setPendingEmbed] = useState<{
    type: CommunityEmbedType;
    data: any;
  } | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  // Find channel metadata
  const channel =
    activeChannel?._id === channelId || activeChannel?.slug === channelId
      ? activeChannel
      : channels.find((c) => c._id === channelId || c.slug === channelId);

  useEffect(() => {
    if (channels.length === 0) {
      fetchChannels();
    }
  }, [channels.length, fetchChannels]);

  useEffect(() => {
    if (channelId) {
      fetchMessages(channelId);
    }
  }, [channelId, fetchMessages]);

  const handleSend = async () => {
    if (!inputText.trim() && !pendingEmbed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const content = inputText.trim();
    const embedType = pendingEmbed?.type;
    const embedData = pendingEmbed?.data;

    setInputText('');
    setPendingEmbed(null);

    await sendMessage(channelId, content, embedType, embedData);

    // Auto-scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleAttachArtifact = (type: CommunityEmbedType, data: any) => {
    setPendingEmbed({ type, data });
  };

  const handleOpenProfile = async (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchUserPopout(userId);
  };

  const handleReplyMessage = (msg: ICommunityMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReplyingTo({
      messageId: msg._id,
      senderDisplayName: msg.senderDisplayName,
      snippet: msg.content || 'Shared an artifact',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Channel Header */}
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color={palette.text} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <View style={styles.channelNameRow}>
              <Text style={{ fontSize: 16, marginRight: 4 }}>
                {channel?.icon || (channel?.type === 'forum' ? '🏷️' : '💬')}
              </Text>
              <Text style={[styles.channelTitle, { color: palette.text }]} numberOfLines={1}>
                #{channel?.slug || channel?.name || 'Channel'}
              </Text>
              {channel?.type === 'forum' && (
                <View style={[styles.typeBadge, { backgroundColor: `${palette.primary}25` }]}>
                  <Text style={[styles.typeBadgeText, { color: palette.primaryText }]}>Forum</Text>
                </View>
              )}
            </View>
            <Text style={[styles.channelTopic, { color: palette.textSecondary }]} numberOfLines={1}>
              {channel?.topic || channel?.description}
            </Text>
          </View>

          {/* Anonymous Spoonie Toggle */}
          <TouchableOpacity
            style={[
              styles.anonToggle,
              {
                backgroundColor: isAnonymous ? 'rgba(245, 158, 11, 0.2)' : palette.surface,
                borderColor: isAnonymous ? '#F59E0B' : palette.border,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleAnonymous();
            }}
            accessibilityRole="button"
            accessibilityLabel="Toggle anonymous spoonie mode"
          >
            <Text style={styles.anonToggleEmoji}>{isAnonymous ? '🥄' : '👤'}</Text>
            <Text
              style={[
                styles.anonToggleText,
                { color: isAnonymous ? '#F59E0B' : palette.textSecondary },
              ]}
            >
              {isAnonymous ? 'Anon' : 'Public'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Discord Forum Channel Mode vs Discord Text Chat Mode */}
        {channel?.type === 'forum' ? (
          <DiscordForumView
            channel={channel}
            posts={forumPosts}
            onSelectPost={(post) => {
              // Open post as thread
              openThread({
                _id: post._id,
                channelId: post.channelId,
                senderId: post.author.senderId,
                senderDisplayName: post.author.senderDisplayName,
                senderAvatarEmoji: post.author.senderAvatarEmoji,
                senderRoleColor: post.author.senderRoleColor,
                senderRoleBadges: post.author.senderRoleBadges,
                isAnonymous: post.author.isAnonymous,
                content: `${post.title}\n\n${post.content}`,
                reactions: { spoon: post.stats.spoonsCount },
                cloneCount: post.stats.cloneCount,
                createdAt: post.createdAt,
                updatedAt: post.updatedAt,
              });
            }}
          />
        ) : (
          <>
            {/* Text Message Stream */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
            >
              {/* Channel Welcome Banner */}
              <View style={[styles.channelWelcomeCard, { backgroundColor: palette.surface }]}>
                <Text style={styles.welcomeEmoji}>{channel?.icon || '💬'}</Text>
                <Text style={[styles.welcomeTitle, { color: palette.text }]}>
                  Welcome to #{channel?.name || 'Channel'}!
                </Text>
                <Text style={[styles.welcomeDesc, { color: palette.textSecondary }]}>
                  This is a safe, moderated chronic illness space. Share your stories, ask questions, or exchange Lumen Notes, To-Do routines, and Tracking Templates.
                </Text>
              </View>

              {isLoading && messages.length === 0 ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={palette.primaryText} />
                </View>
              ) : (
                messages.map((msg) => (
                  <View key={msg._id} style={styles.messageRow}>
                    {/* Inline Reply Header Banner if this message is replying to another */}
                    {msg.replyTo && (
                      <View style={styles.replyHeaderRow}>
                        <CornerDownRight size={12} color={palette.textDisabled} style={{ marginRight: 4 }} />
                        <Text style={[styles.replyHeaderUser, { color: palette.primaryText }]}>
                          @{msg.replyTo.senderDisplayName}
                        </Text>
                        <Text style={[styles.replyHeaderSnippet, { color: palette.textDisabled }]} numberOfLines={1}>
                          "{msg.replyTo.snippet}"
                        </Text>
                      </View>
                    )}

                    <View style={styles.messageMainRow}>
                      {/* Avatar with tap to open profile popout */}
                      <TouchableOpacity
                        onPress={() => !msg.isAnonymous && handleOpenProfile(msg.senderId)}
                        style={[
                          styles.avatarWell,
                          {
                            backgroundColor: msg.isAnonymous
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(56, 189, 248, 0.15)',
                          },
                        ]}
                      >
                        <Text style={styles.avatarEmoji}>
                          {msg.senderAvatarEmoji || (msg.isAnonymous ? '🥄' : '🌟')}
                        </Text>
                      </TouchableOpacity>

                      {/* Message Body */}
                      <View style={styles.messageBody}>
                        {/* Sender & Badges & Timestamp */}
                        <View style={styles.senderRow}>
                          <TouchableOpacity
                            onPress={() => !msg.isAnonymous && handleOpenProfile(msg.senderId)}
                          >
                            <Text
                              style={[
                                styles.senderName,
                                {
                                  color: msg.isAnonymous
                                    ? '#F59E0B'
                                    : msg.senderRoleColor || palette.text,
                                },
                              ]}
                            >
                              {msg.senderDisplayName}
                            </Text>
                          </TouchableOpacity>

                          {msg.isAnonymous ? (
                            <View style={styles.anonBadge}>
                              <Text style={styles.anonBadgeText}>ANON</Text>
                            </View>
                          ) : (
                            msg.senderRoleBadges?.[0] && (
                              <View
                                style={[
                                  styles.roleBadge,
                                  { backgroundColor: `${msg.senderRoleColor || palette.primary}20` },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.roleBadgeText,
                                    { color: msg.senderRoleColor || palette.primary },
                                  ]}
                                >
                                  {msg.senderRoleBadges[0]}
                                </Text>
                              </View>
                            )
                          )}

                          <Text style={[styles.timeText, { color: palette.textDisabled }]}>
                            {formatTimeRelative(msg.createdAt)}
                          </Text>
                        </View>

                        {/* Plain Text Content with Long-Press to Reply */}
                        {msg.content.length > 0 && (
                          <TouchableOpacity
                            onLongPress={() => handleReplyMessage(msg)}
                            activeOpacity={0.9}
                          >
                            <Text style={[styles.messageText, { color: palette.text }]}>
                              {msg.content}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Discord Left-Accent Rich Embed Cards */}
                        {msg.embedType === 'note' && msg.embedData?.note && (
                          <NoteEmbedCard
                            embed={msg.embedData.note}
                            messageId={msg._id}
                            senderId={msg.senderId}
                            isAuthor={Boolean(user?._id) && msg.senderId === user?._id}
                          />
                        )}

                        {msg.embedType === 'todo_list' && msg.embedData?.todo && (
                          <TodoEmbedCard
                            embed={msg.embedData.todo}
                            messageId={msg._id}
                            senderId={msg.senderId}
                            isAuthor={Boolean(user?._id) && msg.senderId === user?._id}
                          />
                        )}

                        {msg.embedType === 'log_template' && msg.embedData?.logTemplate && (
                          <LogTemplateEmbedCard
                            embed={msg.embedData.logTemplate}
                            messageId={msg._id}
                            senderId={msg.senderId}
                            isAuthor={Boolean(user?._id) && msg.senderId === user?._id}
                          />
                        )}

                        {/* Footer: Empathy Reactions & Reply / Thread Buttons */}
                        <View style={styles.footerRow}>
                          <EmpathyReactionBar
                            messageId={msg._id}
                            reactions={msg.reactions || {}}
                            userReactions={msg.userReactions || []}
                          />

                          <View style={styles.msgActionsRight}>
                            <TouchableOpacity
                              onPress={() => handleReplyMessage(msg)}
                              style={styles.replyIconBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <CornerDownRight size={14} color={palette.textDisabled} />
                              <Text style={[styles.actionBtnLabel, { color: palette.textDisabled }]}>
                                Reply
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => openThread(msg)}
                              style={styles.threadIconBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <MessageSquare size={14} color={palette.primaryText} />
                              <Text style={[styles.threadBtnLabel, { color: palette.primaryText }]}>
                                {msg.threadMeta?.replyCount ? `${msg.threadMeta.replyCount} replies` : 'Thread'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Pending Attachment Preview */}
            {pendingEmbed && (
              <View style={[styles.pendingAttachmentBar, { backgroundColor: palette.surface }]}>
                <View style={styles.pendingAttachmentLeft}>
                  {pendingEmbed.type === 'note' && <FileText size={15} color="#A855F7" />}
                  {pendingEmbed.type === 'todo_list' && <ListTodo size={15} color="#10B981" />}
                  {pendingEmbed.type === 'log_template' && <ClipboardList size={15} color="#F97316" />}
                  <Text style={[styles.pendingAttachmentText, { color: palette.text }]} numberOfLines={1}>
                    Attached:{' '}
                    {pendingEmbed.type === 'note'
                      ? pendingEmbed.data.note?.title
                      : pendingEmbed.type === 'todo_list'
                      ? pendingEmbed.data.todo?.listName
                      : 'Tracking Template'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setPendingEmbed(null)}>
                  <X size={16} color={palette.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Inline Reply Banner (Above Composer) */}
            {replyingTo && (
              <DiscordInlineReplyBanner
                reply={replyingTo}
                onDismiss={() => setReplyingTo(null)}
              />
            )}

            {/* Composer Row */}
            <View
              style={[
                styles.composerContainer,
                {
                  backgroundColor: palette.surface,
                  borderTopColor: palette.border,
                  paddingBottom: isKeyboardVisible
                    ? (Platform.OS === 'ios' ? 8 : 6)
                    : (Platform.OS === 'android' ? Math.max(insets.bottom, 24) : Math.max(insets.bottom, 12)),
                },
              ]}
            >
              <TouchableOpacity
                style={styles.attachBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setAttachModalOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Attach Lumen Note or Routine"
              >
                <Paperclip size={20} color={palette.textSecondary} />
              </TouchableOpacity>

              <TextInput
                style={[styles.input, { color: palette.text }]}
                placeholder={
                  isAnonymous
                    ? 'Message as Anonymous Spoonie 🥄...'
                    : `Message #${channel?.slug || channel?.name || 'chat'}...`
                }
                placeholderTextColor={palette.textDisabled}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={3000}
              />

              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor:
                      inputText.trim().length > 0 || pendingEmbed ? palette.primary : palette.border,
                  },
                ]}
                onPress={handleSend}
                disabled={inputText.trim().length === 0 && !pendingEmbed}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <Send size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      {/* Attach Artifact Modal */}
      <AttachArtifactModal
        visible={attachModalOpen}
        onClose={() => setAttachModalOpen(false)}
        onAttach={handleAttachArtifact}
      />

      {/* Discord Profile Popout Modal */}
      <DiscordProfilePopoutModal
        visible={Boolean(popoutUser)}
        user={popoutUser}
        onClose={clearUserPopout}
        onMention={(name) => setInputText((prev) => `@${name} ${prev}`)}
      />

      {/* Discord Thread Modal */}
      <DiscordThreadModal
        visible={Boolean(activeThreadParent)}
        parent={activeThreadParent}
        replies={activeThreadReplies}
        onClose={closeThread}
        onSendReply={sendThreadReply}
        onPressProfile={handleOpenProfile}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  headerTitleBox: {
    flex: 1,
  },
  channelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  channelTopic: {
    fontSize: 11,
    marginTop: 1,
  },
  anonToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  anonToggleEmoji: {
    fontSize: 13,
    marginRight: 4,
  },
  anonToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
  },
  channelWelcomeCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  welcomeEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  welcomeDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
  },
  messageRow: {
    marginBottom: 16,
  },
  replyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 42,
    marginBottom: 3,
  },
  replyHeaderUser: {
    fontSize: 11,
    fontWeight: '700',
    marginRight: 6,
  },
  replyHeaderSnippet: {
    fontSize: 11,
    fontStyle: 'italic',
    flex: 1,
  },
  messageMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarWell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarEmoji: {
    fontSize: 18,
  },
  messageBody: {
    flex: 1,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 3,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '700',
  },
  anonBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  anonBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 10,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
    marginBottom: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  msgActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  actionBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  threadIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  threadBtnLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  pendingAttachmentBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    marginHorizontal: 12,
  },
  pendingAttachmentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pendingAttachmentText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
