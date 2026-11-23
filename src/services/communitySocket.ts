import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { ICommunityMessage } from '../shared/types';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  extra.apiUrl ||
  'http://localhost:3000/api/v1';

const SOCKET_URL = BASE_URL.replace(/\/api\/v1\/?$/, '');

class CommunitySocketService {
  private socket: Socket | null = null;
  private currentJoinedChannelId: string | null = null;
  private lastAppState: 'active' | 'background' = 'active';

  async initSocket(): Promise<Socket> {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    let token: string | null = null;
    try {
      if (Platform.OS === 'web') {
        token = localStorage.getItem('lumen_access_token');
      } else {
        token = await SecureStore.getItemAsync('lumen_access_token');
      }
    } catch {}

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: {
        token,
      },
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      this.socket?.emit('app_state', { state: this.lastAppState });
      if (this.currentJoinedChannelId) {
        this.socket?.emit('join_channel', { channelId: this.currentJoinedChannelId });
      }
    });

    return this.socket;
  }

  joinChannel(channelId: string) {
    this.currentJoinedChannelId = channelId;
    if (this.socket) {
      this.socket.emit('join_channel', { channelId });
    } else {
      this.initSocket().then((s) => s.emit('join_channel', { channelId }));
    }
  }

  leaveChannel(channelId: string) {
    if (this.currentJoinedChannelId === channelId) {
      this.currentJoinedChannelId = null;
    }
    if (this.socket) {
      this.socket.emit('leave_channel', { channelId });
    }
  }

  sendTypingStart(channelId: string, displayName?: string) {
    if (this.socket) {
      this.socket.emit('typing_start', { channelId, displayName });
    }
  }

  sendTypingStop(channelId: string) {
    if (this.socket) {
      this.socket.emit('typing_stop', { channelId });
    }
  }

  onMessageCreated(handler: (data: { channelId: string; message: ICommunityMessage }) => void) {
    if (!this.socket) this.initSocket();
    this.socket?.on('message_created', handler);
    return () => {
      this.socket?.off('message_created', handler);
    };
  }

  onMessageUpdated(handler: (data: { channelId: string; message: ICommunityMessage }) => void) {
    if (!this.socket) this.initSocket();
    this.socket?.on('message_updated', handler);
    return () => {
      this.socket?.off('message_updated', handler);
    };
  }

  onMessageDeleted(handler: (data: { channelId: string; messageId: string }) => void) {
    if (!this.socket) this.initSocket();
    this.socket?.on('message_deleted', handler);
    return () => {
      this.socket?.off('message_deleted', handler);
    };
  }

  onReactionUpdated(
    handler: (data: {
      channelId: string;
      messageId: string;
      reactions: Record<string, number>;
      userReactions?: string[];
    }) => void
  ) {
    if (!this.socket) this.initSocket();
    this.socket?.on('reaction_updated', handler);
    return () => {
      this.socket?.off('reaction_updated', handler);
    };
  }

  onUserTyping(
    handler: (data: {
      channelId: string;
      userId: string;
      displayName?: string;
      isTyping: boolean;
    }) => void
  ) {
    if (!this.socket) this.initSocket();
    this.socket?.on('user_typing', handler);
    return () => {
      this.socket?.off('user_typing', handler);
    };
  }

  onReceiptUpdated(handler: (data: { channelId: string; userId: string; lastDeliveredMessageId?: string; lastReadMessageId?: string; at?: string }) => void) {
    if (!this.socket) this.initSocket();
    this.socket?.on('receipt_updated', handler);
    return () => {
      this.socket?.off('receipt_updated', handler);
    };
  }

  onPresence(handler: (data: { userId: string; online: boolean; lastSeenAt: string | null }) => void) {
    if (!this.socket) this.initSocket();
    this.socket?.on('presence', handler);
    return () => {
      this.socket?.off('presence', handler);
    };
  }

  /** Tells the server whether the app is on screen, so a chat that is open is not also pushed. */
  sendAppState(state: 'active' | 'background') {
    this.lastAppState = state;
    this.socket?.emit('app_state', { state });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentJoinedChannelId = null;
    }
  }
}

export const communitySocket = new CommunitySocketService();

