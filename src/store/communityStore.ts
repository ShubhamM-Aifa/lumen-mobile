import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ICommunityServer,
  ICommunityChannel,
  ICommunityMessage,
  IForumPost,
  IDiscordUserProfile,
  CommunityEmbedType,
  INoteEmbedPayload,
  ITodoEmbedPayload,
  ILogTemplateEmbedPayload,
} from '../shared/types';
import {
  CreateCommunityServerDto,
  CreateCommunityChannelDto,
} from '../shared/schemas';
import { api } from '../api/client';
import { useNoteStore } from './noteStore';
import { useTaskStore } from './taskStore';

const SERVERS_CACHE_KEY = 'lumen:community:servers_v1';
const CHANNELS_CACHE_KEY = 'lumen:community:channels_v1';
const MESSAGES_CACHE_KEY = 'lumen:community:messages_v1';
const FORUM_CACHE_KEY = 'lumen:community:forum_posts_v1';

interface CommunityState {
  servers: ICommunityServer[];
  activeServer: ICommunityServer | null;
  channels: ICommunityChannel[];
  activeChannel: ICommunityChannel | null;
  messages: ICommunityMessage[];
  isAnonymous: boolean;
  isLoading: boolean;
  error: string | null;

  // Discord State
  replyingTo: {
    messageId: string;
    senderDisplayName: string;
    snippet: string;
  } | null;
  collapsedCategories: Record<string, boolean>;
  popoutUser: IDiscordUserProfile | null;
  forumPosts: IForumPost[];
  activeThreadParent: ICommunityMessage | null;
  activeThreadReplies: ICommunityMessage[];

  // Server Actions
  fetchServers: () => Promise<void>;
  setActiveServer: (server: ICommunityServer) => void;
  createServer: (data: CreateCommunityServerDto) => Promise<ICommunityServer>;
  joinServer: (inviteCodeOrId: string) => Promise<ICommunityServer>;
  createChannel: (
    serverId: string,
    channelData: CreateCommunityChannelDto
  ) => Promise<ICommunityChannel>;

  // Channel Actions
  fetchChannels: (serverId?: string) => Promise<void>;
  setActiveChannel: (channel: ICommunityChannel) => void;
  fetchMessages: (channelId: string) => Promise<void>;
  sendMessage: (
    channelId: string,
    content: string,
    embedType?: CommunityEmbedType,
    embedData?: any
  ) => Promise<ICommunityMessage>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  toggleAnonymous: () => void;
  setReplyingTo: (
    reply: { messageId: string; senderDisplayName: string; snippet: string } | null
  ) => void;
  toggleCategoryCollapsed: (categoryName: string) => void;

  // Discord Profile & Threads
  fetchUserPopout: (userId: string) => Promise<IDiscordUserProfile | null>;
  clearUserPopout: () => void;
  openThread: (message: ICommunityMessage) => Promise<void>;
  closeThread: () => void;
  sendThreadReply: (parentMessageId: string, content: string) => Promise<void>;

  // Discord Forum Posts
  fetchForumPosts: (channelId: string, tag?: string, search?: string) => Promise<void>;
  createForumPost: (
    channelId: string,
    title: string,
    tags: string[],
    content: string,
    embedType?: CommunityEmbedType,
    embedData?: any
  ) => Promise<IForumPost>;

  // 1-Tap Clone Dispatchers
  cloneNoteToPersonal: (
    embed: INoteEmbedPayload,
    messageId?: string
  ) => Promise<void>;
  cloneTodoToPersonal: (
    embed: ITodoEmbedPayload,
    messageId?: string
  ) => Promise<void>;
  cloneLogTemplateToPersonal: (
    embed: ILogTemplateEmbedPayload,
    messageId?: string
  ) => Promise<void>;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  servers: [],
  activeServer: null,
  channels: [],
  activeChannel: null,
  messages: [],
  isAnonymous: false,
  isLoading: false,
  error: null,

  // Discord State defaults
  replyingTo: null,
  collapsedCategories: {},
  popoutUser: null,
  forumPosts: [],
  activeThreadParent: null,
  activeThreadReplies: [],

  fetchServers: async () => {
    set({ isLoading: true, error: null });

    try {
      const cached = await AsyncStorage.getItem(SERVERS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        set({ servers: parsed });
        if (!get().activeServer && parsed.length > 0) {
          set({ activeServer: parsed[0] });
        }
      }
    } catch {}

    try {
      const res = await api.get<ICommunityServer[]>('/community/servers');
      if (res && Array.isArray(res)) {
        set({ servers: res });
        if (!get().activeServer && res.length > 0) {
          set({ activeServer: res[0] });
        }
        await AsyncStorage.setItem(SERVERS_CACHE_KEY, JSON.stringify(res));
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to sync community servers' });
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveServer: (server: ICommunityServer) => {
    set({ activeServer: server, activeChannel: null });
    get().fetchChannels(server._id);
  },

  createServer: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<ICommunityServer>('/community/servers', data);
      if (res && res._id) {
        const updated = [...get().servers, res];
        set({ servers: updated, activeServer: res });
        await AsyncStorage.setItem(SERVERS_CACHE_KEY, JSON.stringify(updated));
        // Fetch new channels for this server
        get().fetchChannels(res._id);
        return res;
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to create community' });
    } finally {
      set({ isLoading: false });
    }

    const fallback: ICommunityServer = {
      _id: `temp_server_${Date.now()}`,
      name: data.name,
      slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: data.description || '',
      icon: data.icon || '🌟',
      color: data.color || '#38BDF8',
      conditionTags: data.conditionTags || ['Chronic Health'],
      isPrivate: Boolean(data.isPrivate),
      inviteCode: 'JOIN99',
      ownerId: 'me',
      membersCount: 1,
      isOfficial: false,
      isMember: true,
      createdAt: new Date().toISOString(),
    };
    return fallback;
  },

  joinServer: async (inviteCodeOrId) => {
    set({ isLoading: true, error: null });
    try {
      const isCode = inviteCodeOrId.length <= 10 && !inviteCodeOrId.includes('-');
      const payload = isCode
        ? { inviteCode: inviteCodeOrId.toUpperCase() }
        : { serverId: inviteCodeOrId };

      const res = await api.post<ICommunityServer>('/community/servers/join', payload);
      if (res && res._id) {
        const existing = get().servers;
        const exists = existing.some((s) => s._id === res._id);
        const updated = exists ? existing.map((s) => (s._id === res._id ? res : s)) : [...existing, res];
        set({ servers: updated, activeServer: res });
        await AsyncStorage.setItem(SERVERS_CACHE_KEY, JSON.stringify(updated));
        get().fetchChannels(res._id);
        return res;
      }
    } catch (err: any) {
      set({ error: err.message || 'Invalid invite code or server not found' });
      throw err;
    } finally {
      set({ isLoading: false });
    }

    throw new Error('Could not join community server');
  },

  createChannel: async (serverId, channelData) => {
    const res = await api.post<ICommunityChannel>(
      `/community/servers/${serverId}/channels`,
      channelData
    );

    if (res && res._id) {
      const updated = [...get().channels, res];
      set({ channels: updated, activeChannel: res });
      return res;
    }

    const fallback: ICommunityChannel = {
      _id: `temp_chan_${Date.now()}`,
      serverId,
      name: channelData.name,
      slug: channelData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: channelData.description || '',
      icon: channelData.icon || '💬',
      color: channelData.color || '#38BDF8',
      topic: channelData.topic || '',
      category: channelData.category || 'COMMUNITY',
      type: channelData.type || 'text',
      order: get().channels.length + 1,
      memberCount: 1,
      messageCount: 0,
      isFeatured: false,
      createdAt: new Date().toISOString(),
    };
    return fallback;
  },

  fetchChannels: async (serverId?: string) => {
    set({ isLoading: true, error: null });

    const targetServerId = serverId || get().activeServer?._id;
    const cacheKey = targetServerId ? `${CHANNELS_CACHE_KEY}:${targetServerId}` : CHANNELS_CACHE_KEY;

    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        set({ channels: parsed });
        if (!get().activeChannel && parsed.length > 0) {
          set({ activeChannel: parsed[0] });
        }
      }
    } catch {}

    try {
      const endpoint = targetServerId
        ? `/community/channels?serverId=${targetServerId}`
        : '/community/channels';
      const res = await api.get<ICommunityChannel[]>(endpoint);
      if (res && Array.isArray(res)) {
        set({ channels: res });
        if (!get().activeChannel && res.length > 0) {
          set({ activeChannel: res[0] });
        }
        await AsyncStorage.setItem(cacheKey, JSON.stringify(res));
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to sync community channels' });
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveChannel: (channel: ICommunityChannel) => {
    set({ activeChannel: channel, replyingTo: null });
    if (channel.type === 'forum') {
      get().fetchForumPosts(channel._id);
    } else {
      get().fetchMessages(channel._id);
    }
  },

  setReplyingTo: (reply) => {
    set({ replyingTo: reply });
  },

  toggleCategoryCollapsed: (categoryName: string) => {
    set((state) => ({
      collapsedCategories: {
        ...state.collapsedCategories,
        [categoryName]: !state.collapsedCategories[categoryName],
      },
    }));
  },

  fetchMessages: async (channelId: string) => {
    set({ isLoading: true, error: null });

    try {
      const cached = await AsyncStorage.getItem(`${MESSAGES_CACHE_KEY}:${channelId}`);
      if (cached) {
        set({ messages: JSON.parse(cached) });
      }
    } catch {}

    try {
      const res = await api.get<ICommunityMessage[]>(
        `/community/channels/${channelId}/messages`
      );
      if (res && Array.isArray(res)) {
        set({ messages: res });
        await AsyncStorage.setItem(
          `${MESSAGES_CACHE_KEY}:${channelId}`,
          JSON.stringify(res)
        );
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch messages' });
    } finally {
      set({ isLoading: false });
    }
  },

  sendMessage: async (channelId, content, embedType, embedData) => {
    const tempId = `temp_msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const isAnonymous = get().isAnonymous;
    const replyingTo = get().replyingTo;

    const optimisticMsg: ICommunityMessage = {
      _id: tempId,
      channelId,
      senderId: 'me',
      senderDisplayName: isAnonymous ? 'Anonymous Spoonie' : 'You',
      senderAvatarEmoji: isAnonymous ? '🥄' : '🌟',
      senderRoleColor: isAnonymous ? '#94A3B8' : '#38BDF8',
      senderRoleBadges: isAnonymous ? ['Anonymous Spoonie'] : ['Community Member'],
      isAnonymous,
      content,
      replyTo: replyingTo ? { ...replyingTo } : undefined,
      threadMeta: { replyCount: 0 },
      embedType,
      embedData,
      reactions: {},
      userReactions: [],
      cloneCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set({ replyingTo: null });

    const previous = get().messages;
    const updated = [...previous, optimisticMsg];
    set({ messages: updated });
    await AsyncStorage.setItem(
      `${MESSAGES_CACHE_KEY}:${channelId}`,
      JSON.stringify(updated)
    );

    try {
      const serverMsg = await api.post<ICommunityMessage>(
        `/community/channels/${channelId}/messages`,
        {
          channelId,
          content,
          isAnonymous,
          senderDisplayName: isAnonymous ? 'Anonymous Spoonie' : 'You',
          senderAvatarEmoji: isAnonymous ? '🥄' : '🌟',
          senderRoleColor: isAnonymous ? '#94A3B8' : '#38BDF8',
          senderRoleBadges: isAnonymous ? ['Anonymous Spoonie'] : ['Community Member'],
          replyTo: replyingTo ? { ...replyingTo } : undefined,
          embedType,
          embedData,
        }
      );

      if (serverMsg && serverMsg._id) {
        const finalized = get().messages.map((m) =>
          m._id === tempId ? serverMsg : m
        );
        set({ messages: finalized });
        await AsyncStorage.setItem(
          `${MESSAGES_CACHE_KEY}:${channelId}`,
          JSON.stringify(finalized)
        );
        return serverMsg;
      }
    } catch {}

    return optimisticMsg;
  },

  toggleReaction: async (messageId: string, emoji: string) => {
    const previous = get().messages;
    const updated = previous.map((m) => {
      if (m._id !== messageId) return m;

      const myReactions = m.userReactions || [];
      const hasReacted = myReactions.includes(emoji);
      const nextUserReactions = hasReacted
        ? myReactions.filter((e) => e !== emoji)
        : [...myReactions, emoji];

      const currentReactions = { ...(m.reactions || {}) };
      const currentCount = currentReactions[emoji] || 0;
      if (hasReacted) {
        currentReactions[emoji] = Math.max(0, currentCount - 1);
        if (currentReactions[emoji] === 0) delete currentReactions[emoji];
      } else {
        currentReactions[emoji] = currentCount + 1;
      }

      return {
        ...m,
        reactions: currentReactions,
        userReactions: nextUserReactions,
      };
    });

    set({ messages: updated });

    try {
      await api.post(`/community/messages/${messageId}/react`, { emoji });
    } catch {}
  },

  toggleAnonymous: () => {
    set((state) => ({ isAnonymous: !state.isAnonymous }));
  },

  // ────────── Discord User Profile Popout ──────────

  fetchUserPopout: async (userId: string) => {
    try {
      const res = await api.get<IDiscordUserProfile>(`/community/users/${userId}/popout`);
      if (res && res.displayName) {
        set({ popoutUser: res });
        return res;
      }
    } catch {
      const fallback: IDiscordUserProfile = {
        userId,
        displayName: 'Spoonie Warrior',
        avatarEmoji: '🌟',
        bannerGradient: ['#0284C7', '#6366F1'],
        bio: 'Pacing navigator, daily tracker, and community member.',
        energyStatus: 'Pacing & Resting 🥄',
        conditionTags: ['Dysautonomia', 'Pacing Warrior'],
        roleBadges: ['POTS Veteran', 'Community Guide'],
        roleColor: '#38BDF8',
        stats: {
          sharedNotesCount: 5,
          sharedTodosCount: 3,
          totalClones: 48,
        },
      };
      set({ popoutUser: fallback });
      return fallback;
    }
    return null;
  },

  clearUserPopout: () => {
    set({ popoutUser: null });
  },

  // ────────── Discord Threads ──────────

  openThread: async (message: ICommunityMessage) => {
    set({ activeThreadParent: message, activeThreadReplies: [] });
    try {
      const res = await api.get<{ parent: ICommunityMessage; replies: ICommunityMessage[] }>(
        `/community/messages/${message._id}/thread`
      );
      if (res && res.replies) {
        set({ activeThreadReplies: res.replies });
      }
    } catch {}
  },

  closeThread: () => {
    set({ activeThreadParent: null, activeThreadReplies: [] });
  },

  sendThreadReply: async (parentMessageId: string, content: string) => {
    const parent = get().activeThreadParent;
    if (!parent) return;

    await get().sendMessage(parent.channelId, content);
    get().openThread(parent);
  },

  // ────────── Discord Forum Posts ──────────

  fetchForumPosts: async (channelId: string, tag?: string, search?: string) => {
    set({ isLoading: true, error: null });
    try {
      const cached = await AsyncStorage.getItem(`${FORUM_CACHE_KEY}:${channelId}`);
      if (cached) {
        set({ forumPosts: JSON.parse(cached) });
      }
    } catch {}

    try {
      const queryParams = new URLSearchParams();
      if (tag) queryParams.append('tag', tag);
      if (search) queryParams.append('search', search);

      const res = await api.get<IForumPost[]>(
        `/community/forums/${channelId}/posts?${queryParams.toString()}`
      );
      if (res && Array.isArray(res)) {
        set({ forumPosts: res });
        await AsyncStorage.setItem(
          `${FORUM_CACHE_KEY}:${channelId}`,
          JSON.stringify(res)
        );
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch forum posts' });
    } finally {
      set({ isLoading: false });
    }
  },

  createForumPost: async (channelId, title, tags, content, embedType, embedData) => {
    const isAnonymous = get().isAnonymous;
    const res = await api.post<IForumPost>(`/community/forums/${channelId}/posts`, {
      channelId,
      title,
      tags,
      content,
      isAnonymous,
      senderAvatarEmoji: isAnonymous ? '🥄' : '🌟',
      embedType,
      embedData,
    });

    if (res && res._id) {
      const updated = [res, ...get().forumPosts];
      set({ forumPosts: updated });
      await AsyncStorage.setItem(
        `${FORUM_CACHE_KEY}:${channelId}`,
        JSON.stringify(updated)
      );
      return res;
    }

    const fallback: IForumPost = {
      _id: `temp_post_${Date.now()}`,
      channelId,
      title,
      tags,
      author: {
        senderId: 'me',
        senderDisplayName: isAnonymous ? 'Anonymous Spoonie' : 'You',
        senderAvatarEmoji: isAnonymous ? '🥄' : '🌟',
        isAnonymous,
        senderRoleColor: isAnonymous ? '#94A3B8' : '#F59E0B',
        senderRoleBadges: isAnonymous ? ['Anonymous Spoonie'] : ['Storyteller'],
      },
      content,
      embedType,
      embedData,
      stats: { replyCount: 0, spoonsCount: 1, cloneCount: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return fallback;
  },

  // ────────── 1-Tap Clone Dispatchers ──────────

  cloneNoteToPersonal: async (embed, messageId) => {
    await useNoteStore.getState().createNote({
      title: embed.title,
      icon: embed.icon || '📝',
      coverGradient: embed.coverGradient,
      tags: [...(embed.tags || []), 'Community Shared'],
      blocks: JSON.parse(JSON.stringify(embed.blocksFull || [])),
    });

    if (messageId && !messageId.startsWith('temp_')) {
      api.post(`/community/messages/${messageId}/clone`, {}).catch(() => {});
    }
  },

  cloneTodoToPersonal: async (embed, messageId) => {
    const list = await useTaskStore
      .getState()
      .createList(embed.listName || 'Community Routine', '📋', '#10B981');

    for (const task of embed.tasks || []) {
      await useTaskStore.getState().addTask({
        title: task.title,
        energyCost: task.energyCost || embed.energyCost,
        listId: list._id,
        steps: (task.steps || []).map((s, idx) => ({
          id: `step_${Date.now()}_${idx}`,
          title: s.title,
          completed: false,
        })),
      });
    }

    if (messageId && !messageId.startsWith('temp_')) {
      api.post(`/community/messages/${messageId}/clone`, {}).catch(() => {});
    }
  },

  cloneLogTemplateToPersonal: async (embed, messageId) => {
    if (messageId && !messageId.startsWith('temp_')) {
      api.post(`/community/messages/${messageId}/clone`, {}).catch(() => {});
    }
  },
}));
