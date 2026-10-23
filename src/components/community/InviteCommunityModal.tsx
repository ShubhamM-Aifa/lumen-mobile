import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, Share2, Check, KeyRound, Users, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ICommunityServer } from '../../shared/types';

interface Props {
  visible: boolean;
  server: ICommunityServer | null;
  onClose: () => void;
}

export const InviteCommunityModal: React.FC<Props> = ({ visible, server, onClose }) => {
  const { palette } = useTheme();
  const [copied, setCopied] = useState(false);

  if (!server) return null;

  const code = server.inviteCode || 'LUMEN1';

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const message = `Join my chronic illness community "${server.name}" on Lumen! 🌿\n\nInvite Code: ${code}\n\nTo join:\n1. Open Lumen app\n2. Go to the Community tab\n3. Tap '+' (Join Community) and enter code: ${code}`;
    try {
      await Share.share({ message });
    } catch {}
  };

  const handleCopyCode = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    // Also trigger native share for instant forwarding
    await handleShare();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.container, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <View style={styles.headerLeft}>
              <Users size={18} color={palette.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.headerTitle, { color: palette.text }]}>Invite Friends</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Server Badge Preview */}
            <View style={styles.serverInfo}>
              <View style={[styles.serverBadge, { backgroundColor: server.color || palette.primary }]}>
                <Text style={{ fontSize: 26 }}>{server.icon || '🌟'}</Text>
              </View>
              <Text style={[styles.serverName, { color: palette.text }]}>{server.name}</Text>
              <Text style={[styles.serverMembers, { color: palette.textSecondary }]}>
                {server.membersCount || 1} {server.membersCount === 1 ? 'member' : 'members'} • {server.isPrivate ? 'Private Community' : 'Public Community'}
              </Text>
            </View>

            {/* Invite Code Card */}
            <View style={[styles.codeBox, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Text style={[styles.codeLabel, { color: palette.textSecondary }]}>SERVER INVITE CODE</Text>
              <View style={styles.codeRow}>
                <KeyRound size={20} color={palette.primary} />
                <Text style={[styles.codeText, { color: palette.text }]}>{code}</Text>
              </View>
              <Text style={[styles.codeHint, { color: palette.textDisabled }]}>
                Anyone with this code can join and chat across all channels in this community.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: palette.primary }]}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Share2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.shareBtnText}>Share Invite Link</Text>
              </TouchableOpacity>
            </View>

            {/* Step-by-Step Instructions */}
            <View style={[styles.instructionsCard, { backgroundColor: 'rgba(255, 255, 255, 0.04)' }]}>
              <Text style={[styles.instructionsTitle, { color: palette.text }]}>How Your Friends Can Join:</Text>
              
              <View style={styles.stepRow}>
                <View style={[styles.stepNum, { backgroundColor: `${palette.primary}33` }]}>
                  <Text style={[styles.stepNumText, { color: palette.primary }]}>1</Text>
                </View>
                <Text style={[styles.stepText, { color: palette.textSecondary }]}>
                  Send them this 6-character code: <Text style={{ color: palette.primary, fontWeight: '700' }}>{code}</Text>
                </Text>
              </View>

              <View style={styles.stepRow}>
                <View style={[styles.stepNum, { backgroundColor: `${palette.primary}33` }]}>
                  <Text style={[styles.stepNumText, { color: palette.primary }]}>2</Text>
                </View>
                <Text style={[styles.stepText, { color: palette.textSecondary }]}>
                  They open Lumen, go to <Text style={{ color: palette.text, fontWeight: '600' }}>Community</Text>, and tap the <Text style={{ color: palette.text, fontWeight: '600' }}>'+'</Text> button.
                </Text>
              </View>

              <View style={styles.stepRow}>
                <View style={[styles.stepNum, { backgroundColor: `${palette.primary}33` }]}>
                  <Text style={[styles.stepNumText, { color: palette.primary }]}>3</Text>
                </View>
                <Text style={[styles.stepText, { color: palette.textSecondary }]}>
                  They paste the code and tap <Text style={{ color: palette.text, fontWeight: '600' }}>Join</Text> to enter!
                </Text>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
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
  content: {
    padding: 18,
  },
  serverInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  serverBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  serverName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  serverMembers: {
    fontSize: 12,
  },
  codeBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  codeText: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 4,
  },
  codeHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  actionsRow: {
    marginBottom: 16,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  instructionsCard: {
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  instructionsTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: '800',
  },
  stepText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
});
