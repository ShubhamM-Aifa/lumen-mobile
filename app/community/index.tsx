import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Search,
  X,
  Compass,
} from 'lucide-react-native';
import { useCommunityStore } from '../../src/store/communityStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { ICommunityChannel, ICommunityServer } from '../../src/shared/types';
import { DiscordChannelDrawer } from '../../src/components/community/DiscordChannelDrawer';
import { DiscordServerRail } from '../../src/components/community/DiscordServerRail';
import { CreateCommunityModal } from '../../src/components/community/CreateCommunityModal';
import { JoinCommunityModal } from '../../src/components/community/JoinCommunityModal';
import { CreateChannelModal } from '../../src/components/community/CreateChannelModal';

export default function CommunityDirectoryScreen() {
  const { palette } = useTheme();
  const {
    servers,
    activeServer,
    fetchServers,
    setActiveServer,
    channels,
    fetchChannels,
    setActiveChannel,
    activeChannel,
    isLoading,
  } = useCommunityStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [createCommunityVisible, setCreateCommunityVisible] = useState(false);
  const [joinCommunityVisible, setJoinCommunityVisible] = useState(false);
  const [createChannelVisible, setCreateChannelVisible] = useState(false);

  useEffect(() => {
    fetchServers();
    fetchChannels();
  }, [fetchServers, fetchChannels]);

  const filteredChannels = channels.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase())
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back to dashboard"
        >
          <ArrowLeft size={22} color={palette.text} />
        </TouchableOpacity>

        <View style={styles.topBarTitleArea}>
          <Compass size={18} color={palette.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.screenTitle, { color: palette.text }]}>
            {activeServer?.name || 'Lumen Community Hub'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setIsSearching(!isSearching);
          }}
          accessibilityRole="button"
          accessibilityLabel="Search channels"
        >
          <Search size={20} color={isSearching ? palette.primary : palette.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      {isSearching && (
        <View style={[styles.searchBar, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
          <Search size={16} color={palette.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: palette.text }]}
            placeholder="Search channels, categories, topics..."
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
      )}

      {/* Main Split Layout: Discord Server Rail + Discord Channel Drawer */}
      <View style={styles.mainContent}>
        {/* Discord Vertical Server Rail */}
        <DiscordServerRail
          servers={servers}
          activeServerId={activeServer?._id}
          onSelectServer={handleSelectServer}
          onPressAddServer={() => setCreateCommunityVisible(true)}
          onPressJoinServer={() => setJoinCommunityVisible(true)}
        />

        {/* Discord Channels Drawer for Active Server */}
        <View style={styles.channelArea}>
          {isLoading && channels.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={palette.primary} />
              <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
                Loading {activeServer?.name || 'channels'}...
              </Text>
            </View>
          ) : (
            <DiscordChannelDrawer
              channels={filteredChannels}
              activeServer={activeServer}
              activeChannelId={activeChannel?._id}
              onSelectChannel={handleOpenChannel}
              onOpenSearch={() => setIsSearching(true)}
              onPressAddChannel={() => setCreateChannelVisible(true)}
            />
          )}
        </View>
      </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarTitleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  screenTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    height: 36,
    marginLeft: 8,
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  channelArea: {
    flex: 1,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 10,
    fontWeight: '500',
  },
});
