import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
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
  Users,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Search,
  X,
  FileText,
  ListTodo,
  ShieldCheck,
} from 'lucide-react-native';
import { useCommunityStore } from '../../src/store/communityStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { ICommunityChannel } from '../../src/shared/types';

export default function CommunityDirectoryScreen() {
  const { palette } = useTheme();
  const { channels, fetchChannels, setActiveChannel, isLoading } = useCommunityStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const filteredChannels = channels.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenChannel = (channel: ICommunityChannel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveChannel(channel);
    router.push({
      pathname: '/community/[channelId]',
      params: { channelId: channel.slug || channel._id },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      {/* Top Header */}
      <View style={[styles.topBar, { borderBottomColor: 'rgba(255, 255, 255, 0.08)' }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color={palette.text} />
        </TouchableOpacity>

        <View style={styles.topBarTitleArea}>
          <Text style={[styles.screenTitle, { color: palette.text }]}>Community Spaces</Text>
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
        <View style={[styles.searchBar, { backgroundColor: palette.surface }]}>
          <Search size={16} color={palette.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: palette.text }]}
            placeholder="Search condition channels, topics..."
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

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* Welcome Community Banner */}
        <View style={[styles.welcomeBanner, { backgroundColor: palette.surface, borderColor: 'rgba(56, 189, 248, 0.25)' }]}>
          <View style={styles.welcomeTop}>
            <View style={styles.welcomeIconWell}>
              <Users size={22} color="#38BDF8" />
            </View>
            <View style={styles.welcomeTextCol}>
              <Text style={[styles.welcomeTitle, { color: palette.text }]}>
                Share Spoons & Health Artifacts
              </Text>
              <Text style={[styles.welcomeSub, { color: palette.textSecondary }]}>
                Join condition-specific channels. Share and 1-tap save Notion Notes, To-Do routines, and Tracking Templates from fellow patients.
              </Text>
            </View>
          </View>
          <View style={styles.safeSpaceTag}>
            <ShieldCheck size={12} color="#10B981" />
            <Text style={styles.safeSpaceText}>Safe, moderated peer support with 1-tap Anonymous Spoonie mode</Text>
          </View>
        </View>

        {/* Channels List */}
        <View style={styles.channelsSection}>
          <View style={styles.sectionHeader}>
            <MessageSquare size={16} color={palette.primary} />
            <Text style={[styles.sectionTitle, { color: palette.text }]}>CONDITION & TOPIC CHANNELS</Text>
          </View>

          {isLoading && channels.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={palette.primary} />
            </View>
          ) : (
            filteredChannels.map((channel) => (
              <TouchableOpacity
                key={channel._id}
                style={[styles.channelCard, { backgroundColor: palette.surface }]}
                onPress={() => handleOpenChannel(channel)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.channelIconBox,
                    { backgroundColor: `${channel.color || '#38BDF8'}22` },
                  ]}
                >
                  <Text style={styles.channelEmoji}>{channel.icon || '💬'}</Text>
                </View>

                <View style={styles.channelInfo}>
                  <View style={styles.channelNameRow}>
                    <Text style={[styles.channelName, { color: palette.text }]}>
                      #{channel.slug || channel.name}
                    </Text>
                    {channel.isFeatured && (
                      <View style={styles.featuredBadge}>
                        <Text style={styles.featuredText}>POPULAR</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.channelTopic, { color: palette.textSecondary }]} numberOfLines={1}>
                    {channel.topic || channel.description}
                  </Text>
                  <Text style={[styles.channelDesc, { color: palette.textDisabled }]} numberOfLines={2}>
                    {channel.description}
                  </Text>
                </View>

                <ChevronRight size={18} color={palette.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarTitleArea: {
    flex: 1,
    alignItems: 'center',
  },
  screenTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  welcomeBanner: {
    borderRadius: 18,
    borderWidth: 1.2,
    padding: 16,
    marginBottom: 20,
  },
  welcomeTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  welcomeIconWell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTextCol: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  welcomeSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  safeSpaceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  safeSpaceText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  channelsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
    gap: 12,
  },
  channelIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelEmoji: {
    fontSize: 22,
  },
  channelInfo: {
    flex: 1,
  },
  channelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  channelName: {
    fontSize: 15,
    fontWeight: '700',
  },
  featuredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  featuredText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
  },
  channelTopic: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  channelDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
});
