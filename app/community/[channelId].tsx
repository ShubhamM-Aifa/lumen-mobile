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
import { SafeAreaView } from 'react-native-safe-area-context';
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
  Info,
} from 'lucide-react-native';
import { useCommunityStore } from '../../src/store/communityStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { NoteEmbedCard } from '../../src/components/community/NoteEmbedCard';
import { TodoEmbedCard } from '../../src/components/community/TodoEmbedCard';
import { LogTemplateEmbedCard } from '../../src/components/community/LogTemplateEmbedCard';
import { EmpathyReactionBar } from '../../src/components/community/EmpathyReactionBar';
import { AttachArtifactModal } from '../../src/components/community/AttachArtifactModal';
import { formatTimeRelative } from '../../src/utils/dayBoundary';
import { CommunityEmbedType } from '../../src/shared/types';

export default function ChannelChatScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const { palette } = useTheme();

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Channel Navbar */}
        <View style={[styles.topBar, { borderBottomColor: 'rgba(255, 255, 255, 0.08)' }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color={palette.text} />
          </TouchableOpacity>

          <View style={styles.topBarInfo}>
            <View style={styles.channelTitleRow}>
              <Text style={styles.channelIcon}>{channel?.icon || '💬'}</Text>
              <Text style={[styles.channelTitle, { color: palette.text }]} numberOfLines={1}>
                #{channel?.slug || channel?.name || 'community-channel'}
              </Text>
            </View>
            <Text style={[styles.channelTopic, { color: palette.textSecondary }]} numberOfLines={1}>
              {channel?.topic || channel?.description || 'Community peer discussion'}
            </Text>
          </View>

          {/* Anonymous Spoonie Toggle in Navbar */}
          <TouchableOpacity
            style={[
              styles.anonToggleBtn,
              isAnonymous
                ? { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B' }
                : { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleAnonymous();
            }}
            accessibilityRole="button"
            accessibilityLabel="Toggle Anonymous Spoonie"
          >
            <Text style={styles.anonToggleIcon}>{isAnonymous ? '🥄' : '👤'}</Text>
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

        {/* Message Stream */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
        >
          {/* Welcome Message at top of channel */}
          <View style={[styles.channelWelcomeCard, { backgroundColor: palette.surface }]}>
            <Text style={styles.welcomeEmoji}>{channel?.icon || '💬'}</Text>
            <Text style={[styles.welcomeTitle, { color: palette.text }]}>
              Welcome to #{channel?.name || 'Channel'}!
            </Text>
            <Text style={[styles.welcomeDesc, { color: palette.textSecondary }]}>
              This is a safe, moderated chronic illness space. Feel free to share your health stories, ask questions, or attach Lumen Notes, To-Do routines, and Tracking Templates.
            </Text>
          </View>

          {isLoading && messages.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={palette.primary} />
            </View>
          ) : (
            messages.map((msg) => (
              <View key={msg._id} style={styles.messageRow}>
                {/* Avatar */}
                <View
                  style={[
                    styles.avatarWell,
                    {
                      backgroundColor: msg.isAnonymous
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(56, 189, 248, 0.15)',
                    },
                  ]}
                >
                  <Text style={styles.avatarEmoji}>{msg.senderAvatarEmoji || (msg.isAnonymous ? '🥄' : '🌟')}</Text>
                </View>

                {/* Message Body */}
                <View style={styles.messageBody}>
                  {/* Sender & Timestamp */}
                  <View style={styles.senderRow}>
                    <Text
                      style={[
                        styles.senderName,
                        { color: msg.isAnonymous ? '#F59E0B' : palette.text },
                      ]}
                    >
                      {msg.senderDisplayName}
                    </Text>
                    {msg.isAnonymous && (
                      <View style={styles.anonBadge}>
                        <Text style={styles.anonBadgeText}>ANON</Text>
                      </View>
                    )}
                    <Text style={[styles.timeText, { color: palette.textDisabled }]}>
                      {formatTimeRelative(msg.createdAt)}
                    </Text>
                  </View>

                  {/* Plain Text Content */}
                  {msg.content.length > 0 && (
                    <Text style={[styles.messageText, { color: palette.text }]}>
                      {msg.content}
                    </Text>
                  )}

                  {/* Rich Artifact Embed Cards */}
                  {msg.embedType === 'note' && msg.embedData?.note && (
                    <NoteEmbedCard embed={msg.embedData.note} messageId={msg._id} />
                  )}

                  {msg.embedType === 'todo_list' && msg.embedData?.todo && (
                    <TodoEmbedCard embed={msg.embedData.todo} messageId={msg._id} />
                  )}

                  {msg.embedType === 'log_template' && msg.embedData?.logTemplate && (
                    <LogTemplateEmbedCard embed={msg.embedData.logTemplate} messageId={msg._id} />
                  )}

                  {/* Chronic Empathy Reaction Bar */}
                  <EmpathyReactionBar
                    messageId={msg._id}
                    reactions={msg.reactions || {}}
                    userReactions={msg.userReactions || []}
                  />
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Pending Attachment Preview (Above Composer) */}
        {pendingEmbed && (
          <View style={[styles.pendingAttachmentBar, { backgroundColor: palette.surface }]}>
            <View style={styles.pendingAttachmentLeft}>
              {pendingEmbed.type === 'note' && <FileText size={15} color="#38BDF8" />}
              {pendingEmbed.type === 'todo_list' && <ListTodo size={15} color="#10B981" />}
              {pendingEmbed.type === 'log_template' && <ClipboardList size={15} color="#A855F7" />}
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

        {/* Sticky Message Composer */}
        <View style={[styles.composerContainer, { backgroundColor: palette.surface, borderTopColor: 'rgba(255, 255, 255, 0.08)' }]}>
          {/* Attach Artifact Button */}
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

          {/* Text Input */}
          <TextInput
            style={[styles.input, { color: palette.text }]}
            placeholder={
              isAnonymous
                ? 'Share story or tips as Anonymous Spoonie 🥄...'
                : 'Share your story, question, or tips...'
            }
            placeholderTextColor={palette.textDisabled}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={3000}
          />

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendBtn,
              inputText.trim().length > 0 || pendingEmbed
                ? { backgroundColor: palette.primary }
                : { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() && !pendingEmbed}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Send size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Attach Artifact Modal */}
        <AttachArtifactModal
          visible={attachModalOpen}
          onClose={() => setAttachModalOpen(false)}
          onAttach={handleAttachArtifact}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: {
    padding: 4,
  },
  topBarInfo: {
    flex: 1,
  },
  channelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  channelIcon: {
    fontSize: 16,
  },
  channelTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  channelTopic: {
    fontSize: 11,
    marginTop: 1,
  },
  anonToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  anonToggleIcon: {
    fontSize: 12,
  },
  anonToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  channelWelcomeCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  welcomeEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  welcomeDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 10,
  },
  avatarWell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
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
    gap: 6,
    marginBottom: 3,
  },
  senderName: {
    fontSize: 13,
    fontWeight: '700',
  },
  anonBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  anonBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
  },
  timeText: {
    fontSize: 11,
    marginLeft: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  pendingAttachmentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  pendingAttachmentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pendingAttachmentText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  attachBtn: {
    padding: 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    maxHeight: 100,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
