import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ICommunityChannel,
  ICommunityMessage,
  CommunityEmbedType,
  INoteEmbedPayload,
  ITodoEmbedPayload,
  ILogTemplateEmbedPayload,
} from '../shared/types';
import { api } from '../api/client';
import { useNoteStore } from './noteStore';
import { useTaskStore } from './taskStore';

const CHANNELS_CACHE_KEY = 'lumen:community:channels_v1';
const MESSAGES_CACHE_KEY = 'lumen:community:messages_v1';

interface CommunityState {
  channels: ICommunityChannel[];
  activeChannel: ICommunityChannel | null;
  messages: ICommunityMessage[];
  isAnonymous: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchChannels: () => Promise<void>;
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
  channels: [],
  activeChannel: null,
  messages: [],
  isAnonymous: false,
  isLoading: false,
  error: null,

  fetchChannels: async () => {
    set({ isLoading: true, error: null });

    // 1. Fast cache hydrate
    try {
      const cached = await AsyncStorage.getItem(CHANNELS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        set({ channels: parsed });
        if (!get().activeChannel && parsed.length > 0) {
          set({ activeChannel: parsed[0] });
        }
      }
    } catch {}

    // 2. Fetch from backend
    try {
      const res = await api.get<ICommunityChannel[]>('/community/channels');
      if (res && Array.isArray(res)) {
        set({ channels: res });
        if (!get().activeChannel && res.length > 0) {
          set({ activeChannel: res[0] });
        }
        await AsyncStorage.setItem(CHANNELS_CACHE_KEY, JSON.stringify(res));
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to sync community channels' });
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveChannel: (channel: ICommunityChannel) => {
    set({ activeChannel: channel });
    get().fetchMessages(channel._id);
  },

  fetchMessages: async (channelId: string) => {
    set({ isLoading: true, error: null });

    // 1. Fast cache hydrate for this channel
    try {
      const cached = await AsyncStorage.getItem(`${MESSAGES_CACHE_KEY}:${channelId}`);
      if (cached) {
        set({ messages: JSON.parse(cached) });
      }
    } catch {}

    // 2. Fetch from backend
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

    const optimisticMsg: ICommunityMessage = {
      _id: tempId,
      channelId,
      senderId: 'me',
      senderDisplayName: isAnonymous ? 'Anonymous Spoonie' : 'You',
      senderAvatarEmoji: isAnonymous ? '🥄' : '🌟',
      isAnonymous,
      content,
      embedType,
      embedData,
      reactions: {},
      userReactions: [],
      cloneCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic insert
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

  cloneNoteToPersonal: async (embed, messageId) => {
    // Instantiate into local noteStore
    await useNoteStore.getState().createNote({
      title: embed.title,
      icon: embed.icon || '📝',
      coverGradient: embed.coverGradient,
      tags: [...(embed.tags || []), 'Community Shared'],
      blocks: JSON.parse(JSON.stringify(embed.blocksFull || [])),
    });

    // Notify backend metrics if messageId provided
    if (messageId && !messageId.startsWith('temp_')) {
      api.post(`/community/messages/${messageId}/clone`, {}).catch(() => {});
    }
  },

  cloneTodoToPersonal: async (embed, messageId) => {
    // Create new dedicated task list in To-Do hub
    const list = await useTaskStore
      .getState()
      .createList(embed.listName || 'Community Routine', '📋', '#10B981');

    // Insert tasks into this list
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
    // Track clone count on message
    if (messageId && !messageId.startsWith('temp_')) {
      api.post(`/community/messages/${messageId}/clone`, {}).catch(() => {});
    }
  },
}));
