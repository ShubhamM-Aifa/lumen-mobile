import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Plus, Compass, KeyRound } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ICommunityServer } from '../../shared/types';
import { LumenIcon } from '../common/LumenLogo';

interface Props {
  servers: ICommunityServer[];
  activeServerId?: string;
  onSelectServer: (server: ICommunityServer) => void;
  onPressAddServer: () => void;
  onPressJoinServer: () => void;
}

export const DiscordServerRail: React.FC<Props> = ({
  servers,
  activeServerId,
  onSelectServer,
  onPressAddServer,
  onPressJoinServer,
}) => {
  const { palette } = useTheme();

  return (
    <View style={[styles.rail, { backgroundColor: palette.surface, borderRightColor: palette.border }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {servers.map((server) => {
          const isActive = server._id === activeServerId;

          return (
            <View key={server._id} style={styles.serverItemWrapper}>
              {/* Active Pill Indicator (Left side) */}
              <View
                style={[
                  styles.activeIndicator,
                  {
                    backgroundColor: isActive ? palette.primary : 'transparent',
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
                      ? server.color || palette.primary
                      : `${server.color || palette.primary}25`,
                    borderRadius: isActive ? 16 : 24,
                  },
                ]}
                activeOpacity={0.8}
              >
                {server.isOfficial ? (
                  <LumenIcon size={24} />
                ) : (
                  <Text style={{ fontSize: 22 }}>{server.icon || '🌟'}</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: palette.border }]} />

        {/* Create Server Button (+) */}
        <View style={styles.serverItemWrapper}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPressAddServer();
            }}
            style={[styles.actionBtn, { borderColor: palette.primary, backgroundColor: `${palette.primary}15` }]}
            accessibilityRole="button"
            accessibilityLabel="Create a new community server"
          >
            <Plus size={22} color={palette.primary} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {/* Join by Code Button (Key) */}
        <View style={styles.serverItemWrapper}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPressJoinServer();
            }}
            style={[styles.actionBtn, { borderColor: palette.border, backgroundColor: palette.background }]}
            accessibilityRole="button"
            accessibilityLabel="Join community by invite code"
          >
            <KeyRound size={18} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  rail: {
    width: 68,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  serverItemWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 10,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  serverIconBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  divider: {
    width: 32,
    height: 2,
    borderRadius: 1,
    marginVertical: 6,
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
