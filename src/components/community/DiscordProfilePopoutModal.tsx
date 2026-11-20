import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  X,
  FileText,
  CheckSquare,
  Sparkles,
  Mail,
  Calendar,
  Shield,
  AtSign,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import { IDiscordUserProfile } from '../../shared/types';
import { ModularAvatar } from '../avatar/ModularAvatar';
import { getDeterministicAvatarConfig } from '../../store/avatarStore';

interface Props {
  visible: boolean;
  user: IDiscordUserProfile | null;
  onClose: () => void;
  onMention?: (displayName: string) => void;
  onDirectMessage?: (userId: string) => void;
}

export const DiscordProfilePopoutModal: React.FC<Props> = ({
  visible,
  user,
  onClose,
  onMention,
  onDirectMessage,
}) => {
  const { user: me } = useAuthStore();

  if (!user) return null;
  const isMe = Boolean(me?._id && user.userId === me._id);
  const usernameHandle = `@${(user.displayName || 'user').toLowerCase().replace(/\s+/g, '_')}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* Drag Handle */}
              <View style={styles.sheetHandle} />

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                bounces={false}
              >
                {/* Profile Top Banner */}
                <View style={styles.bannerContainer}>
                  <LinearGradient
                    colors={user.bannerGradient || ['#5865F2', '#3C45A5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.banner}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onClose();
                      }}
                      style={styles.closeBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityLabel="Close profile"
                    >
                      <X size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </LinearGradient>

                  {/* Overlapping Avatar Section */}
                  <View style={styles.avatarSection}>
                    <View style={styles.avatarCircle}>
                      <ModularAvatar
                        size={76}
                        animated={true}
                        interactive={false}
                        config={isMe ? undefined : getDeterministicAvatarConfig(user.userId || user.displayName)}
                      />
                      {/* Discord Online Status Dot */}
                      <View style={styles.statusDotWrap}>
                        <View style={styles.statusDotInner} />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Profile Header Details */}
                <View style={styles.headerDetails}>
                  <Text style={styles.displayName}>{user.displayName}</Text>
                  <Text style={styles.usernameHandle}>{usernameHandle}</Text>

                  {/* Custom Energy Status / Activity if set */}
                  {Boolean(user.energyStatus) && (
                    <View style={styles.customStatusBox}>
                      <Text style={styles.customStatusText}>💬 {user.energyStatus}</Text>
                    </View>
                  )}

                  {/* Role / Badges Row */}
                  <View style={styles.badgesRow}>
                    <View style={styles.badgePill}>
                      <Text style={styles.badgeEmoji}>🥄</Text>
                      <Text style={styles.badgeText}>Spoonie</Text>
                    </View>
                    {(user.roleBadges || ['Community Member']).map((role, idx) => (
                      <View key={idx} style={styles.badgePill}>
                        <Shield size={11} color="#5865F2" style={{ marginRight: 4 }} />
                        <Text style={styles.badgeText}>{role}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Discord Content Card: About Me & Member Since */}
                <View style={styles.contentCard}>
                  <Text style={styles.cardSectionTitle}>ABOUT ME</Text>
                  <Text style={[styles.bioText, !user.bio && styles.bioTextEmpty]}>
                    {user.bio || "This user hasn't added a bio yet."}
                  </Text>

                  {/* Condition Tags if available */}
                  {user.conditionTags && user.conditionTags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {user.conditionTags.map((tag, i) => (
                        <View key={i} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.cardDivider} />

                  {/* Member Since Section */}
                  <Text style={styles.cardSectionTitle}>MEMBER SINCE</Text>
                  <View style={styles.memberSinceRow}>
                    <Calendar size={14} color="#949BA4" style={{ marginRight: 8 }} />
                    <Text style={styles.memberSinceText}>Lumen Member • Joined Nov 2026</Text>
                  </View>
                </View>

                {/* Discord Content Card: Lumen Community Activity */}
                <View style={styles.contentCard}>
                  <Text style={styles.cardSectionTitle}>LUMEN ACTIVITY</Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <FileText size={18} color="#A855F7" />
                      <Text style={styles.statNumber}>{user.stats?.sharedNotesCount || 0}</Text>
                      <Text style={styles.statLabel}>Shared Notes</Text>
                    </View>
                    <View style={styles.statBox}>
                      <CheckSquare size={18} color="#10B981" />
                      <Text style={styles.statNumber}>{user.stats?.sharedTodosCount || 0}</Text>
                      <Text style={styles.statLabel}>Routines</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Sparkles size={18} color="#F59E0B" />
                      <Text style={styles.statNumber}>{user.stats?.totalClones || 0}</Text>
                      <Text style={styles.statLabel}>Total Clones</Text>
                    </View>
                  </View>
                </View>

                {/* Bottom Action Buttons Row */}
                <View style={styles.actionsRow}>
                  {onDirectMessage && (
                    <TouchableOpacity
                      style={styles.primaryActionBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onClose();
                        onDirectMessage(user.userId);
                      }}
                      activeOpacity={0.8}
                    >
                      <Mail size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.primaryActionBtnText}>Message</Text>
                    </TouchableOpacity>
                  )}

                  {onMention && (
                    <TouchableOpacity
                      style={styles.secondaryActionBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onMention(user.displayName);
                        onClose();
                      }}
                      activeOpacity={0.8}
                    >
                      <AtSign size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.secondaryActionBtnText}>Mention</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
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
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1E1F22',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4E5058',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  bannerContainer: {
    position: 'relative',
    width: '100%',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  banner: {
    height: 110,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 12,
    alignItems: 'flex-end',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSection: {
    position: 'absolute',
    bottom: -38,
    left: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E1F22',
    borderWidth: 4,
    borderColor: '#1E1F22',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  statusDotWrap: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1E1F22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#23A55A',
  },
  headerDetails: {
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 12,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  usernameHandle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#949BA4',
    marginTop: 2,
  },
  customStatusBox: {
    backgroundColor: '#2B2D31',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  customStatusText: {
    fontSize: 13,
    color: '#DBDEE1',
    fontWeight: '500',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2B2D31',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeEmoji: {
    fontSize: 11,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DBDEE1',
  },
  contentCard: {
    backgroundColor: '#2B2D31',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#949BA4',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#DBDEE1',
  },
  bioTextEmpty: {
    color: '#80848E',
    fontStyle: 'italic',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagChip: {
    backgroundColor: '#1E1F22',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#949BA4',
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1E1F22',
    marginVertical: 12,
  },
  memberSinceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberSinceText: {
    fontSize: 13,
    color: '#DBDEE1',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1E1F22',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#949BA4',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  primaryActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5865F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2B2D31',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
