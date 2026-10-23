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
import { InviteCommunityModal } from './InviteCommunityModal';

interface Props {
  channels: ICommunityChannel[];
  activeServer?: ICommunityServer | null;
  activeChannelId?: string;
  onSelectChannel: (channel: ICommunityChannel) => void;
  onOpenSearch?: () => void;
  onPressAddChannel?: () => void;
}

export const DiscordChannelDrawer: React.FC<Props> = ({
  channels,
  activeServer,
  activeChannelId,
  onSelectChannel,
  onOpenSearch,
  onPressAddChannel,
}) => {
  const { palette } = useTheme();
  const { collapsedCategories, toggleCategoryCollapsed, isAnonymous, toggleAnonymous } =
    useCommunityStore();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  // Group channels by category
  const categories = React.useMemo(() => {
    const map = new Map<string, ICommunityChannel[]>();
    for (const channel of channels) {
      const cat = channel.category || 'COMMUNITY';
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
    return <Hash size={16} color={color} style={styles.channelIcon} />;
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Discord Server Header */}
      <View style={[styles.serverHeader, { borderBottomColor: palette.border }]}>
        <View style={styles.serverTitleRow}>
          <View style={[styles.serverBadge, { backgroundColor: activeServer?.color || palette.primary }]}>
            <Text style={{ fontSize: 18 }}>{activeServer?.icon || '🌟'}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.serverName, { color: palette.text }]} numberOfLines={1}>
              {activeServer?.name || 'Lumen Spoonie Hub'}
            </Text>
            <View style={styles.serverMetaRow}>
              <View style={styles.onlineDot} />
              <Text style={[styles.serverMetaText, { color: palette.textSecondary }]}>
                {activeServer?.membersCount || 1} {activeServer?.membersCount === 1 ? 'Member' : 'Members'}
              </Text>
            </View>
          </View>
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
          {onOpenSearch && (
            <TouchableOpacity onPress={onOpenSearch} style={styles.searchBtn} accessibilityLabel="Search channels">
              <Search size={18} color={palette.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Channel Categories & List */}
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
                      {renderChannelIcon(
                        channel.type,
                        isActive ? palette.primary : palette.textSecondary
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
                        {channel.slug || channel.name}
                      </Text>

                      {channel.type === 'forum' && (
                        <View style={[styles.forumPill, { backgroundColor: `${palette.primary}25` }]}>
                          <Text style={[styles.forumPillText, { color: palette.primary }]}>Forum</Text>
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

      {/* Bottom User Bar */}
      <View style={[styles.userBar, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
        <View style={styles.userInfoRow}>
          <View style={[styles.userAvatar, { backgroundColor: isAnonymous ? '#475569' : '#0284C7' }]}>
            <Text style={{ fontSize: 18 }}>{isAnonymous ? '🥄' : '🌟'}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.userName, { color: palette.text }]} numberOfLines={1}>
              {isAnonymous ? 'Anonymous Spoonie' : 'You'}
            </Text>
            <Text style={[styles.userTag, { color: palette.textSecondary }]}>
              {isAnonymous ? 'Incognito Mode' : 'Online • Resting 🥄'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={toggleAnonymous}
            style={[
              styles.anonToggleBtn,
              {
                backgroundColor: isAnonymous ? `${palette.primary}20` : palette.background,
                borderColor: isAnonymous ? palette.primary : palette.border,
              },
            ]}
          >
            <ShieldCheck size={14} color={isAnonymous ? palette.primary : palette.textSecondary} />
            <Text
              style={[
                styles.anonToggleText,
                { color: isAnonymous ? palette.primary : palette.textSecondary },
              ]}
            >
              {isAnonymous ? 'Anon ON' : 'Anon OFF'}
            </Text>
          </TouchableOpacity>
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
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
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
});
