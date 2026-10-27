import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Search, X } from 'lucide-react-native';
import { useCommunityStore } from '../../src/store/communityStore';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { ICommunityChannel, ICommunityServer } from '../../src/shared/types';
import { DiscordChannelDrawer } from '../../src/components/community/DiscordChannelDrawer';
import { DiscordServerRail } from '../../src/components/community/DiscordServerRail';
import { CreateCommunityModal } from '../../src/components/community/CreateCommunityModal';
import { JoinCommunityModal } from '../../src/components/community/JoinCommunityModal';
import { CreateChannelModal } from '../../src/components/community/CreateChannelModal';

export default function CommunityDirectoryScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenTopBar
        sheet
        title={activeServer?.name || 'Lumen Community Hub'}
        backLabel="Go back to dashboard"
        onBack={() => router.back()}
        right={
          <GlassCircleButton
            accessibilityLabel="Search channels"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsSearching(!isSearching);
            }}
          >
            <Search size={20} color={isSearching ? palette.tint : palette.text} strokeWidth={2.2} />
          </GlassCircleButton>
        }
      />

      {/* Search Input */}
      {isSearching && (
        <View style={styles.searchBar}>
          <Search size={16} color={palette.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search channels, categories, topics..."
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
          activeServerId={activeServer?._id}
          onSelectServer={handleSelectServer}
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

const useStyles = createThemedStyles(palette => ({
  container: { flex: 1, backgroundColor: palette.background },
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
}));
