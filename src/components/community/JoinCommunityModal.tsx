import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, KeyRound, ArrowRight, Users, Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useCommunityStore } from '../../store/communityStore';
import { ICommunityServer } from '../../shared/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onJoined?: (server: ICommunityServer) => void;
}

export const JoinCommunityModal: React.FC<Props> = ({ visible, onClose, onJoined }) => {
  const { palette } = useTheme();
  const { joinServer, servers, activeServer } = useCommunityStore();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleJoinByCode = async () => {
    if (!code.trim() || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setErrorMsg(null);

    try {
      const server = await joinServer(code.trim());
      setCode('');
      onClose();
      if (onJoined) onJoined(server);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid invite code');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPublic = async (server: ICommunityServer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const joined = await joinServer(server._id);
      onClose();
      if (onJoined) onJoined(joined);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // List public discoverable servers user hasn't joined yet
  const discoverableServers = servers.filter((s) => !s.isPrivate && !s.isMember);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <View style={styles.headerLeft}>
              <KeyRound size={18} color={palette.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.headerTitle, { color: palette.text }]}>Join a Community</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            {/* Invite Code Input Box */}
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
              HAVE AN INVITE CODE?
            </Text>
            <Text style={[styles.subtitle, { color: palette.textDisabled }]}>
              Enter the 6-character private invite code provided by a community creator.
            </Text>

            <View style={styles.codeRow}>
              <TextInput
                style={[
                  styles.codeInput,
                  { color: palette.text, backgroundColor: palette.background, borderColor: palette.border },
                ]}
                placeholder="e.g. ZEBR7X"
                placeholderTextColor={palette.textDisabled}
                autoCapitalize="characters"
                maxLength={10}
                value={code}
                onChangeText={(t) => {
                  setCode(t.toUpperCase());
                  setErrorMsg(null);
                }}
              />
              <TouchableOpacity
                onPress={handleJoinByCode}
                disabled={code.trim().length < 4 || loading}
                style={[
                  styles.joinBtn,
                  {
                    backgroundColor: code.trim().length >= 4 ? palette.primary : palette.border,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ArrowRight size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>

            {errorMsg && (
              <Text style={styles.errorText}>{errorMsg}</Text>
            )}

            {/* Discoverable Public Communities */}
            {discoverableServers.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
                  DISCOVER PUBLIC COMMUNITIES
                </Text>

                {discoverableServers.map((server) => (
                  <View
                    key={server._id}
                    style={[styles.serverCard, { backgroundColor: palette.background, borderColor: palette.border }]}
                  >
                    <View style={[styles.serverIcon, { backgroundColor: `${server.color || '#38BDF8'}20` }]}>
                      <Text style={{ fontSize: 20 }}>{server.icon || '🌟'}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.serverName, { color: palette.text }]}>{server.name}</Text>
                      <Text style={[styles.serverDesc, { color: palette.textSecondary }]} numberOfLines={1}>
                        {server.description || 'Chronic health community'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleJoinPublic(server)}
                      style={[styles.quickJoinBtn, { backgroundColor: palette.primary }]}
                    >
                      <Text style={styles.quickJoinText}>Join</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeInput: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  joinBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  serverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  serverIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serverName: {
    fontSize: 14,
    fontWeight: '700',
  },
  serverDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  quickJoinBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickJoinText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});
