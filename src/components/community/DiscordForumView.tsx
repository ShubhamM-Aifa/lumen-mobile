import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Plus,
  Tag,
  MessageSquare,
  Sparkles,
  Paperclip,
  X,
  Send,
  Bookmark,
  Share2,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { IForumPost, ICommunityChannel } from '../../shared/types';
import { useCommunityStore } from '../../store/communityStore';
import { useAuthStore } from '../../store/authStore';
import { ModularAvatar } from '../avatar/ModularAvatar';

interface Props {
  channel: ICommunityChannel;
  posts: IForumPost[];
  onSelectPost: (post: IForumPost) => void;
  onOpenAttach?: () => void;
}

const FORUM_TAGS = ['All', 'POTS', 'Long-COVID', 'ME/CFS', 'Pacing', 'Remission', 'Medication'];

export const DiscordForumView: React.FC<Props> = ({
  channel,
  posts,
  onSelectPost,
}) => {
  const { palette } = useTheme();
  const { user } = useAuthStore();
  const { createForumPost, isAnonymous, toggleAnonymous } = useCommunityStore();
  const [selectedTag, setSelectedTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // New post draft state
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftTag, setDraftTag] = useState('POTS');

  const filteredPosts = React.useMemo(() => {
    return posts.filter((p) => {
      const matchesTag = selectedTag === 'All' || p.tags.includes(selectedTag);
      const matchesSearch =
        !searchQuery ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTag && matchesSearch;
    });
  }, [posts, selectedTag, searchQuery]);

  const handlePublish = async () => {
    if (!draftTitle.trim() || !draftContent.trim()) return;
    await createForumPost(
      channel._id,
      draftTitle.trim(),
      [draftTag],
      draftContent.trim()
    );
    setDraftTitle('');
    setDraftContent('');
    setCreateModalVisible(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Forum Header */}
      <View style={[styles.headerBox, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
        <View style={styles.headerTitleRow}>
          <Bookmark size={18} color={palette.primaryText} style={{ marginRight: 6 }} />
          <Text style={[styles.channelTitle, { color: palette.text }]}>#{channel.name}</Text>
        </View>
        <Text style={[styles.topicText, { color: palette.textSecondary }]}>
          {channel.topic || 'Share recovery experiences, treatment milestones, and health protocols.'}
        </Text>

        {/* Tag Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
          {FORUM_TAGS.map((tag) => {
            const isSelected = selectedTag === tag;
            return (
              <TouchableOpacity
                key={tag}
                onPress={() => setSelectedTag(tag)}
                style={[
                  styles.tagPill,
                  {
                    backgroundColor: isSelected ? palette.primary : palette.background,
                    borderColor: isSelected ? palette.primary : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tagPillText,
                    { color: isSelected ? '#FFFFFF' : palette.textSecondary },
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Post Stream */}
      <ScrollView style={styles.postList} contentContainerStyle={{ padding: 12, paddingBottom: 90 }}>
        {filteredPosts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Bookmark size={36} color={palette.textDisabled} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No Health Stories Yet</Text>
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
              Be the first to share your journey or protocol in this forum channel!
            </Text>
          </View>
        ) : (
          filteredPosts.map((post) => (
            <TouchableOpacity
              key={post._id}
              onPress={() => onSelectPost(post)}
              style={[styles.postCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
              activeOpacity={0.8}
            >
              {/* Tags Row */}
              <View style={styles.postTagsRow}>
                {post.tags.map((t, idx) => (
                  <View key={idx} style={[styles.postTag, { backgroundColor: `${palette.primary}20` }]}>
                    <Text style={[styles.postTagText, { color: palette.primaryText }]}>#{t}</Text>
                  </View>
                ))}
              </View>

              {/* Title */}
              <Text style={[styles.postTitle, { color: palette.text }]} numberOfLines={2}>
                {post.title}
              </Text>

              {/* Snippet */}
              <Text style={[styles.postSnippet, { color: palette.textSecondary }]} numberOfLines={3}>
                {post.content}
              </Text>

              {/* Author & Footer */}
              <View style={[styles.postFooter, { borderTopColor: palette.border }]}>
                <View style={styles.authorRow}>
                  {!post.author.isAnonymous && (post.author.senderId === user?._id || post.author.senderId === 'me' || (user?.name && post.author.senderDisplayName === user.name)) ? (
                    <View style={{ width: 20, height: 20, borderRadius: 10, overflow: 'hidden', marginRight: 6 }}>
                      <ModularAvatar size={20} animated={false} />
                    </View>
                  ) : (
                    <Text style={{ fontSize: 14, marginRight: 6 }}>
                      {post.author.senderAvatarEmoji || '🥄'}
                    </Text>
                  )}
                  <Text style={[styles.authorName, { color: post.author.senderRoleColor || palette.text }]}>
                    {post.author.senderDisplayName}
                  </Text>
                  {post.author.senderRoleBadges?.[0] && (
                    <View style={[styles.authorBadge, { backgroundColor: `${palette.primary}20` }]}>
                      <Text style={[styles.authorBadgeText, { color: palette.primaryText }]}>
                        {post.author.senderRoleBadges[0]}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={{ fontSize: 12 }}>🥄</Text>
                    <Text style={[styles.statNum, { color: palette.textSecondary }]}>
                      {post.stats.spoonsCount || 1}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <MessageSquare size={13} color={palette.textSecondary} />
                    <Text style={[styles.statNum, { color: palette.textSecondary }]}>
                      {post.stats.replyCount || 0}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Floating Action Button: New Post */}
      <TouchableOpacity
        onPress={() => setCreateModalVisible(true)}
        style={[styles.fab, { backgroundColor: palette.primary }]}
        activeOpacity={0.85}
      >
        <Plus size={20} color="#FFFFFF" strokeWidth={2.6} />
        <Text style={styles.fabText}>Share Journey</Text>
      </TouchableOpacity>

      {/* Create Story Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent onRequestClose={() => setCreateModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalContent, { backgroundColor: palette.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Share Health Story</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <X size={20} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ padding: 16 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>CHOOSE TOPIC TAG</Text>
              <View style={styles.modalTagsRow}>
                {FORUM_TAGS.filter((t) => t !== 'All').map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setDraftTag(tag)}
                    style={[
                      styles.tagPill,
                      {
                        backgroundColor: draftTag === tag ? palette.primary : palette.background,
                        borderColor: draftTag === tag ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <Text style={{ color: draftTag === tag ? '#FFFFFF' : palette.textSecondary, fontWeight: '700', fontSize: 12 }}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: palette.textSecondary, marginTop: 14 }]}>STORY TITLE</Text>
              <TextInput
                style={[styles.titleInput, { color: palette.text, backgroundColor: palette.background, borderColor: palette.border }]}
                placeholder="e.g., My 6-Month MCAS & POTS Stabilization Protocol"
                placeholderTextColor={palette.textDisabled}
                value={draftTitle}
                onChangeText={setDraftTitle}
              />

              <Text style={[styles.inputLabel, { color: palette.textSecondary, marginTop: 14 }]}>YOUR JOURNEY & PROTOCOL</Text>
              <TextInput
                style={[styles.bodyInput, { color: palette.text, backgroundColor: palette.background, borderColor: palette.border }]}
                placeholder="Share your diagnosis, symptoms, what worked, and what didn't..."
                placeholderTextColor={palette.textDisabled}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                value={draftContent}
                onChangeText={setDraftContent}
              />

              <TouchableOpacity
                onPress={handlePublish}
                style={[styles.publishBtn, { backgroundColor: palette.primary }]}
              >
                <Send size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.publishBtnText}>Publish Health Story</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBox: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  channelTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  topicText: {
    fontSize: 12,
    lineHeight: 16,
  },
  tagsScroll: {
    flexDirection: 'row',
    marginTop: 10,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  postList: {
    flex: 1,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  postCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  postTagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  postTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  postTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 6,
  },
  postSnippet: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    fontSize: 12,
    fontWeight: '700',
  },
  authorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  authorBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    fontSize: 12,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  modalTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  bodyInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 120,
  },
  publishBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 30,
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
