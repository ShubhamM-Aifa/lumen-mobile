import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import {
  Hash,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Bookmark,
  Volume2,
  Lock,
  Search,
  Plus,
  UserPlus,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ICommunityChannel, ICommunityServer } from '../../shared/types';
import { useCommunityStore } from '../../store/communityStore';
import { useAuthStore } from '../../store/authStore';
import { InviteCommunityModal } from './InviteCommunityModal';
import { AppleSwitch } from '../common/AppleSwitch';
import { ModularAvatar } from '../avatar/ModularAvatar';
import { getDeterministicAvatarConfig } from '../../store/avatarStore';
import { LumenIcon } from '../common/LumenLogo';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

interface Props {
  channels: ICommunityChannel[];
  activeServer?: ICommunityServer | null;
  activeChannelId?: string;
  isDmsMode?: boolean;
  hideHeader?: boolean;
  hideFooter?: boolean;
  contentBottomPadding?: number;
  onSelectChannel: (channel: ICommunityChannel) => void;
  onOpenSearch?: () => void;
  onPressAddChannel?: () => void;
  onPressNewMessage?: () => void;
}

const AVATAR_COLORS = [
  '#5856D6', // Purple (like Morning Robin in design)
  '#FF9500', // Orange (like Steady Banyan in design)
  '#30B0C7', // Teal (like Calm Koel in design)
  '#34C759', // Green (like JP in design)
  '#0066CC', // Blue
  '#AF52DE', // Lavender
  '#FF2D55', // Pink
];

function getAvatarBgColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export const DiscordChannelDrawer: React.FC<Props> = ({
  channels,
  activeServer,
  activeChannelId,
  isDmsMode = false,
  hideHeader = true,
  hideFooter = false,
  contentBottomPadding,
  onSelectChannel,
  onOpenSearch,
  onPressAddChannel,
  onPressNewMessage,
}) => {
  const { palette } = useTheme();
  const { user } = useAuthStore();
  const meId = user?._id;
  const { collapsedCategories, toggleCategoryCollapsed, isAnonymous, toggleAnonymous, typingUsers } =
    useCommunityStore();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [showRequestsOnly, setShowRequestsOnly] = useState(false);

  // Filter DMs
  const pendingRequests = React.useMemo(() => {
    return channels.filter(
      (c) => c.type === 'dm' && c.dmStatus === 'pending' && c.dmInitiatorId !== meId
    );
  }, [channels, meId]);

  const displayedDms = React.useMemo(() => {
    if (showRequestsOnly) return pendingRequests;
    return channels.filter((c) => c.type === 'dm' && c.dmStatus !== 'declined');
  }, [channels, showRequestsOnly, pendingRequests]);

  // Group channels by category (for Server mode)
  const categories = React.useMemo(() => {
    const map = new Map<string, ICommunityChannel[]>();
    for (const channel of channels) {
      if (channel.type === 'dm') continue;
      const cat = channel.category || 'CHANNELS';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(channel);
    }
    return Array.from(map.entries());
  }, [channels]);

  const renderChannelIcon = (type: string, color: string) => {
    if (type === 'forum') {
      return <Bookmark size={15} color={color} style={styles.channelIcon} />;
    }
    if (type === 'announcement') {
      return <Volume2 size={15} color={color} style={styles.channelIcon} />;
    }
    if (type === 'dm') {
      return <MessageSquare size={15} color={color} style={styles.channelIcon} />;
    }
    return <Hash size={16} color={color} style={styles.channelIcon} />;
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      {/* Discord Server Header - only shown if hideHeader is false */}
      {!hideHeader && (
        <View style={[styles.serverHeader, { borderBottomColor: '#38383A' }]}>
          <View style={styles.serverTitleRow}>
            <View style={[styles.serverBadge, { backgroundColor: isDmsMode ? palette.primary : (activeServer?.color || palette.primary) }]}>
              <Text style={{ fontSize: 18 }}>{isDmsMode ? '💬' : (activeServer?.icon || '🌟')}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.serverName, { color: '#FFFFFF' }]} numberOfLines={1}>
                {isDmsMode ? 'Direct Messages' : (activeServer?.name || 'Lumen Community Hub')}
              </Text>
              <View style={styles.serverMetaRow}>
                <View style={styles.onlineDot} />
                <Text style={[styles.serverMetaText, { color: '#98989F' }]}>
                  {isDmsMode
                    ? `${channels.length} ${channels.length === 1 ? 'Conversation' : 'Conversations'}`
                    : `${activeServer?.membersCount || 1} ${activeServer?.membersCount === 1 ? 'Member' : 'Members'}`}
                </Text>
              </View>
            </View>
            {!isDmsMode && (
              <>
                <TouchableOpacity
                  onPress={() => setInviteModalVisible(true)}
                  style={styles.searchBtn}
                  accessibilityLabel="Invite friends to community"
                >
                  <UserPlus size={18} color={palette.textSecondary} />
                </TouchableOpacity>
                {onPressAddChannel && (
                  <TouchableOpacity onPress={onPressAddChannel} style={styles.searchBtn} accessibilityLabel="Create new channel">
                    <Plus size={18} color={palette.textSecondary} />
                  </TouchableOpacity>
                )}
              </>
            )}
            {onOpenSearch && (
              <TouchableOpacity onPress={onOpenSearch} style={styles.searchBtn} accessibilityLabel="Search channels">
                <Search size={18} color={palette.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Main Content Area */}
      {isDmsMode ? (
        <ScrollView
          style={styles.scrollList}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 12, paddingBottom: contentBottomPadding ?? 20, gap: 6 }}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Message requests banner (matching docs/design/Messages.html & Image 1) - only shown when there are pending requests */}
          {pendingRequests.length > 0 && (
            <TouchableOpacity
              style={styles.msgRequestsBanner}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowRequestsOnly(!showRequestsOnly);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Message requests, ${pendingRequests.length} request`}
            >
              <View style={styles.msgRequestsIconWrap}>
                <UserPlus size={18} color="#F59E0B" />
              </View>
              <Text style={styles.msgRequestsTitle}>Message requests</Text>
              <View style={styles.msgRequestsBadge}>
                <Text style={styles.msgRequestsBadgeText}>
                  {`${pendingRequests.length} ${pendingRequests.length === 1 ? 'Request' : 'Requests'}`}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* 2. Conversations Header */}
          <Text style={styles.conversationsHeader}>
            {showRequestsOnly ? 'MESSAGE REQUESTS' : 'CONVERSATIONS'}
          </Text>

          {/* 3. Conversations List */}
          {displayedDms.length === 0 ? (
            <View style={styles.emptyDmsBox}>
              <Text style={styles.emptyDmsText}>
                {showRequestsOnly ? 'No pending message requests' : 'No conversations yet'}
              </Text>
              {onPressNewMessage && !showRequestsOnly && (
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: palette.primary, marginTop: 10 }]}
                  onPress={onPressNewMessage}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyBtnText}>Start Conversation</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            displayedDms.map((channel) => {
              const isActive = channel._id === activeChannelId;
              const isGroup = !!channel.isGroup;
              const displayName = isGroup
                ? channel.name || 'Group chat'
                : channel.dmUser?.displayName ||
                  (channel.name && !channel.name.startsWith('dm-') ? channel.name : 'Direct Message');
              const isOnline = !isGroup && (channel.dmUser?.isOnline ?? true);
              const lastMsg = channel.lastMessage;
              const hasUnread = Boolean(channel.unreadCount && channel.unreadCount > 0);

              return (
                <TouchableOpacity
                  key={channel._id}
                  onPress={() => onSelectChannel(channel)}
                  style={[styles.dmCard, isActive && styles.dmCardActive]}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`${displayName}, ${lastMsg?.content || ''}`}
                >
                  {/* 40x40 Avatar with ModularAvatar DP and green online dot */}
                  <View style={styles.dmAvatarWrap}>
                    <View style={styles.dmAvatar}>
                      {isGroup && channel.photoUrl ? (
                        <Image source={{ uri: channel.photoUrl }} style={[styles.dmAvatar, { borderRadius: 20 }]} accessibilityElementsHidden />
                      ) : isGroup ? (
                        <View style={[styles.dmAvatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#8B5CF633' }]} accessibilityElementsHidden>
                          <Text style={{ fontSize: 20 }}>👥</Text>
                        </View>
                      ) : (
                        <ModularAvatar
                          size={40}
                          animated={false}
                          showAura={false}
                          config={getDeterministicAvatarConfig(
                            channel.dmUser?._id || channel.dmUser?.displayName || channel.name
                          )}
                        />
                      )}
                    </View>
                    {isOnline && <View style={styles.onlineDotIndicator} />}
                  </View>

                  {/* Name + last message preview */}
                  <View style={styles.dmContent}>
                    <Text style={styles.dmName} numberOfLines={1}>
                      {displayName}{isGroup && channel.muted ? '  🔕' : ''}
                    </Text>
                    <Text
                      style={[styles.dmSnippet, hasUnread && styles.dmSnippetUnread]}
                      numberOfLines={1}
                    >
                      {typingUsers[channel._id]?.length
                        ? (isGroup ? `${typingUsers[channel._id].join(', ')} typing…` : 'typing…')
                        : lastMsg
                        ? `${lastMsg.isSelf ? 'You: ' : isGroup && lastMsg.senderDisplayName ? `${lastMsg.senderDisplayName}: ` : ''}${lastMsg.content}`
                        : isGroup ? `${(channel.groupMembers ?? []).length} people` : `Say hello to ${displayName}`}
                    </Text>
                  </View>

                  {/* Unread badge or Request pill */}
                  {channel.dmStatus === 'pending' && channel.dmInitiatorId !== meId ? (
                    <View style={styles.requestPill}>
                      <Text style={styles.requestPillText}>Request</Text>
                    </View>
                  ) : hasUnread ? (
                    <View style={styles.dmUnreadBadge}>
                      <Text style={styles.dmUnreadBadgeText}>{channel.unreadCount}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}

          {/* 4. Privacy Notice */}
          <View style={styles.privacyNotice}>
            <Lock size={15} color="#34C759" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <Text style={styles.privacyNoticeText}>
              Your logs are only shared when you attach them.
            </Text>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      ) : channels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Hash size={36} color={palette.textSecondary} />
          <Text style={[styles.emptyTitle, { color: '#FFFFFF' }]}>No Channels Yet</Text>
          <Text style={[styles.emptySubtitle, { color: '#98989F' }]}>
            Create the first channel in this community to start chatting.
          </Text>
          {onPressAddChannel && (
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: palette.primary }]}
              onPress={onPressAddChannel}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyBtnText}>Create Channel</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scrollList}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 12, paddingBottom: contentBottomPadding ?? 20, gap: 6 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Active Server Card at top of channel list (matching docs/design/Community.html & Image 1 Left) */}
          {activeServer && (
            <View style={styles.serverCard}>
              <View style={[styles.serverCardIcon, { backgroundColor: activeServer.color || '#0066CC' }]}>
                {activeServer.isOfficial ? (
                  <LumenIcon size={20} />
                ) : activeServer.icon && activeServer.icon.length <= 4 && /[\u{1F300}-\u{1FAFF}]/u.test(activeServer.icon) ? (
                  <Text style={{ fontSize: 18 }}>{activeServer.icon}</Text>
                ) : (
                  <LumenIcon size={20} />
                )}
              </View>
              <View style={styles.serverCardInfo}>
                <Text style={styles.serverCardTitle} numberOfLines={1}>
                  {activeServer.name || 'Lumen Community Hub'}
                </Text>
                <View style={styles.serverOnlineRow}>
                  <View style={styles.onlineDotMini} />
                  <Text style={styles.serverOnlineText}>
                    {`${activeServer.membersCount || 1} online`}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Categories and Channels */}
          {categories.map(([categoryName, groupChannels]) => {
            const isCollapsed = Boolean(collapsedCategories[categoryName]);

            return (
              <View key={categoryName} style={styles.categoryBlock}>
                <TouchableOpacity
                  onPress={() => toggleCategoryCollapsed(categoryName)}
                  style={styles.categoryHeader}
                  activeOpacity={0.7}
                >
                  {isCollapsed ? (
                    <ChevronRight size={13} color="#98989F" />
                  ) : (
                    <ChevronDown size={13} color="#98989F" />
                  )}
                  <Text style={styles.categoryTitle}>
                    {categoryName}
                  </Text>
                </TouchableOpacity>

                {!isCollapsed &&
                  groupChannels.map((channel) => {
                    const isActive = channel._id === activeChannelId;

                    return (
                      <TouchableOpacity
                        key={channel._id}
                        onPress={() => onSelectChannel(channel)}
                        style={[
                          styles.channelRow,
                          isActive && styles.channelRowActive,
                        ]}
                        activeOpacity={0.75}
                      >
                        {renderChannelIcon(
                          channel.type,
                          isActive ? '#FFFFFF' : '#98989F'
                        )}
                        <Text
                          style={[
                            styles.channelName,
                            {
                              color: isActive ? '#FFFFFF' : '#98989F',
                              fontWeight: isActive ? '700' : '500',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {channel.slug || channel.name}
                        </Text>

                        {channel.type === 'forum' && (
                          <View style={styles.forumPill}>
                            <Text style={styles.forumPillText}>Forum</Text>
                          </View>
                        )}

                        {Boolean(channel.unreadCount && channel.unreadCount > 0) && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{channel.unreadCount}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            );
          })}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* Bottom User Bar */}
      {!hideFooter && (
        <View style={[styles.userBar, { backgroundColor: '#1C1C1E', borderTopColor: '#38383A' }]}>
          <View style={styles.userInfoRow}>
            <TouchableOpacity
              style={styles.userProfileBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/settings');
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Open profile settings"
            >
              <View
                style={[
                  styles.userAvatar,
                  {
                    backgroundColor: isAnonymous ? '#475569' : `${palette.primary}18`,
                    borderColor: isAnonymous ? '#64748B' : `${palette.primary}40`,
                  },
                ]}
              >
                {isAnonymous ? (
                  <Text style={{ fontSize: 18 }}>🥄</Text>
                ) : (
                  <ModularAvatar size={36} animated={false} />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.userName, { color: '#FFFFFF' }]} numberOfLines={1}>
                  {isAnonymous ? 'Anonymous Spoonie' : (user?.name || 'You')}
                </Text>
                <Text style={[styles.userTag, { color: '#98989F' }]}>
                  {isAnonymous ? 'Incognito Mode' : 'Online • Resting 🥄'}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={{ alignItems: 'flex-end', gap: 3, marginLeft: 8 }}>
              <AppleSwitch
                size="small"
                value={isAnonymous}
                onValueChange={toggleAnonymous}
                activeColor="#6366F1"
                accessibilityLabel="Anonymous Mode Toggle"
              />
              <Text style={{ fontSize: 10, fontWeight: '700', color: isAnonymous ? '#818CF8' : palette.textDisabled }}>
                {isAnonymous ? 'Anon ON' : 'Anon OFF'}
              </Text>
            </View>
          </View>
        </View>
      )}

      <InviteCommunityModal
        visible={inviteModalVisible}
        server={activeServer || null}
        onClose={() => setInviteModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  serverHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  serverTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serverName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  serverMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  serverMetaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  searchBtn: {
    padding: 8,
    borderRadius: 8,
  },
  scrollList: {
    flex: 1,
  },
  // Message requests banner
  msgRequestsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.12)',
    marginBottom: 4,
  },
  msgRequestsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,158,11,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgRequestsTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  msgRequestsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245,158,11,0.18)',
  },
  msgRequestsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  // Conversations Header
  conversationsHeader: {
    marginHorizontal: 8,
    marginTop: 10,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#98989F',
    textTransform: 'uppercase',
  },
  // DM Card
  dmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  dmCardActive: {
    backgroundColor: '#2C2C2E',
  },
  dmAvatarWrap: {
    position: 'relative',
    width: 40,
    height: 40,
    flexShrink: 0,
  },
  dmAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDotIndicator: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#10B981',
    zIndex: 2,
  },
  dmContent: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  dmName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dmSnippet: {
    fontSize: 13,
    color: '#98989F',
  },
  dmSnippetUnread: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dmUnreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#0066CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dmUnreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  requestPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  requestPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  // Privacy notice
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 8,
    marginTop: 12,
  },
  privacyNoticeText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#98989F',
    flex: 1,
  },
  emptyDmsBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDmsText: {
    fontSize: 14,
    color: '#98989F',
    textAlign: 'center',
  },
  // Active Server Card
  serverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    marginBottom: 4,
  },
  serverCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverCardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  serverCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  serverOnlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDotMini: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  serverOnlineText: {
    fontSize: 12,
    color: '#98989F',
  },
  // Categories & Channels
  categoryBlock: {
    marginBottom: 10,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#98989F',
    textTransform: 'uppercase',
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    minHeight: 40,
    borderRadius: 10,
    marginVertical: 1,
    gap: 8,
  },
  channelRowActive: {
    backgroundColor: '#2C2C2E',
  },
  channelIcon: {
    marginRight: 0,
  },
  channelName: {
    flex: 1,
    fontSize: 15,
  },
  forumPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,102,204,0.25)',
  },
  forumPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0A84FF',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#0066CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  userBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userProfileBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
  },
  userTag: {
    fontSize: 11,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
