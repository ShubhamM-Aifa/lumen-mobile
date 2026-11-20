import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Plus, Compass, KeyRound, MessageCircle } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ICommunityServer } from '../../shared/types';
import { LumenIcon } from '../common/LumenLogo';

interface Props {
  servers: ICommunityServer[];
  activeServerId?: string;
  isDmsActive?: boolean;
  unreadDmsCount?: number;
  onSelectDms?: () => void;
  onSelectServer: (server: ICommunityServer) => void;
  onPressAddServer: () => void;
  onPressJoinServer: () => void;
}

export const DiscordServerRail: React.FC<Props> = ({
  servers,
  activeServerId,
  isDmsActive = false,
  unreadDmsCount = 0,
  onSelectDms,
  onSelectServer,
  onPressAddServer,
  onPressJoinServer,
}) => {
  const { palette } = useTheme();

  const getServerInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <View style={[styles.rail, { backgroundColor: '#1C1C1E', borderRightColor: '#38383A' }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Direct Messages Tab (Discord DMs Top Icon) */}
        {onSelectDms && (
          <>
            <View style={styles.serverItemWrapper}>
              <View
                style={[
                  styles.activeIndicator,
                  {
                    backgroundColor: isDmsActive ? '#0066CC' : 'transparent',
                    height: isDmsActive ? 34 : 0,
                  },
                ]}
              />
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelectDms();
                }}
                style={[
                  styles.serverIconBtn,
                  {
                    backgroundColor: isDmsActive
                      ? '#0066CC'
                      : 'rgba(0,102,204,0.2)',
                    borderRadius: isDmsActive ? 16 : 24,
                  },
                ]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Direct Messages"
              >
                <MessageCircle
                  size={22}
                  color={isDmsActive ? '#FFFFFF' : '#0A84FF'}
                />
                {Boolean(unreadDmsCount && unreadDmsCount > 0) && (
                  <View style={styles.unreadRedBadge}>
                    <Text style={styles.unreadRedBadgeText}>{unreadDmsCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <View style={[styles.divider, { backgroundColor: '#38383A' }]} />
          </>
        )}

        {servers.map((server) => {
          const isActive = server._id === activeServerId;

          return (
            <View key={server._id} style={styles.serverItemWrapper}>
              {/* Active Pill Indicator (Left side) */}
              <View
                style={[
                  styles.activeIndicator,
                  {
                    backgroundColor: isActive ? '#0066CC' : 'transparent',
                    height: isActive ? 34 : 0,
                  },
                ]}
              />

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelectServer(server);
                }}
                style={[
                  styles.serverIconBtn,
                  {
                    backgroundColor: isActive
                      ? (server.color || '#0066CC')
                      : server.isOfficial
                        ? 'rgba(0,102,204,0.25)'
                        : `${server.color || palette.primary}33`,
                    borderRadius: isActive ? 16 : 24,
                  },
                ]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={server.name}
              >
                {server.isOfficial ? (
                  <LumenIcon size={24} />
                ) : server.icon && server.icon.length <= 4 && /[\u{1F300}-\u{1FAFF}]/u.test(server.icon) ? (
                  <Text style={{ fontSize: 22 }}>{server.icon}</Text>
                ) : (
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '800',
                      color: isActive ? '#FFFFFF' : (server.color || '#FFFFFF'),
                    }}
                  >
                    {getServerInitials(server.name)}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: '#38383A' }]} />

        {/* Create Server Button (+) */}
        <View style={styles.serverItemWrapper}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPressAddServer();
            }}
            style={styles.actionBtnSolid}
            accessibilityRole="button"
            accessibilityLabel="Create a new community server"
          >
            <Plus size={22} color="#34C759" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {/* Join by Code Button (Key/Compass) */}
        <View style={styles.serverItemWrapper}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPressJoinServer();
            }}
            style={styles.actionBtnSolid}
            accessibilityRole="button"
            accessibilityLabel="Join community by invite code"
          >
            <Compass size={20} color="#34C759" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  rail: {
    width: 72,
    borderRightWidth: 1,
  },
  scrollContent: {
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
  },
  serverItemWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 4,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  serverIconBtn: {
    position: 'relative',
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  unreadRedBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#1C1C1E',
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadRedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    width: 32,
    height: 2,
    borderRadius: 1,
    marginVertical: 4,
  },
  actionBtnSolid: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
