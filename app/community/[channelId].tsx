import React, { useEffect, useState, useRef, useMemo } from 'react';
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
  Alert,
  Image,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadMedia } from '../../src/services/mediaUpload';
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
  Pin,
  Mic,
  Search,
  Check,
  Pencil,
  ImagePlus,
  TriangleAlert,
  Timer,
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
import { DiscordMarkdownText } from '../../src/components/community/DiscordMarkdownText';
import { DiscordPinnedMessagesModal } from '../../src/components/community/DiscordPinnedMessagesModal';
import { DiscordMessageActionModal } from '../../src/components/community/DiscordMessageActionModal';
import { VoiceNoteRecorder } from '../../src/components/community/VoiceNoteRecorder';
import { VoiceNotePlayer } from '../../src/components/community/VoiceNotePlayer';
import { communitySocket } from '../../src/services/communitySocket';
import { formatTimeRelative } from '../../src/utils/dayBoundary';
import { CommunityEmbedType, ICommunityMessage, IForumPost } from '../../src/shared/types';
import { useKeyboard } from '../../src/hooks/useKeyboard';
import { ModularAvatar } from '../../src/components/avatar/ModularAvatar';
import { safeGoBack } from '../../src/utils/navigation';

export default function ChannelChatScreen() {
  const insets = useSafeAreaInsets();
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const { palette } = useTheme();
  const { user } = useAuthStore();
  const { isKeyboardVisible } = useKeyboard();

  const {
    channels,
    activeChannel,
    activeServer,
    messages,
    fetchChannels,
    fetchMessages,
    fetchOlderMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    togglePinMessage,
    fetchPinnedMessages,
    pinnedMessages,
    markChannelAsRead,
    fetchReadState,
    readStates,
    typingUsers,
    timeoutMember,
    createOrGetDm,
    toggleReaction,
    setupSocketListeners,
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
    blockAuthorOf,
    reportMessage,
    fetchBlocks,
    setSlowMode,
    respondToDmRequest,
    translateMessage,
  } = useCommunityStore();

  const [inputText, setInputText] = useState('');
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [pendingEmbed, setPendingEmbed] = useState<{
    type: CommunityEmbedType;
    data: any;
  } | null>(null);

  // Discord Phase 1-4 State
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<'all' | 'notes' | 'todos' | 'voice' | 'me'>('all');
  const [pinnedModalOpen, setPinnedModalOpen] = useState(false);
  const [actionModalMessage, setActionModalMessage] = useState<ICommunityMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ICommunityMessage | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isSendingPhoto, setIsSendingPhoto] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [warningOn, setWarningOn] = useState(false);
  const [warningText, setWarningText] = useState('');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const nearBottomRef = useRef(true);
  const [dividerAfterId, setDividerAfterId] = useState<string | undefined>();
  const [readStateLoaded, setReadStateLoaded] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [noMoreOlder, setNoMoreOlder] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Find channel metadata
  const channel =
    activeChannel?._id === channelId || activeChannel?.slug === channelId
      ? activeChannel
      : channels.find((c) => c._id === channelId || c.slug === channelId);

  // Real-time Socket & Initial Data
  useEffect(() => {
    if (channels.length === 0) {
      fetchChannels();
    }
  }, [channels.length, fetchChannels]);

  useEffect(() => {
    if (channelId) {
      fetchMessages(channelId);
      fetchPinnedMessages(channelId);
      // Remember where the member stopped reading before we mark the channel as read.
      setReadStateLoaded(false);
      setNoMoreOlder(false);
      setDividerAfterId(undefined);
      nearBottomRef.current = true;
      fetchBlocks();
      fetchReadState(channelId).then((id) => {
        setDividerAfterId(id);
        setReadStateLoaded(true);
      });
      communitySocket.joinChannel(channelId);
    }
    const unsub = setupSocketListeners();
    return () => {
      if (channelId) communitySocket.leaveChannel(channelId);
      unsub();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [channelId]);

  // Mark channel as read when messages load
  useEffect(() => {
    if (channelId && readStateLoaded && messages.length > 0) {
      const newest = messages[messages.length - 1];
      if (newest?._id && !newest._id.startsWith('temp_')) {
        markChannelAsRead(channelId, newest._id);
      }
    }
  }, [channelId, messages.length, readStateLoaded]);

  // Handle live typing in composer
  const handleTextChange = (text: string) => {
    setInputText(text);

    // Send typing indicators
    if (channelId) {
      communitySocket.sendTypingStart(
        channelId,
        isAnonymous ? 'Anonymous Spoonie' : user?.name || 'Someone'
      );
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        communitySocket.sendTypingStop(channelId);
      }, 1500);
    }

    // Mention autocomplete trigger
    const match = text.match(/@([a-zA-Z0-9_\u00C0-\u017F-]*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const channelPins = (channelId && pinnedMessages[channelId]) || [];
  const currentTyping = (channel && typingUsers[channel._id]) || (channelId && typingUsers[channelId]) || [];
  const lastReadId = dividerAfterId;

  const handleLoadOlder = async () => {
    if (!channelId || loadingOlder) return;
    setLoadingOlder(true);
    nearBottomRef.current = false; // keep the view where it is while older messages are added on top
    const added = await fetchOlderMessages(channelId);
    if (added === 0) setNoMoreOlder(true);
    setLoadingOlder(false);
  };

  // Extract distinct member names for @mention suggestions
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const names = new Set<string>();
    messages.forEach((m) => {
      if (!m.isAnonymous && m.senderDisplayName) {
        names.add(m.senderDisplayName);
      }
    });
    const list = Array.from(names);
    if (!mentionQuery) return list.slice(0, 5);
    return list
      .filter((n) => n.toLowerCase().includes(mentionQuery.toLowerCase()))
      .slice(0, 5);
  }, [messages, mentionQuery]);

  const handleSelectMention = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = inputText.replace(/@([a-zA-Z0-9_\u00C0-\u017F-]*)$/, `@${name} `);
    setInputText(next);
    setMentionQuery(null);
  };

  // Filter messages for In-Channel Search
  const displayedMessages = useMemo(() => {
    if (!isSearching && !searchQuery) return messages;

    return messages.filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesText =
        !q ||
        m.content.toLowerCase().includes(q) ||
        m.senderDisplayName.toLowerCase().includes(q) ||
        m.embedData?.note?.title?.toLowerCase().includes(q) ||
        m.embedData?.todo?.listName?.toLowerCase().includes(q);

      if (!matchesText) return false;

      if (searchFilter === 'notes') return m.embedType === 'note';
      if (searchFilter === 'todos') return m.embedType === 'todo_list';
      if (searchFilter === 'voice') return Boolean(m.audioUrl);
      if (searchFilter === 'me') {
        return m.senderId === user?._id || m.senderId === 'me';
      }
      return true;
    });
  }, [messages, isSearching, searchQuery, searchFilter, user?._id]);

  const handleSend = async () => {
    if (!inputText.trim() && !pendingEmbed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (channelId) communitySocket.sendTypingStop(channelId);

    // Edit message mode
    if (editingMessage) {
      const editedContent = inputText.trim();
      const msgId = editingMessage._id;
      setEditingMessage(null);
      setInputText('');
      try {
        await editMessage(channelId, msgId, editedContent);
      } catch (err: any) {
        Alert.alert('Edit Failed', err.message || 'Could not edit message');
      }
      return;
    }

    const content = inputText.trim();
    const embedType = pendingEmbed?.type;
    const embedData = pendingEmbed?.data;

    setInputText('');
    setPendingEmbed(null);
    setMentionQuery(null);

    try {
      await sendMessage(channelId, content, embedType, embedData, undefined, undefined, undefined, undefined, warningOn ? warningText.trim() || undefined : undefined);
      setWarningOn(false);
      setWarningText('');
    } catch (err: any) {
      Alert.alert('Message Blocked', err.message || 'Could not send message');
    }

    // Auto-scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSendVoice = async (audioUrl: string, durationSeconds: number, audioMediaId?: string) => {
    setIsRecordingVoice(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await sendMessage(channelId, '', undefined, undefined, audioUrl, durationSeconds, undefined, audioMediaId);
    } catch (err: any) {
      Alert.alert('Voice note not sent', err.message || 'Could not send voice note');
    }

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handlePickPhoto = async () => {
    if (isSendingPhoto) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        exif: false, // never share location or camera details
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setIsSendingPhoto(true);
      const up = await uploadMedia(asset.uri, asset.mimeType || 'image/jpeg');
      const caption = inputText.trim();
      setInputText('');
      await sendMessage(channelId, '', 'photo', { photoMediaId: up.mediaId, photoUrl: asset.uri, caption: caption || undefined });
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      Alert.alert('Photo not sent', err?.message || 'Could not send the photo. Please try again.');
    } finally {
      setIsSendingPhoto(false);
    }
  };

  const isStaff = Boolean(
    channel?.serverId &&
      activeServer &&
      activeServer._id === channel.serverId &&
      user?._id &&
      (activeServer.ownerId === user._id || activeServer.modIds?.includes(user._id)),
  );

  const handleSlowMode = () => {
    if (!channel) return;
    const set = (seconds: number) =>
      setSlowMode(channel._id, seconds).catch((err: any) => Alert.alert('Could not change slow mode', err?.message || 'Please try again.'));
    Alert.alert('Slow mode', 'How long should members wait between messages? Moderators are not limited.', [
      { text: 'Off', onPress: () => set(0) },
      { text: '10 seconds', onPress: () => set(10) },
      { text: '1 minute', onPress: () => set(60) },
      { text: '10 minutes', onPress: () => set(600) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleTranslate = (msg: ICommunityMessage) => {
    const run = async (target: 'english' | 'hinglish') => {
      try {
        const text = await translateMessage(msg._id, target);
        setTranslations((prev) => ({ ...prev, [msg._id]: text }));
      } catch (err: any) {
        Alert.alert('Could not translate', err?.message || 'Please try again.');
      }
    };
    Alert.alert('Translate with Lumen AI', 'The message text is sent to the AI model you chose in Lumen AI.', [
      { text: 'To English', onPress: () => run('english') },
      { text: 'To Hinglish', onPress: () => run('hinglish') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const dmPendingForMe =
    channel?.type === 'dm' && channel.dmStatus === 'pending' && Boolean(user?._id) && channel.dmInitiatorId !== user?._id;
  const dmPendingByMe =
    channel?.type === 'dm' && channel.dmStatus === 'pending' && channel.dmInitiatorId === user?._id;

  const handleDmAnswer = async (action: 'accept' | 'decline') => {
    if (!channel) return;
    try {
      await respondToDmRequest(channel._id, action);
      if (action === 'decline') safeGoBack('/community');
    } catch (err: any) {
      Alert.alert('Could not answer', err?.message || 'Please try again.');
    }
  };

  const handleReport = (msg: ICommunityMessage) => {
    const send = async (reason: 'spam' | 'harassment' | 'harmful_advice' | 'other') => {
      try {
        await reportMessage(msg._id, reason);
        Alert.alert('Thank you', 'The moderators of this community have been told.');
      } catch (err: any) {
        Alert.alert('Could not report', err?.message || 'Please try again.');
      }
    };
    Alert.alert('Report this message', 'Why are you reporting it?', [
      { text: 'Spam', onPress: () => send('spam') },
      { text: 'Harassment', onPress: () => send('harassment') },
      { text: 'Harmful medical advice', onPress: () => send('harmful_advice') },
      { text: 'Something else', onPress: () => send('other') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleBlock = (msg: ICommunityMessage) => {
    Alert.alert(
      'Block this member?',
      `You will no longer see messages from ${msg.isAnonymous ? 'this anonymous member' : msg.senderDisplayName}, and they cannot send you direct messages. You can unblock in Community settings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => blockAuthorOf(msg).catch((err: any) => Alert.alert('Could not block', err?.message || 'Please try again.')),
        },
      ],
    );
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

  const handleStartEdit = (msg: ICommunityMessage) => {
    setEditingMessage(msg);
    setInputText(msg.content);
  };

  const handleDirectMessageUser = async (targetUserId: string) => {
    try {
      const dm = await createOrGetDm(targetUserId);
      router.push({
        pathname: '/community/[channelId]',
        params: { channelId: dm.slug || dm._id },
      });
    } catch (err: any) {
      Alert.alert('DM Error', err.message || 'Could not start direct message');
    }
  };

  const handleTimeoutMember = async (targetUserId: string, targetName: string) => {
    if (!channel?.serverId) {
      Alert.alert('Timeout', 'Timeout is only available within community servers.');
      return;
    }
    try {
      await timeoutMember(channel.serverId, targetUserId, 60, '1-hour pacing cooldown');
      Alert.alert('Member Timed Out', `${targetName} has been muted for 1 hour.`);
    } catch (err: any) {
      Alert.alert('Timeout Failed', err.message || 'Could not timeout member');
    }
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
            onPress={() => safeGoBack('/community')}
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

          {/* Header Action Buttons */}
          <View style={styles.headerActionsRight}>
            {/* Search Button */}
            <TouchableOpacity
              style={[
                styles.headerIconBtn,
                isSearching && { backgroundColor: `${palette.primary}20` },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsSearching((prev) => !prev);
              }}
              accessibilityRole="button"
              accessibilityLabel="Search channel messages"
            >
              <Search
                size={18}
                color={isSearching ? palette.primaryText || palette.primary : palette.textSecondary}
              />
            </TouchableOpacity>

            {/* Slow mode (owner and moderators) */}
            {isStaff && channel?.type !== 'dm' && (
              <TouchableOpacity
                style={[styles.headerIconBtn, Boolean(channel?.slowModeSeconds) && { backgroundColor: `${palette.primary}20` }]}
                onPress={handleSlowMode}
                accessibilityRole="button"
                accessibilityLabel="Slow mode"
              >
                <Timer size={18} color={channel?.slowModeSeconds ? palette.primaryText || palette.primary : palette.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Pinned Messages Button */}
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPinnedModalOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="View pinned messages"
            >
              <Pin size={18} color="#F59E0B" />
              {channelPins.length > 0 && (
                <View style={styles.headerPinBadge}>
                  <Text style={styles.headerPinBadgeText}>{channelPins.length}</Text>
                </View>
              )}
            </TouchableOpacity>

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
        </View>

        {/* In-Channel Search Bar & Filter Chips */}
        {isSearching && (
          <View style={[styles.searchContainer, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
            <View style={styles.searchBarRow}>
              <Search size={16} color={palette.textSecondary} style={{ marginRight: 6 }} />
              <TextInput
                style={[styles.searchTextInput, { color: palette.text }]}
                placeholder="Search messages, notes, routines..."
                placeholderTextColor={palette.textDisabled}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color={palette.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.searchChipsRow}
            >
              {[
                { id: 'all', label: 'All' },
                { id: 'notes', label: 'Notes 📑' },
                { id: 'todos', label: 'Routines 📋' },
                { id: 'voice', label: 'Voice 🎙️' },
                { id: 'me', label: 'My Posts 👤' },
              ].map((chip) => {
                const isSelected = searchFilter === chip.id;
                return (
                  <TouchableOpacity
                    key={chip.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSearchFilter(chip.id as any);
                    }}
                    style={[
                      styles.searchChip,
                      {
                        backgroundColor: isSelected ? palette.primary : palette.background,
                        borderColor: isSelected ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.searchChipText,
                        { color: isSelected ? '#FFFFFF' : palette.textSecondary },
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Discord Forum Channel Mode vs Discord Text Chat Mode */}
        {channel?.type === 'forum' ? (
          <DiscordForumView
            channel={channel}
            posts={forumPosts}
            onSelectPost={(post) => {
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
                contentWarning: post.contentWarning,
                embedType: post.embedType,
                embedData: post.embedData as any,
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
              scrollEventThrottle={100}
              onScroll={(e) => {
                const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
                nearBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 160;
              }}
              onContentSizeChange={() => {
                // Only follow new content when the member is already at the bottom (not while reading history).
                if (nearBottomRef.current) scrollViewRef.current?.scrollToEnd({ animated: false });
              }}
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

              {messages.length >= 50 && !noMoreOlder && !isSearching && (
                <TouchableOpacity
                  onPress={handleLoadOlder}
                  disabled={loadingOlder}
                  style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16, marginBottom: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Load earlier messages"
                >
                  {loadingOlder ? (
                    <ActivityIndicator size="small" color={palette.primaryText} />
                  ) : (
                    <Text style={{ color: palette.primaryText, fontWeight: '600' }}>Load earlier messages</Text>
                  )}
                </TouchableOpacity>
              )}

              {isLoading && messages.length === 0 ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={palette.primaryText} />
                </View>
              ) : (
                displayedMessages.map((msg, index) => {
                  // Determine if unread divider should be displayed before this message
                  const showUnreadDivider =
                    Boolean(lastReadId) &&
                    msg._id === lastReadId &&
                    index < displayedMessages.length - 1;

                  return (
                    <React.Fragment key={msg._id}>
                      {showUnreadDivider && (
                        <View style={styles.unreadDivider}>
                          <View style={styles.unreadDividerLine} />
                          <Text style={styles.unreadDividerText}>── NEW MESSAGES ──</Text>
                          <View style={styles.unreadDividerLine} />
                        </View>
                      )}

                      <View style={styles.messageRow}>
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
                            {!msg.isAnonymous && (msg.senderId === user?._id || msg.senderId === 'me' || (user?.name && msg.senderDisplayName === user.name)) ? (
                              <ModularAvatar size={38} animated={false} />
                            ) : (
                              <Text style={styles.avatarEmoji}>
                                {msg.senderAvatarEmoji || (msg.isAnonymous ? '🥄' : '🌟')}
                              </Text>
                            )}
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

                              {msg.isPinned && (
                                <View style={styles.pinnedInlineBadge}>
                                  <Pin size={10} color="#F59E0B" style={{ marginRight: 2 }} />
                                  <Text style={styles.pinnedInlineText}>Pinned</Text>
                                </View>
                              )}

                              <Text style={[styles.timeText, { color: palette.textDisabled }]}>
                                {formatTimeRelative(msg.createdAt)}
                              </Text>
                            </View>

                            {/* Content warning: the message stays hidden until the reader chooses to see it */}
                            {Boolean(msg.contentWarning) && !revealedIds.has(msg._id) && (
                              <TouchableOpacity
                                onPress={() => setRevealedIds((prev) => new Set(prev).add(msg._id))}
                                onLongPress={() => setActionModalMessage(msg)}
                                style={[styles.contentWrap, { backgroundColor: palette.surface, borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                                accessibilityRole="button"
                                accessibilityLabel={`Content warning: ${msg.contentWarning}. Double tap to show the message`}
                              >
                                <TriangleAlert size={16} color="#F59E0B" />
                                <Text style={{ color: palette.text, flex: 1, fontSize: 14 }}>
                                  Content warning: {msg.contentWarning}
                                </Text>
                                <Text style={{ color: palette.primaryText || palette.primary, fontWeight: '700', fontSize: 13 }}>Show</Text>
                              </TouchableOpacity>
                            )}

                            {/* Markdown & Spoilers Content with Long-Press Action Menu */}
                            {msg.content.length > 0 && (!msg.contentWarning || revealedIds.has(msg._id)) && (
                              <TouchableOpacity
                                onLongPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                  setActionModalMessage(msg);
                                }}
                                activeOpacity={0.88}
                                style={styles.contentWrap}
                              >
                                <DiscordMarkdownText
                                  content={msg.content}
                                  isEdited={msg.isEdited}
                                  editedAt={msg.editedAt}
                                  onPressMention={(name) => setInputText((prev) => `@${name} ${prev}`)}
                                />
                              </TouchableOpacity>
                            )}

                            {/* Translation by Lumen AI (only for the reader who asked) */}
                            {Boolean(translations[msg._id]) && (
                              <View style={{ marginTop: 4, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: palette.primary }}>
                                <Text style={{ color: palette.textSecondary, fontSize: 11, fontWeight: '700' }}>TRANSLATED BY LUMEN AI</Text>
                                <Text style={{ color: palette.text, fontSize: 14, marginTop: 2 }}>{translations[msg._id]}</Text>
                              </View>
                            )}

                            {/* Voice Note Audio Player */}
                            {Boolean(msg.audioUrl) && (!msg.contentWarning || revealedIds.has(msg._id)) && (
                              <VoiceNotePlayer
                                audioUrl={msg.audioUrl!}
                                durationSeconds={msg.audioDurationSeconds}
                              />
                            )}

                            {/* Photo shared from the member's library */}
                            {msg.embedType === 'photo' && Boolean(msg.embedData?.photoUrl) && (!msg.contentWarning || revealedIds.has(msg._id)) && (
                              <View style={{ marginTop: 6 }}>
                                <TouchableOpacity
                                  activeOpacity={0.9}
                                  onPress={() => Linking.openURL(msg.embedData!.photoUrl!).catch(() => {})}
                                  accessibilityRole="imagebutton"
                                  accessibilityLabel={`Photo from ${msg.senderDisplayName}${msg.embedData?.caption ? `: ${msg.embedData.caption}` : ''}`}
                                >
                                  <Image
                                    source={{ uri: msg.embedData!.photoUrl! }}
                                    style={{ width: 240, height: 240, borderRadius: 12, backgroundColor: palette.surface }}
                                    resizeMode="cover"
                                  />
                                </TouchableOpacity>
                                {Boolean(msg.embedData?.caption) && (
                                  <Text style={{ color: palette.text, marginTop: 6, fontSize: 14 }}>{msg.embedData!.caption}</Text>
                                )}
                              </View>
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
                    </React.Fragment>
                  );
                })
              )}
            </ScrollView>

            {/* Live Typing Indicator Banner */}
            {currentTyping.length > 0 && (
              <View style={[styles.typingBanner, { backgroundColor: palette.surface }]}>
                <View style={styles.typingDot} />
                <Text style={[styles.typingText, { color: palette.textSecondary }]}>
                  {currentTyping.slice(0, 3).join(', ')}{' '}
                  {currentTyping.length === 1 ? 'is' : 'are'} typing...
                </Text>
              </View>
            )}

            {/* Mention Autocomplete Card */}
            {mentionSuggestions.length > 0 && (
              <View style={[styles.mentionCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.mentionCardTitle, { color: palette.textDisabled }]}>
                  MEMBERS
                </Text>
                {mentionSuggestions.map((name) => (
                  <TouchableOpacity
                    key={name}
                    onPress={() => handleSelectMention(name)}
                    style={styles.mentionItem}
                  >
                    <Text style={styles.mentionItemEmoji}>👤</Text>
                    <Text style={[styles.mentionItemName, { color: palette.text }]}>@{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Editing Message Banner */}
            {editingMessage && (
              <View style={[styles.editingBanner, { backgroundColor: `${palette.primary}18`, borderColor: palette.primary }]}>
                <View style={styles.editingBannerLeft}>
                  <Pencil size={14} color={palette.primaryText || palette.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.editingBannerText, { color: palette.text }]}>
                    Editing message
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setEditingMessage(null);
                    setInputText('');
                  }}
                >
                  <X size={16} color={palette.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

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

            {/* Slow mode and message-request banners */}
            {Boolean(channel?.slowModeSeconds) && (
              <View style={[styles.editingBanner, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Timer size={14} color={palette.textSecondary} style={{ marginRight: 6 }} />
                <Text style={{ color: palette.textSecondary, fontSize: 12, flex: 1 }}>
                  Slow mode is on: wait {channel!.slowModeSeconds! >= 60 ? `${Math.round(channel!.slowModeSeconds! / 60)} min` : `${channel!.slowModeSeconds}s`} between messages
                </Text>
              </View>
            )}
            {dmPendingForMe && (
              <View style={[styles.editingBanner, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: '#F59E0B', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}>
                <Text style={{ color: palette.text, fontSize: 13 }}>
                  {channel?.name} wants to message you. Replying accepts the request.
                </Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <TouchableOpacity onPress={() => handleDmAnswer('accept')} accessibilityRole="button" accessibilityLabel="Accept message request">
                    <Text style={{ color: palette.primaryText || palette.primary, fontWeight: '700' }}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDmAnswer('decline')} accessibilityRole="button" accessibilityLabel="Decline message request">
                    <Text style={{ color: '#EF4444', fontWeight: '700' }}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {dmPendingByMe && (
              <View style={[styles.editingBanner, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={{ color: palette.textSecondary, fontSize: 12, flex: 1 }}>
                  Message request sent. You can send a few messages until they accept.
                </Text>
              </View>
            )}

            {/* Content warning input */}
            {warningOn && (
              <View style={[styles.editingBanner, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: '#F59E0B' }]}>
                <TriangleAlert size={14} color="#F59E0B" style={{ marginRight: 6 }} />
                <TextInput
                  style={{ flex: 1, color: palette.text, paddingVertical: 2 }}
                  placeholder="Content warning, e.g. flare, hospital, medication"
                  placeholderTextColor={palette.textDisabled}
                  value={warningText}
                  onChangeText={setWarningText}
                  maxLength={60}
                  accessibilityLabel="Content warning text"
                />
                <TouchableOpacity onPress={() => { setWarningOn(false); setWarningText(''); }} accessibilityRole="button" accessibilityLabel="Remove content warning">
                  <X size={16} color={palette.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Voice Recorder vs Standard Chat Composer */}
            {isRecordingVoice ? (
              <VoiceNoteRecorder
                onSend={handleSendVoice}
                onCancel={() => setIsRecordingVoice(false)}
              />
            ) : (
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
                {/* Attach Button */}
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

                {/* Content warning toggle */}
                <TouchableOpacity
                  style={styles.micBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setWarningOn((v) => !v);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: warningOn }}
                  accessibilityLabel="Add a content warning"
                >
                  <TriangleAlert size={20} color={warningOn ? '#F59E0B' : palette.textSecondary} />
                </TouchableOpacity>

                {/* Photo Button */}
                <TouchableOpacity
                  style={styles.micBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handlePickPhoto();
                  }}
                  disabled={isSendingPhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Send a photo"
                >
                  {isSendingPhoto ? (
                    <ActivityIndicator size="small" color={palette.textSecondary} />
                  ) : (
                    <ImagePlus size={20} color={palette.textSecondary} />
                  )}
                </TouchableOpacity>

                {/* Voice Note Button */}
                <TouchableOpacity
                  style={styles.micBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setIsRecordingVoice(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Record voice note"
                >
                  <Mic size={20} color={palette.textSecondary} />
                </TouchableOpacity>

                {/* Text Composer Input */}
                <TextInput
                  style={[styles.input, { color: palette.text }]}
                  placeholder={
                    isAnonymous
                      ? 'Message as Anonymous Spoonie 🥄...'
                      : `Message #${channel?.slug || channel?.name || 'chat'}...`
                  }
                  placeholderTextColor={palette.textDisabled}
                  value={inputText}
                  onChangeText={handleTextChange}
                  multiline
                  maxLength={3000}
                />

                {/* Send Button / Confirm Edit Button */}
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
                  accessibilityLabel={editingMessage ? 'Confirm edit' : 'Send message'}
                >
                  {editingMessage ? (
                    <Check size={16} color="#FFFFFF" />
                  ) : (
                    <Send size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>

      {/* Attach Artifact Modal */}
      <AttachArtifactModal
        visible={attachModalOpen}
        onClose={() => setAttachModalOpen(false)}
        onAttach={handleAttachArtifact}
      />

      {/* Discord Profile Popout Modal with Direct Message button */}
      <DiscordProfilePopoutModal
        visible={Boolean(popoutUser)}
        user={popoutUser}
        onClose={clearUserPopout}
        onMention={(name) => setInputText((prev) => `@${name} ${prev}`)}
        onDirectMessage={handleDirectMessageUser}
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

      {/* Discord Pinned Messages Modal */}
      <DiscordPinnedMessagesModal
        visible={pinnedModalOpen}
        onClose={() => setPinnedModalOpen(false)}
        pins={channelPins}
        onUnpin={(msgId) => channelId && togglePinMessage(channelId, msgId)}
        onJumpToMessage={(msgId) => {
          // Message jump will be centered
        }}
      />

      {/* Discord Message Action Sheet Modal */}
      <DiscordMessageActionModal
        visible={Boolean(actionModalMessage)}
        message={actionModalMessage}
        currentUserId={user?._id}
        isModerator={Boolean(
          channel?.serverId &&
            activeServer &&
            activeServer._id === channel.serverId &&
            (activeServer.ownerId === user?._id || Boolean(user?._id && activeServer.modIds?.includes(user._id))),
        )}
        onClose={() => setActionModalMessage(null)}
        onReply={(msg) => handleReplyMessage(msg)}
        onOpenThread={(msg) => openThread(msg)}
        onTogglePin={(msg) => channelId && togglePinMessage(channelId, msg._id)}
        onEdit={(msg) => handleStartEdit(msg)}
        onDelete={(msg) => channelId && deleteMessage(channelId, msg._id)}
        onTimeoutMember={(tUserId, tName) => handleTimeoutMember(tUserId, tName)}
        onReport={handleReport}
        onBlock={handleBlock}
        onTranslate={handleTranslate}
        onReact={(msgId, emoji) => toggleReaction(msgId, emoji)}
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
  headerActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerPinBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerPinBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  anonToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  anonToggleEmoji: {
    fontSize: 13,
    marginRight: 3,
  },
  anonToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  searchTextInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  searchChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  searchChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchChipText: {
    fontSize: 11,
    fontWeight: '600',
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
  unreadDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  unreadDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EF4444',
  },
  unreadDividerText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    letterSpacing: 0.5,
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
    overflow: 'hidden',
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
  pinnedInlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pinnedInlineText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#F59E0B',
  },
  timeText: {
    fontSize: 10,
  },
  contentWrap: {
    marginTop: 2,
    marginBottom: 4,
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
  typingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
    marginRight: 6,
  },
  typingText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  mentionCard: {
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
  },
  mentionCardTitle: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    paddingHorizontal: 6,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  mentionItemEmoji: {
    fontSize: 14,
    marginRight: 8,
  },
  mentionItemName: {
    fontSize: 13,
    fontWeight: '600',
  },
  editingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderTopWidth: 1,
    marginHorizontal: 12,
  },
  editingBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editingBannerText: {
    fontSize: 12,
    fontWeight: '600',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
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
