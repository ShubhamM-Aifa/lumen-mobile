import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Hash,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Bookmark,
  Volume2,
  ShieldCheck,
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
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

interface Props {
  channels: ICommunityChannel[];
  activeServer?: ICommunityServer | null;
  activeChannelId?: string;
  isDmsMode?: boolean;
  hideHeader?: boolean;
  onSelectChannel: (channel: ICommunityChannel) => void;
  onOpenSearch?: () => void;
  onPressAddChannel?: () => void;
  onPressNewMessage?: () => void;
}

export const DiscordChannelDrawer: React.FC<Props> = ({
  channels,
  activeServer,
  activeChannelId,
  isDmsMode = false,
  hideHeader = true,
  onSelectChannel,
  onOpenSearch,
  onPressAddChannel,
  onPressNewMessage,
}) => {
  const { palette } = useTheme();
  const { user } = useAuthStore();
  const meId = user?._id;
  const { collapsedCategories, toggleCategoryCollapsed, isAnonymous, toggleAnonymous } =
    useCommunityStore();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  // Group channels by category
  const categories = React.useMemo(() => {
    const map = new Map<string, ICommunityChannel[]>();
    for (const channel of channels) {
      const cat = channel.category || (isDmsMode ? 'DIRECT MESSAGES' : 'COMMUNITY');
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(channel);
    }
    return Array.from(map.entries());
  }, [channels, isDmsMode]);

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
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Discord Server Header - only shown if hideHeader is false */}
      {!hideHeader && (
        <View style={[styles.serverHeader, { borderBottomColor: palette.border }]}>
          <View style={styles.serverTitleRow}>
            <View style={[styles.serverBadge, { backgroundColor: isDmsMode ? palette.primary : (activeServer?.color || palette.primary) }]}>
              <Text style={{ fontSize: 18 }}>{isDmsMode ? '💬' : (activeServer?.icon || '🌟')}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.serverName, { color: palette.text }]} numberOfLines={1}>
                {isDmsMode ? 'Direct Messages' : (activeServer?.name || 'Lumen Spoonie Hub')}
              </Text>
              <View style={styles.serverMetaRow}>
                <View style={styles.onlineDot} />
                <Text style={[styles.serverMetaText, { color: palette.textSecondary }]}>
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

      {/* Channel Categories & List or Empty State */}
      {channels.length === 0 ? (
        <View style={styles.emptyContainer}>
          {isDmsMode ? (
            <>
              <MessageSquare size={36} color={palette.textSecondary} />
              <Text style={[styles.emptyTitle, { color: palette.text }]}>No Direct Messages</Text>
              <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
                Start a private conversation with a community member.
              </Text>
              {onPressNewMessage && (
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: palette.primary }]}
                  onPress={onPressNewMessage}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyBtnText}>Start Conversation</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <Hash size={36} color={palette.textSecondary} />
              <Text style={[styles.emptyTitle, { color: palette.text }]}>No Channels Yet</Text>
              <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
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
            </>
          )}
        </View>
      ) : (
        <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
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
                  <ChevronRight size={13} color={palette.textSecondary} />
                ) : (
                  <ChevronDown size={13} color={palette.textSecondary} />
                )}
                <Text style={[styles.categoryTitle, { color: palette.textSecondary }]}>
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
                        isActive && {
                          backgroundColor: `${palette.primary}18`,
                        },
                      ]}
                      activeOpacity={0.75}
                    >
                      {channel.type === 'dm' ? (
                        <View style={{ marginRight: 8, borderRadius: 10, overflow: 'hidden' }}>
                          <ModularAvatar
                            size={20}
                            animated={false}
                            config={getDeterministicAvatarConfig(channel.dmUser?._id || channel.dmUser?.displayName || channel.name)}
                          />
                        </View>
                      ) : (
                        renderChannelIcon(
                          channel.type,
                          isActive ? palette.primary : palette.textSecondary
                        )
                      )}
                      <Text
                        style={[
                          styles.channelName,
                          {
                            color: isActive ? palette.text : palette.textSecondary,
                            fontWeight: isActive ? '700' : '500',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {channel.type === 'dm'
                          ? (channel.dmUser?.displayName || (channel.name && !channel.name.startsWith('dm-') ? channel.name : 'Direct Message'))
                          : (channel.slug || channel.name)}
                      </Text>

                      {channel.type === 'forum' && (
                        <View style={[styles.forumPill, { backgroundColor: `${palette.primary}25` }]}>
                          <Text style={[styles.forumPillText, { color: palette.primaryText }]}>Forum</Text>
                        </View>
                      )}

                      {channel.type === 'dm' && channel.dmStatus === 'pending' && channel.dmInitiatorId !== meId && (
                        <View style={[styles.forumPill, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                          <Text style={[styles.forumPillText, { color: '#F59E0B' }]}>Request</Text>
                        </View>
                      )}

                      {Boolean(channel.unreadCount && channel.unreadCount > 0) && (
                        <View style={[styles.unreadBadge, { backgroundColor: palette.primary }]}>
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
      <View style={[styles.userBar, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
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
              <Text style={[styles.userName, { color: palette.text }]} numberOfLines={1}>
                {isAnonymous ? 'Anonymous Spoonie' : (user?.name || 'You')}
              </Text>
              <Text style={[styles.userTag, { color: palette.textSecondary }]}>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  categoryBlock: {
    marginBottom: 14,
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
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    marginVertical: 1,
  },
  channelIcon: {
    marginRight: 8,
  },
  channelName: {
    flex: 1,
    fontSize: 14,
  },
  forumPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  forumPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  unreadBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
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
  anonToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  anonToggleText: {
    fontSize: 11,
    fontWeight: '700',
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
