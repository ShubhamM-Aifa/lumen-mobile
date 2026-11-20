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
  INote,
  ITaskList,
} from '../shared/types';
import {
  CreateCommunityServerDto,
  CreateCommunityChannelDto,
} from '../shared/schemas';
import { api } from '../api/client';
import { useAuthStore } from './authStore';
import { useNoteStore } from './noteStore';
import { useTaskStore } from './taskStore';
import { communitySocket } from '../services/communitySocket';
import { uploadMedia } from '../services/mediaUpload';

const SERVERS_CACHE_KEY = 'lumen:community:servers_v1';
const CHANNELS_CACHE_KEY = 'lumen:community:channels_v1';
const MESSAGES_CACHE_KEY = 'lumen:community:messages_v1';
const FORUM_CACHE_KEY = 'lumen:community:forum_posts_v1';
const DMS_CACHE_KEY = 'lumen:community:dms_v1';

/** After a group change the server adds a notice line ("Sam added Priya"); reload it if that chat is open. */
function refreshOpenChat(get: () => { messages: Array<{ channelId?: string }>; fetchMessages: (id: string) => Promise<void> }, channelId: string): void {
  if (get().messages.some((m) => String(m.channelId) === channelId)) get().fetchMessages(channelId).catch(() => {});
}

export interface CommunityBlock {
  id: string;
  label: string;
  /** Missing when the person was blocked from an anonymous message. */
  userId?: string;
}

export type ReportReason = 'spam' | 'harassment' | 'harmful_advice' | 'other';

export interface CommunityReportItem {
  id: string;
  messageId: string;
  channelId: string;
  reason: ReportReason;
  note?: string;
  snippet: string;
  senderLabel: string;
  createdAt: string;
}

export interface CommunityPerson {
  userId: string;
  displayName: string;
  handle?: string | null;
}

export interface DmInvite {
  code: string;
  handle: string | null;
  enabled: boolean;
  /** lumen://community/invite/<code> */
  link: string;
}

export interface CommunityMember {
  userId: string;
  displayName: string;
  isOwner: boolean;
  isMod?: boolean;
}

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

  // Discord Real-time, Pins, DMs, & Read State
  pinnedMessages: Record<string, ICommunityMessage[]>;
  typingUsers: Record<string, string[]>;
  readStates: Record<string, string>;
  dmChannels: ICommunityChannel[];

  // Server Actions
  fetchServers: () => Promise<void>;
  setActiveServer: (server: ICommunityServer) => void;
  createServer: (data: CreateCommunityServerDto) => Promise<ICommunityServer>;
  joinServer: (inviteCodeOrId: string) => Promise<ICommunityServer>;
  updateServer: (
    serverId: string,
    changes: { name?: string; description?: string; icon?: string; color?: string }
  ) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
  removeServerLocally: (serverId: string) => void;
  leaveServer: (serverId: string) => Promise<void>;
  fetchServerMembers: (serverId: string) => Promise<CommunityMember[]>;
  setModerator: (serverId: string, userId: string, isMod: boolean) => Promise<void>;

  // My settings
  fetchMySettings: () => Promise<{ status: string; push: boolean; quiet: boolean }>;
  updateMySettings: (changes: { status?: string; push?: boolean; quiet?: boolean }) => Promise<void>;
  setSlowMode: (channelId: string, seconds: number) => Promise<void>;
  respondToDmRequest: (channelId: string, action: 'accept' | 'decline') => Promise<void>;
  translateMessage: (messageId: string, target: 'english' | 'hinglish') => Promise<string>;
  searchPeople: (query: string) => Promise<CommunityPerson[]>;
  /** Exact @handle lookup; null when there is no such (reachable) member. */
  lookupHandle: (handle: string) => Promise<CommunityPerson | null>;
  getMyInvite: () => Promise<DmInvite>;
  setMyHandle: (handle: string | null) => Promise<DmInvite>;
  rotateMyInvite: () => Promise<DmInvite>;
  setInviteEnabled: (enabled: boolean) => Promise<DmInvite>;
  previewInvite: (codeOrLink: string) => Promise<{ displayName: string; handle: string | null }>;
  openInvite: (codeOrLink: string) => Promise<ICommunityChannel>;
  createGroup: (memberIds: string[], name?: string) => Promise<ICommunityChannel>;
  addGroupMembers: (channelId: string, userIds: string[]) => Promise<ICommunityChannel>;
  removeGroupMember: (channelId: string, userId: string) => Promise<ICommunityChannel>;
  leaveGroup: (channelId: string) => Promise<void>;
  renameGroup: (channelId: string, name: string) => Promise<ICommunityChannel>;
  editGroup: (channelId: string, changes: { name?: string; about?: string; photoMediaId?: string | null }) => Promise<ICommunityChannel>;
  muteGroup: (channelId: string, muted: boolean) => Promise<ICommunityChannel>;

  // Safety
  blocks: CommunityBlock[];
  fetchBlocks: () => Promise<void>;
  blockAuthorOf: (message: ICommunityMessage) => Promise<void>;
  unblock: (blockId: string) => Promise<void>;
  reportMessage: (messageId: string, reason: ReportReason, note?: string) => Promise<void>;
  fetchReports: (serverId: string) => Promise<CommunityReportItem[]>;
  resolveReport: (reportId: string, action: 'dismiss' | 'delete') => Promise<void>;
  createChannel: (
    serverId: string,
    channelData: CreateCommunityChannelDto
  ) => Promise<ICommunityChannel>;

  // Channel Actions
  fetchChannels: (serverId?: string) => Promise<void>;
  setActiveChannel: (channel: ICommunityChannel) => void;
  fetchMessages: (channelId: string) => Promise<void>;
  /** Loads the page of messages before the oldest one shown; returns how many were added. */
  fetchOlderMessages: (channelId: string) => Promise<number>;
  sendMessage: (
    channelId: string,
    content: string,
    embedType?: CommunityEmbedType,
    embedData?: any,
    audioUrl?: string,
    audioDurationSeconds?: number,
    mentions?: string[],
    audioMediaId?: string,
    contentWarning?: string
  ) => Promise<ICommunityMessage>;
  editMessage: (channelId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (channelId: string, messageId: string) => Promise<void>;
  togglePinMessage: (channelId: string, messageId: string) => Promise<void>;
  fetchPinnedMessages: (channelId: string) => Promise<void>;
  markChannelAsRead: (channelId: string, lastReadMessageId?: string) => Promise<void>;
  fetchReadState: (channelId: string) => Promise<string | undefined>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  toggleAnonymous: () => void;
  setReplyingTo: (
    reply: { messageId: string; senderDisplayName: string; snippet: string } | null
  ) => void;
  toggleCategoryCollapsed: (categoryName: string) => void;

  // Direct Messages & Moderation
  fetchDms: () => Promise<void>;
  upsertDm: (channel: ICommunityChannel) => void;
  createOrGetDm: (targetUserId: string) => Promise<ICommunityChannel>;
  timeoutMember: (
    serverId: string,
    userId: string,
    durationMinutes?: number,
    reason?: string
  ) => Promise<void>;
  setupSocketListeners: () => () => void;

  // Discord Profile & Threads
  fetchUserPopout: (userId: string) => Promise<IDiscordUserProfile | null>;
  clearUserPopout: () => void;
  openThread: (message: ICommunityMessage) => Promise<void>;
  closeThread: () => void;
  sendThreadReply: (
    parentMessageId: string,
    content: string,
    opts?: { contentWarning?: string; photoUri?: string; photoMimeType?: string }
  ) => Promise<void>;

  // Discord Forum Posts
  fetchForumPosts: (channelId: string, tag?: string, search?: string) => Promise<void>;
  createForumPost: (
    channelId: string,
    title: string,
    tags: string[],
    content: string,
    embedType?: CommunityEmbedType,
    embedData?: any,
    contentWarning?: string
  ) => Promise<IForumPost>;

  // 1-Tap Clone Dispatchers
  cloneNoteToPersonal: (
    embed: INoteEmbedPayload,
    messageId?: string
  ) => Promise<INote>;
  cloneTodoToPersonal: (
    embed: ITodoEmbedPayload,
    messageId?: string
  ) => Promise<ITaskList>;
  /** Creates a reviewable draft from a shared template and returns its id (nothing is added yet). */
  cloneLogTemplateToPersonal: (
    embed: ILogTemplateEmbedPayload,
    messageId?: string
  ) => Promise<string>;
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

  replyingTo: null,
  collapsedCategories: {},
  popoutUser: null,
  forumPosts: [],
  activeThreadParent: null,
  activeThreadReplies: [],

  pinnedMessages: {},
  typingUsers: {},
  readStates: {},
  dmChannels: [],
  blocks: [],

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

  updateServer: async (serverId, changes) => {
    const res = await api.patch<ICommunityServer>(`/community/servers/${serverId}`, changes);
    if (res && res._id) {
      const servers = get().servers.map((s) => (s._id === res._id ? { ...s, ...res } : s));
      set({
        servers,
        activeServer: get().activeServer?._id === res._id ? { ...get().activeServer!, ...res } : get().activeServer,
      });
      AsyncStorage.setItem(SERVERS_CACHE_KEY, JSON.stringify(servers)).catch(() => {});
    }
  },

  deleteServer: async (serverId) => {
    await api.delete(`/community/servers/${serverId}`);
    get().removeServerLocally(serverId);
  },

  leaveServer: async (serverId) => {
    await api.post(`/community/servers/${serverId}/leave`, {});
    get().removeServerLocally(serverId);
  },

  removeServerLocally: (serverId) => {
    const servers = get().servers.filter((s) => s._id !== serverId);
    const wasActive = get().activeServer?._id === serverId;
    set({ servers, ...(wasActive ? { activeServer: servers[0] ?? null, activeChannel: null, channels: [] } : {}) });
    AsyncStorage.setItem(SERVERS_CACHE_KEY, JSON.stringify(servers)).catch(() => {});
    if (wasActive && servers[0]) get().fetchChannels(servers[0]._id);
  },

  fetchMySettings: async () => {
    try {
      const res = await api.get<{ status: string; push: boolean; quiet: boolean }>('/community/me/settings');
      if (res) return res;
    } catch {}
    return { status: '', push: true, quiet: false };
  },

  updateMySettings: async (changes) => {
    await api.put('/community/me/settings', changes);
  },

  setSlowMode: async (channelId, seconds) => {
    await api.patch(`/community/channels/${channelId}/settings`, { slowModeSeconds: seconds });
    set((state) => ({
      channels: state.channels.map((c) => (c._id === channelId || c.slug === channelId ? { ...c, slowModeSeconds: seconds } : c)),
      activeChannel:
        state.activeChannel && (state.activeChannel._id === channelId || state.activeChannel.slug === channelId)
          ? { ...state.activeChannel, slowModeSeconds: seconds }
          : state.activeChannel,
    }));
  },

  respondToDmRequest: async (channelId, action) => {
    await api.post(`/community/dms/${channelId}/${action}`, {});
    const dmStatus = action === 'accept' ? 'accepted' : 'declined';
    set((state) => ({
      dmChannels: state.dmChannels.map((c) => (c._id === channelId ? { ...c, dmStatus } : c)),
      activeChannel: state.activeChannel && state.activeChannel._id === channelId ? { ...state.activeChannel, dmStatus } : state.activeChannel,
    }));
  },

  searchPeople: async (query) => {
    try {
      const res = await api.get<CommunityPerson[]>(`/community/people?q=${encodeURIComponent(query)}`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  lookupHandle: async (handle) => {
    try {
      const h = handle.trim().replace(/^@/, '').toLowerCase();
      if (!h) return null;
      return await api.get<CommunityPerson>(`/community/people/handle/${encodeURIComponent(h)}`);
    } catch {
      return null;
    }
  },

  getMyInvite: () => api.get<DmInvite>('/community/me/invite'),
  setMyHandle: (handle) => api.put<DmInvite>('/community/me/invite/handle', { handle }),
  rotateMyInvite: () => api.post<DmInvite>('/community/me/invite/rotate', {}),
  setInviteEnabled: (enabled) => api.put<DmInvite>('/community/me/invite/enabled', { enabled }),
  previewInvite: (codeOrLink) => api.get<{ displayName: string; handle: string | null }>(`/community/invite/${encodeURIComponent(codeOrLink.trim().slice(-200))}`),

  openInvite: async (codeOrLink) => {
    const res = await api.post<ICommunityChannel>('/community/dms/by-invite', { code: codeOrLink.trim() });
    get().upsertDm(res);
    return res;
  },

  createGroup: async (memberIds, name) => {
    const res = await api.post<ICommunityChannel>('/community/dms/groups', { memberIds, ...(name?.trim() ? { name: name.trim() } : {}) });
    get().upsertDm(res);
    return res;
  },
  addGroupMembers: async (channelId, userIds) => {
    const res = await api.post<ICommunityChannel>(`/community/dms/${channelId}/members`, { userIds });
    get().upsertDm(res);
    refreshOpenChat(get, channelId);
    return res;
  },
  removeGroupMember: async (channelId, userId) => {
    const res = await api.delete<ICommunityChannel>(`/community/dms/${channelId}/members/${userId}`);
    get().upsertDm(res);
    refreshOpenChat(get, channelId);
    return res;
  },
  leaveGroup: async (channelId) => {
    await api.post(`/community/dms/${channelId}/leave`, {});
    set((state) => {
      const updated = state.dmChannels.filter((c) => c._id !== channelId);
      AsyncStorage.setItem(DMS_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
      return { dmChannels: updated, activeChannel: state.activeChannel?._id === channelId ? null : state.activeChannel };
    });
  },
  renameGroup: async (channelId, name) => {
    const res = await api.patch<ICommunityChannel>(`/community/dms/${channelId}`, { name });
    get().upsertDm(res);
    refreshOpenChat(get, channelId);
    return res;
  },

  editGroup: async (channelId, changes) => {
    const res = await api.patch<ICommunityChannel>(`/community/dms/${channelId}`, changes);
    get().upsertDm(res);
    refreshOpenChat(get, channelId);
    return res;
  },

  muteGroup: async (channelId, muted) => {
    const res = await api.put<ICommunityChannel>(`/community/dms/${channelId}/mute`, { muted });
    get().upsertDm(res);
    return res;
  },

  /** Adds or replaces one chat in the DM list (and its cache). */
  upsertDm: (channel) => {
    set((state) => {
      const exists = state.dmChannels.some((c) => c._id === channel._id);
      const updated = exists
        ? state.dmChannels.map((c) => (c._id === channel._id ? { ...c, ...channel } : c))
        : [channel, ...state.dmChannels];
      AsyncStorage.setItem(DMS_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
      return {
        dmChannels: updated,
        activeChannel: state.activeChannel?._id === channel._id ? { ...state.activeChannel, ...channel } : state.activeChannel,
      };
    });
  },

  translateMessage: async (messageId, target) => {
    const res = await api.post<{ text: string }>(`/community/messages/${messageId}/translate`, { target });
    if (!res?.text) throw new Error('Could not translate this message.');
    return res.text;
  },

  fetchBlocks: async () => {
    try {
      const res = await api.get<CommunityBlock[]>('/community/blocks');
      if (Array.isArray(res)) set({ blocks: res });
    } catch {}
  },

  blockAuthorOf: async (message) => {
    const res = await api.post<CommunityBlock>(`/community/messages/${message._id}/block`, {});
    if (!res?.id) throw new Error('Could not block this member.');
    // Hide what they already wrote; an anonymous author is hidden by message since their id is never shown.
    set((state) => ({
      blocks: state.blocks.some((b) => b.id === res.id) ? state.blocks : [res, ...state.blocks],
      messages: state.messages.filter((m) => m._id !== message._id && (!res.userId || m.senderId !== res.userId)),
    }));
  },

  unblock: async (blockId) => {
    await api.delete(`/community/blocks/${blockId}`);
    set((state) => ({ blocks: state.blocks.filter((b) => b.id !== blockId) }));
  },

  reportMessage: async (messageId, reason, note) => {
    await api.post(`/community/messages/${messageId}/report`, { reason, note });
  },

  fetchReports: async (serverId) => {
    try {
      const res = await api.get<CommunityReportItem[]>(`/community/servers/${serverId}/reports`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  resolveReport: async (reportId, action) => {
    await api.post(`/community/reports/${reportId}/resolve`, { action });
  },

  setModerator: async (serverId, userId, isMod) => {
    const res = await api.post<{ modIds: string[] }>(`/community/servers/${serverId}/moderators`, { userId, isMod });
    if (res?.modIds) {
      const apply = (s: ICommunityServer) => (s._id === serverId ? { ...s, modIds: res.modIds } : s);
      const active = get().activeServer;
      set({ servers: get().servers.map(apply), activeServer: active ? apply(active) : active });
    }
  },

  fetchServerMembers: async (serverId) => {
    try {
      const res = await api.get<CommunityMember[]>(`/community/servers/${serverId}/members`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
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

  fetchOlderMessages: async (channelId: string) => {
    const oldest = get().messages.find((m) => !m._id.startsWith('temp_'));
    if (!oldest) return 0;
    try {
      const res = await api.get<ICommunityMessage[]>(
        `/community/channels/${channelId}/messages?before=${encodeURIComponent(oldest.createdAt)}`
      );
      if (res && Array.isArray(res) && res.length > 0) {
        const known = new Set(get().messages.map((m) => m._id));
        const fresh = res.filter((m) => !known.has(m._id));
        set({ messages: [...fresh, ...get().messages] });
        return fresh.length;
      }
    } catch {}
    return 0;
  },

  sendMessage: async (channelId, content, embedType, embedData, audioUrl, audioDurationSeconds, mentions, audioMediaId, contentWarning) => {
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
      contentWarning,
      mentions: mentions || [],
      audioUrl,
      audioDurationSeconds,
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
          contentWarning,
          isAnonymous,
          senderDisplayName: isAnonymous ? 'Anonymous Spoonie' : 'You',
          senderAvatarEmoji: isAnonymous ? '🥄' : '🌟',
          senderRoleColor: isAnonymous ? '#94A3B8' : '#38BDF8',
          senderRoleBadges: isAnonymous ? ['Anonymous Spoonie'] : ['Community Member'],
          mentions,
          audioUrl,
          audioMediaId,
          audioDurationSeconds,
          replyTo: replyingTo ? { ...replyingTo } : undefined,
          embedType,
          embedData,
        }
      );

      if (serverMsg && serverMsg._id) {
        // The live socket event can arrive before this response; never keep the message twice.
        const already = get().messages.some((m) => m._id === serverMsg._id);
        const finalized = already
          ? get().messages.filter((m) => m._id !== tempId)
          : get().messages.map((m) => (m._id === tempId ? serverMsg : m));
        set({ messages: finalized });
        await AsyncStorage.setItem(
          `${MESSAGES_CACHE_KEY}:${channelId}`,
          JSON.stringify(finalized)
        );

        // Update lastMessage for DM channels
        set((state) => {
          const isDm = state.dmChannels.some((c) => c._id === channelId || c.slug === channelId);
          if (!isDm) return state;
          let snippet = serverMsg.content || '';
          if (serverMsg.embedType === 'note') snippet = `Shared a note: ${serverMsg.embedData?.note?.title || 'Note'}`;
          else if (serverMsg.embedType === 'todo_list') snippet = `Shared a task list: ${serverMsg.embedData?.todo?.listName || 'List'}`;
          else if (serverMsg.embedType === 'log_template') snippet = `Shared a template: ${serverMsg.embedData?.logTemplate?.title || 'Template'}`;
          else if (serverMsg.embedType === 'photo') snippet = 'Shared a photo';

          const updatedDms = state.dmChannels.map((c) =>
            c._id === channelId || c.slug === channelId
              ? {
                  ...c,
                  lastMessage: {
                    _id: serverMsg._id,
                    content: snippet,
                    senderId: serverMsg.senderId,
                    senderDisplayName: serverMsg.senderDisplayName,
                    isSelf: true,
                    createdAt: serverMsg.createdAt,
                  },
                }
              : c
          );
          AsyncStorage.setItem(DMS_CACHE_KEY, JSON.stringify(updatedDms)).catch(() => {});
          return { dmChannels: updatedDms };
        });

        return serverMsg;
      }
    } catch (err) {
      // Blocked by AutoMod, timed out, or offline: take the pending bubble back and tell the caller.
      const rolledBack = get().messages.filter((m) => m._id !== tempId);
      set({ messages: rolledBack });
      AsyncStorage.setItem(`${MESSAGES_CACHE_KEY}:${channelId}`, JSON.stringify(rolledBack)).catch(() => {});
      throw err;
    }

    return optimisticMsg;
  },

  editMessage: async (channelId: string, messageId: string, content: string) => {
    // Optimistic update
    set((state) => ({
      messages: state.messages.map((m) =>
        m._id === messageId ? { ...m, content, isEdited: true, editedAt: new Date().toISOString() } : m
      ),
    }));

    try {
      const res = await api.patch<ICommunityMessage>(
        `/community/channels/${channelId}/messages/${messageId}`,
        { content }
      );
      if (res && res._id) {
        set((state) => ({
          messages: state.messages.map((m) => (m._id === messageId ? res : m)),
        }));
      }
    } catch (err: any) {
      get().fetchMessages(channelId);
      throw err;
    }
  },

  deleteMessage: async (channelId: string, messageId: string) => {
    set((state) => ({
      messages: state.messages.filter((m) => m._id !== messageId),
      pinnedMessages: {
        ...state.pinnedMessages,
        [channelId]: (state.pinnedMessages[channelId] || []).filter((p) => p._id !== messageId),
      },
    }));

    try {
      await api.delete(`/community/channels/${channelId}/messages/${messageId}`);
    } catch (err: any) {
      get().fetchMessages(channelId);
      throw err;
    }
  },

  togglePinMessage: async (channelId: string, messageId: string) => {
    try {
      const res = await api.post<ICommunityMessage>(
        `/community/channels/${channelId}/messages/${messageId}/pin`,
        {}
      );
      if (res && res._id) {
        set((state) => {
          const updatedMessages = state.messages.map((m) => (m._id === messageId ? res : m));
          const currentPins = state.pinnedMessages[channelId] || [];
          const updatedPins = res.isPinned
            ? [res, ...currentPins.filter((p) => p._id !== messageId)]
            : currentPins.filter((p) => p._id !== messageId);
          return {
            messages: updatedMessages,
            pinnedMessages: { ...state.pinnedMessages, [channelId]: updatedPins },
          };
        });
      }
    } catch {}
  },

  fetchPinnedMessages: async (channelId: string) => {
    try {
      const res = await api.get<ICommunityMessage[]>(`/community/channels/${channelId}/pins`);
      if (res && Array.isArray(res)) {
        set((state) => ({
          pinnedMessages: { ...state.pinnedMessages, [channelId]: res },
        }));
      }
    } catch {}
  },

  markChannelAsRead: async (channelId: string, lastReadMessageId?: string) => {
    set((state) => ({
      readStates: {
        ...state.readStates,
        [channelId]: lastReadMessageId || '',
      },
    }));
    // The channel list badge clears as soon as the channel is read.
    set((state) => ({
      channels: state.channels.map((c) =>
        c._id === channelId || c.slug === channelId ? { ...c, unreadCount: 0 } : c
      ),
    }));
    try {
      await api.post(`/community/channels/${channelId}/read`, { lastReadMessageId });
    } catch {}
  },

  fetchReadState: async (channelId: string) => {
    try {
      const res = await api.get<{ lastReadMessageId?: string }>(`/community/channels/${channelId}/read`);
      if (res && res.lastReadMessageId) {
        set((state) => ({
          readStates: { ...state.readStates, [channelId]: res.lastReadMessageId! },
        }));
        return res.lastReadMessageId;
      }
    } catch {}
    return undefined;
  },

  fetchDms: async () => {
    try {
      const cached = await AsyncStorage.getItem(DMS_CACHE_KEY);
      if (cached) set({ dmChannels: JSON.parse(cached) });
    } catch {}
    try {
      const res = await api.get<ICommunityChannel[]>('/community/dms');
      if (res && Array.isArray(res)) {
        // Enrich any DM channel whose lastMessage was not populated by the server
        const enriched = await Promise.all(
          res.map(async (channel) => {
            if (channel.lastMessage) return channel;
            try {
              const msgs = await api.get<ICommunityMessage[]>(
                `/community/channels/${channel._id}/messages?limit=1`
              );
              if (msgs && Array.isArray(msgs) && msgs.length > 0) {
                const lm = msgs[0];
                const meId = useAuthStore.getState().user?._id;
                let snippet = lm.content || '';
                if (lm.embedType === 'note') snippet = `Shared a note: ${lm.embedData?.note?.title || 'Note'}`;
                else if (lm.embedType === 'todo_list') snippet = `Shared a task list: ${lm.embedData?.todo?.listName || 'List'}`;
                else if (lm.embedType === 'log_template') snippet = `Shared a template: ${lm.embedData?.logTemplate?.title || 'Template'}`;
                else if (lm.embedType === 'photo') snippet = 'Shared a photo';

                return {
                  ...channel,
                  lastMessage: {
                    _id: lm._id,
                    content: snippet,
                    senderId: lm.senderId,
                    senderDisplayName: lm.senderDisplayName,
                    isSelf: Boolean(meId && String(lm.senderId) === String(meId)),
                    createdAt: lm.createdAt,
                  },
                };
              }
            } catch {}
            return channel;
          })
        );
        set({ dmChannels: enriched });
        await AsyncStorage.setItem(DMS_CACHE_KEY, JSON.stringify(enriched));
      }
    } catch {}
  },

  createOrGetDm: async (targetUserId: string) => {
    const res = await api.post<ICommunityChannel>('/community/dms', { targetUserId });
    if (res && res._id) {
      set((state) => {
        const exists = state.dmChannels.some((c) => c._id === res._id);
        const updated = exists
          ? state.dmChannels.map((c) => (c._id === res._id ? res : c))
          : [res, ...state.dmChannels];
        AsyncStorage.setItem(DMS_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
        return { dmChannels: updated };
      });
      return res;
    }
    throw new Error('Failed to create DM channel');
  },

  timeoutMember: async (serverId: string, userId: string, durationMinutes = 60, reason?: string) => {
    await api.post(`/community/servers/${serverId}/timeout`, { userId, durationMinutes, reason });
  },

  setupSocketListeners: () => {
    const unsubCreated = communitySocket.onMessageCreated(({ channelId, message }) => {
      const activeCh = get().activeChannel;
      if (activeCh && (activeCh._id === channelId || activeCh.slug === channelId)) {
        set((state) => {
          if (state.blocks.some((b) => b.userId && b.userId === message.senderId)) return state;
          const exists = state.messages.some((m) => m._id === message._id);
          if (exists) return state;
          return { messages: [...state.messages, message] };
        });
      }

      // Update lastMessage and unread count in dmChannels if this message is in a DM
      const meId = useAuthStore.getState().user?._id;
      let snippet = message.content || '';
      if (message.embedType === 'note') snippet = `Shared a note: ${message.embedData?.note?.title || 'Note'}`;
      else if (message.embedType === 'todo_list') snippet = `Shared a task list: ${message.embedData?.todo?.listName || 'List'}`;
      else if (message.embedType === 'log_template') snippet = `Shared a template: ${message.embedData?.logTemplate?.title || 'Template'}`;
      else if (message.embedType === 'photo') snippet = 'Shared a photo';

      set((state) => {
        const isDm = state.dmChannels.some((c) => c._id === channelId || c.slug === channelId);
        if (!isDm) return state;
        const updatedDms = state.dmChannels.map((c) => {
          if (c._id !== channelId && c.slug !== channelId) return c;
          const isCurrentActive = activeCh && (activeCh._id === c._id || activeCh.slug === c.slug);
          return {
            ...c,
            lastMessage: {
              _id: message._id,
              content: snippet,
              senderId: message.senderId,
              senderDisplayName: message.senderDisplayName,
              isSelf: Boolean(meId && String(message.senderId) === String(meId)),
              createdAt: message.createdAt,
            },
            unreadCount: isCurrentActive ? 0 : (c.unreadCount || 0) + 1,
          };
        });
        AsyncStorage.setItem(DMS_CACHE_KEY, JSON.stringify(updatedDms)).catch(() => {});
        return { dmChannels: updatedDms };
      });
    });

    const unsubUpdated = communitySocket.onMessageUpdated(({ channelId, message }) => {
      set((state) => ({
        messages: state.messages.map((m) => (m._id === message._id ? { ...m, ...message } : m)),
        pinnedMessages: {
          ...state.pinnedMessages,
          [channelId]: (state.pinnedMessages[channelId] || []).map((p) =>
            p._id === message._id ? { ...p, ...message } : p
          ),
        },
      }));
    });

    const unsubDeleted = communitySocket.onMessageDeleted(({ channelId, messageId }) => {
      set((state) => ({
        messages: state.messages.filter((m) => m._id !== messageId),
        pinnedMessages: {
          ...state.pinnedMessages,
          [channelId]: (state.pinnedMessages[channelId] || []).filter((p) => p._id !== messageId),
        },
      }));
    });

    const unsubReaction = communitySocket.onReactionUpdated(({ channelId, messageId, reactions, userReactions }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === messageId
            ? { ...m, reactions, ...(userReactions ? { userReactions } : {}) }
            : m
        ),
      }));
    });

    const unsubTyping = communitySocket.onUserTyping(({ channelId, displayName, isTyping }) => {
      set((state) => {
        const currentList = state.typingUsers[channelId] || [];
        const name = displayName || 'Someone';
        let updatedList: string[];
        if (isTyping) {
          updatedList = currentList.includes(name) ? currentList : [...currentList, name];
        } else {
          updatedList = currentList.filter((n) => n !== name);
        }
        return {
          typingUsers: {
            ...state.typingUsers,
            [channelId]: updatedList,
          },
        };
      });
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
      unsubReaction();
      unsubTyping();
    };
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
      // No invented profile: the caller simply gets nothing.
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

  sendThreadReply: async (parentMessageId: string, content: string, opts) => {
    const parent = get().activeThreadParent;
    if (!parent) return;

    // Replies in a thread are replies to the parent message, so the thread actually lists them.
    set({
      replyingTo: {
        messageId: parent._id,
        senderDisplayName: parent.senderDisplayName,
        snippet: parent.content || 'Shared something',
      },
    });
    try {
      if (opts?.photoUri) {
        const up = await uploadMedia(opts.photoUri, opts.photoMimeType || 'image/jpeg');
        await get().sendMessage(
          parent.channelId, '', 'photo',
          { photoMediaId: up.mediaId, photoUrl: opts.photoUri, caption: content || undefined },
          undefined, undefined, undefined, undefined, opts.contentWarning,
        );
      } else {
        await get().sendMessage(parent.channelId, content, undefined, undefined, undefined, undefined, undefined, undefined, opts?.contentWarning);
      }
    } finally {
      set({ replyingTo: null });
    }
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

  createForumPost: async (channelId, title, tags, content, embedType, embedData, contentWarning) => {
    const isAnonymous = get().isAnonymous;
    const res = await api.post<IForumPost>(`/community/forums/${channelId}/posts`, {
      channelId,
      title,
      tags,
      content,
      contentWarning,
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
    const newNote = await useNoteStore.getState().createNote({
      title: embed.title,
      icon: embed.icon || '📝',
      coverGradient: embed.coverGradient,
      tags: [...(embed.tags || []), 'Community Shared'],
      blocks: JSON.parse(JSON.stringify(embed.blocksFull || [])),
    });

    if (messageId && !messageId.startsWith('temp_')) {
      api.post(`/community/messages/${messageId}/clone`, {}).catch(() => {});
    }

    return newNote;
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

    return list;
  },

  cloneLogTemplateToPersonal: async (_embed, messageId) => {
    if (!messageId || messageId.startsWith('temp_')) throw new Error('Wait for the message to finish sending, then try again.');
    const res = await api.post<{ draftId: string }>(`/community/messages/${messageId}/install-template`, {});
    if (!res?.draftId) throw new Error('Could not read this template.');
    return res.draftId;
  },
}));
