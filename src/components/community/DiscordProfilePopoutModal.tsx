import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Award, FileText, CheckSquare, Sparkles, MessageSquare } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { IDiscordUserProfile } from '../../shared/types';
import { ModularAvatar } from '../avatar/ModularAvatar';

interface Props {
  visible: boolean;
  user: IDiscordUserProfile | null;
  onClose: () => void;
  onMention?: (displayName: string) => void;
}

export const DiscordProfilePopoutModal: React.FC<Props> = ({
  visible,
  user,
  onClose,
  onMention,
}) => {
  const { palette } = useTheme();

  if (!user) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.card, { backgroundColor: palette.surface }]}>
              {/* Top Banner */}
              <LinearGradient
                colors={user.bannerGradient || ['#0284C7', '#6366F1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.banner}
              >
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>

              {/* Avatar Section */}
              <View style={styles.avatarRow}>
                <View style={[styles.avatarCircle, { borderColor: palette.surface }]}>
                  <ModularAvatar size={66} animated={true} interactive={true} />
                  <View style={styles.statusDot}>
                    <Text style={{ fontSize: 9 }}>🥄</Text>
                  </View>
                </View>
              </View>

              {/* User Identity */}
              <View style={styles.content}>
                <View style={styles.headerInfo}>
                  <Text style={[styles.displayName, { color: palette.text }]}>{user.displayName}</Text>
                  <Text style={[styles.energyStatus, { color: palette.primaryText }]}>
                    {user.energyStatus || 'Pacing & Resting 🥄'}
                  </Text>
                </View>

                {/* Role Badges */}
                <View style={styles.rolesRow}>
                  {(user.roleBadges || ['Community Member']).map((role, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.rolePill,
                        {
                          backgroundColor: `${user.roleColor || palette.primary}20`,
                          borderColor: `${user.roleColor || palette.primary}60`,
                        },
                      ]}
                    >
                      <Award size={11} color={user.roleColor || palette.primary} style={{ marginRight: 4 }} />
                      <Text style={[styles.roleText, { color: user.roleColor || palette.primary }]}>
                        {role}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* About Me */}
                <View style={[styles.bioBox, { backgroundColor: palette.background }]}>
                  <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>ABOUT ME</Text>
                  <Text style={[styles.bioText, { color: palette.text }]}>
                    {user.bio || 'Chronic illness navigator sharing pacing notes, routines, and daily support.'}
                  </Text>

                  {/* Condition Flairs */}
                  {user.conditionTags && user.conditionTags.length > 0 && (
                    <View style={styles.conditionTagsRow}>
                      {user.conditionTags.map((tag, i) => (
                        <View key={i} style={[styles.tagPill, { backgroundColor: palette.surface }]}>
                          <Text style={[styles.tagText, { color: palette.textSecondary }]}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Contribution Stats */}
                <View style={styles.statsRow}>
                  <View style={[styles.statBox, { backgroundColor: palette.background }]}>
                    <FileText size={16} color="#A855F7" />
                    <Text style={[styles.statValue, { color: palette.text }]}>
                      {user.stats?.sharedNotesCount || 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Shared Notes</Text>
                  </View>

                  <View style={[styles.statBox, { backgroundColor: palette.background }]}>
                    <CheckSquare size={16} color="#10B981" />
                    <Text style={[styles.statValue, { color: palette.text }]}>
                      {user.stats?.sharedTodosCount || 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: palette.textSecondary }]}>To-Do Routines</Text>
                  </View>

                  <View style={[styles.statBox, { backgroundColor: palette.background }]}>
                    <Sparkles size={16} color="#F59E0B" />
                    <Text style={[styles.statValue, { color: palette.text }]}>
                      {user.stats?.totalClones || 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Total Clones</Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  {onMention && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: palette.primary }]}
                      onPress={() => {
                        onMention(user.displayName);
                        onClose();
                      }}
                    >
                      <MessageSquare size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.actionBtnText}>Mention in Chat</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  banner: {
    height: 90,
    width: '100%',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 12,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: -36,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E293B',
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 32,
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  content: {
    padding: 16,
    paddingTop: 10,
  },
  headerInfo: {
    marginBottom: 8,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  energyStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bioBox: {
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  bioText: {
    fontSize: 13,
    lineHeight: 18,
  },
  conditionTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  statBox: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  actionsRow: {
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
