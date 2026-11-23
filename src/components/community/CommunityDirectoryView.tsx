import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Search, X, Settings, SquarePen, Plus, EyeOff } from 'lucide-react-native';
import { useCommunityStore } from '../../store/communityStore';
import { useAuthStore } from '../../store/authStore';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { safeGoBack } from '../../utils/navigation';
import { ScreenTopBar } from '../ios/ScreenTopBar';
import { LargeTitleHeader } from '../ios/LargeTitleHeader';
import { GlassCircleButton } from '../ios/GlassCircleButton';
import { TAB_BAR_CLEARANCE } from '../ios/iosTheme';
import { ModularAvatar } from '../avatar/ModularAvatar';
import { ICommunityChannel, ICommunityServer } from '../../shared/types';
import { DiscordChannelDrawer } from './DiscordChannelDrawer';
import { DiscordServerRail } from './DiscordServerRail';
import { CreateCommunityModal } from './CreateCommunityModal';
import { JoinCommunityModal } from './JoinCommunityModal';
import { CreateChannelModal } from './CreateChannelModal';
import { ServerSettingsModal } from './ServerSettingsModal';
import { NewMessageModal } from './NewMessageModal';
import { DmInviteModal } from './DmInviteModal';
import { GroupPickerModal } from './GroupPickerModal';

export interface CommunityDirectoryViewProps {
  isTab?: boolean;
}

export function CommunityDirectoryView({ isTab = false }: CommunityDirectoryViewProps) {
  const { palette } = useTheme();
  const styles = useStyles();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { user } = useAuthStore();
  const {
    servers,
    activeServer,
    fetchServers,
    setActiveServer,
    channels,
    fetchChannels,
    setActiveChannel,
    activeChannel,
    dmChannels,
    fetchDms,
    setupSocketListeners,
    isLoading,
    isAnonymous,
    toggleAnonymous,
  } = useCommunityStore();

  const [isDmsMode, setIsDmsMode] = useState(params.mode === 'dms');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [createCommunityVisible, setCreateCommunityVisible] = useState(false);
  const [groupPickerVisible, setGroupPickerVisible] = useState(false);
  const [myInviteVisible, setMyInviteVisible] = useState(false);
  const [joinCommunityVisible, setJoinCommunityVisible] = useState(false);
  const [createChannelVisible, setCreateChannelVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [newMessageVisible, setNewMessageVisible] = useState(false);

  useEffect(() => {
    if (params.mode === 'dms') {
      setIsDmsMode(true);
    }
  }, [params.mode]);

  // Live unread counts, "typing…" and online status in the list.
  useEffect(() => setupSocketListeners(), [setupSocketListeners]);

  useEffect(() => {
    fetchServers();
    fetchChannels();
    fetchDms();
  }, [fetchServers, fetchChannels, fetchDms]);

  const displayedChannels = isDmsMode ? dmChannels : channels;

  const filteredChannels = displayedChannels.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.topic && c.topic.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.category && c.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleOpenChannel = (channel: ICommunityChannel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveChannel(channel);
    router.push({
      pathname: '/community/[channelId]',
      params: { channelId: channel.slug || channel._id },
    });
  };

  const handleSelectServer = (server: ICommunityServer) => {
    setActiveServer(server);
  };

  const serverMembersCount = activeServer?.membersCount || 1;
  const serverSubtitle = `${activeServer?.name || 'Lumen Community Hub'} · ${serverMembersCount} ${serverMembersCount === 1 ? 'member' : 'members'}`;
  const dmsSubtitle = `Direct Messages · ${dmChannels.length} ${dmChannels.length === 1 ? 'conversation' : 'conversations'}`;
  const totalUnreadDms = dmChannels.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const headerActions = (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {isDmsMode ? (
        <GlassCircleButton
          accessibilityLabel="New message"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setNewMessageVisible(true);
          }}
        >
          <SquarePen size={20} color={palette.text} strokeWidth={2.2} />
        </GlassCircleButton>
      ) : (
        <>
          {activeServer && (
            <>
              <GlassCircleButton
                accessibilityLabel="Create channel"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCreateChannelVisible(true);
                }}
              >
                <Plus size={20} color={palette.text} strokeWidth={2.2} />
              </GlassCircleButton>
              <GlassCircleButton
                accessibilityLabel="Community settings"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSettingsVisible(true);
                }}
              >
                <Settings size={20} color={palette.text} strokeWidth={2.2} />
              </GlassCircleButton>
            </>
          )}
        </>
      )}
      <GlassCircleButton
        accessibilityLabel="Search channels"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setIsSearching(!isSearching);
        }}
      >
        <Search size={20} color={isSearching ? palette.tint : palette.text} strokeWidth={2.2} />
      </GlassCircleButton>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={isTab ? ['top'] : ['top', 'bottom']}>
      <View style={styles.headerWrap}>
        {isTab ? (
          <LargeTitleHeader
            title="Community"
            subtitle={isDmsMode ? dmsSubtitle : serverSubtitle}
            actions={headerActions}
          />
        ) : (
          <ScreenTopBar
            sheet
            title={isDmsMode ? 'Direct Messages' : (activeServer?.name || 'Lumen Community Hub')}
            subtitle={
              isDmsMode
                ? `${dmChannels.length} ${dmChannels.length === 1 ? 'conversation' : 'conversations'}`
                : `${serverMembersCount} ${serverMembersCount === 1 ? 'member' : 'members'}`
            }
            backLabel="Go back to dashboard"
            onBack={() => safeGoBack('/(tabs)/today')}
            right={headerActions}
          />
        )}
      </View>

      {/* Search Input */}
      {isSearching && (
        <View style={styles.searchBar}>
          <Search size={16} color={palette.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={isDmsMode ? 'Search conversations...' : 'Search channels, categories, topics...'}
            placeholderTextColor={palette.placeholder}
            accessibilityLabel="Search channels"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={16} color={palette.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main Split Layout: Discord Server Rail + Discord Channel Drawer */}
      <View style={styles.mainContent}>
        {/* Discord Vertical Server Rail */}
        <DiscordServerRail
          servers={servers}
          activeServerId={isDmsMode ? undefined : activeServer?._id}
          isDmsActive={isDmsMode}
          unreadDmsCount={totalUnreadDms}
          onSelectDms={() => {
            setIsDmsMode(true);
            fetchDms();
          }}
          onSelectServer={(server) => {
            setIsDmsMode(false);
            handleSelectServer(server);
          }}
          onPressAddServer={() => setCreateCommunityVisible(true)}
          onPressJoinServer={() => setJoinCommunityVisible(true)}
        />

        {/* Discord Channels Drawer for Active Server */}
        <View style={styles.channelArea}>
          {isLoading && channels.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={styles.loadingText}>
                Loading {activeServer?.name || 'channels'}...
              </Text>
            </View>
          ) : (
            <DiscordChannelDrawer
              channels={filteredChannels}
              activeServer={activeServer}
              activeChannelId={activeChannel?._id}
              isDmsMode={isDmsMode}
              hideHeader={true}
              hideFooter={isTab}
              contentBottomPadding={isTab ? TAB_BAR_CLEARANCE + 64 : 20}
              onSelectChannel={handleOpenChannel}
              onOpenSearch={() => setIsSearching(true)}
              onPressAddChannel={() => setCreateChannelVisible(true)}
              onPressNewMessage={() => setNewMessageVisible(true)}
            />
          )}
        </View>
      </View>

      {/* Floating "Posting as" bar only for Server mode (matching docs/design/Community.html & Image 1) */}
      {isTab && !isDmsMode && (
        <View style={styles.postingAsWrap} pointerEvents="box-none">
          <View style={styles.postingAsBar}>
            <View style={[styles.postingAvatar, { backgroundColor: isAnonymous ? '#2C2C2E' : `${palette.primary}18` }]}>
              {isAnonymous ? (
                <EyeOff size={18} color="#818CF8" />
              ) : (
                <ModularAvatar size={34} animated={false} />
              )}
            </View>
            <View style={styles.postingInfo}>
              <Text style={styles.postingName} numberOfLines={1}>
                {`Posting as ${isAnonymous ? 'Quiet Owl' : (user?.name || 'You')}`}
              </Text>
              <Text style={[styles.postingTag, { color: isAnonymous ? '#818CF8' : palette.success }]}>
                {isAnonymous ? 'ANONYMOUS' : 'PUBLIC'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleAnonymous();
              }}
              accessibilityRole="button"
              accessibilityLabel="Change posting mode"
            >
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modals for Community & Channel Creation */}
      <CreateCommunityModal
        visible={createCommunityVisible}
        onClose={() => setCreateCommunityVisible(false)}
        onCreated={() => fetchServers()}
      />

      <JoinCommunityModal
        visible={joinCommunityVisible}
        onClose={() => setJoinCommunityVisible(false)}
        onJoined={() => fetchServers()}
      />

      <NewMessageModal
        visible={newMessageVisible}
        onClose={() => setNewMessageVisible(false)}
        onOpened={(channelId) => {
          fetchDms();
          router.push({ pathname: '/community/[channelId]', params: { channelId } });
        }}
        onNewGroup={() => { setNewMessageVisible(false); setTimeout(() => setGroupPickerVisible(true), 350); }}
        onMyInvite={() => { setNewMessageVisible(false); setTimeout(() => setMyInviteVisible(true), 350); }}
      />

      <GroupPickerModal
        visible={groupPickerVisible}
        onClose={() => setGroupPickerVisible(false)}
        onCreated={(channelId) => { fetchDms(); router.push({ pathname: '/community/[channelId]', params: { channelId } }); }}
      />

      <DmInviteModal visible={myInviteVisible} onClose={() => setMyInviteVisible(false)} />

      <ServerSettingsModal visible={settingsVisible} server={activeServer} onClose={() => setSettingsVisible(false)} />

      {activeServer && (
        <CreateChannelModal
          visible={createChannelVisible}
          serverId={activeServer._id}
          onClose={() => setCreateChannelVisible(false)}
          onCreated={() => fetchChannels(activeServer._id)}
        />
      )}
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  container: { flex: 1, backgroundColor: palette.background },
  headerWrap: {
    borderBottomWidth: 1,
    borderBottomColor: '#38383A',
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: palette.surface,
  },
  searchInput: { flex: 1, minHeight: 44, marginLeft: 8, ...typography.bodyLarge, color: palette.text },
  mainContent: { flex: 1, flexDirection: 'row' },
  channelArea: { flex: 1 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { ...typography.subhead, color: palette.textSecondary, marginTop: 10 },
  postingAsWrap: {
    position: 'absolute',
    left: 72,
    right: 0,
    bottom: TAB_BAR_CLEARANCE + 10,
    paddingHorizontal: 16,
  },
  postingAsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#38383A',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  postingAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postingInfo: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  postingName: {
    ...typography.subheadBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  postingTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  changeBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBtnText: {
    ...typography.subheadBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
}));
