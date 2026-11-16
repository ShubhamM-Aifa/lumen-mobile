import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { X, Pin, ArrowDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { ICommunityMessage } from '../../shared/types';
import { DiscordMarkdownText } from './DiscordMarkdownText';
import { formatTimeRelative } from '../../utils/dayBoundary';

interface DiscordPinnedMessagesModalProps {
  visible: boolean;
  onClose: () => void;
  pins: ICommunityMessage[];
  onJumpToMessage?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
}

export const DiscordPinnedMessagesModal: React.FC<DiscordPinnedMessagesModalProps> = ({
  visible,
  onClose,
  pins,
  onJumpToMessage,
  onUnpin,
}) => {
  const { palette } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <View style={styles.headerLeft}>
            <Pin size={20} color={palette.primaryText || palette.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.headerTitle, { color: palette.text }]}>Pinned Messages</Text>
            <View style={[styles.countBadge, { backgroundColor: `${palette.primary}20` }]}>
              <Text style={[styles.countText, { color: palette.primaryText || palette.primary }]}>
                {pins.length}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close pinned messages"
          >
            <X size={22} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>

        {pins.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Pin size={48} color={palette.textDisabled} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No Pinned Messages</Text>
            <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
              Important health protocols, pacing guidelines, or shared notes can be pinned here for easy access.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {pins.map((pin) => (
              <View
                key={pin._id}
                style={[
                  styles.pinCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                {/* Pin info banner */}
                <View style={[styles.pinMetaRow, { borderBottomColor: palette.border }]}>
                  <Pin size={12} color="#F59E0B" style={{ marginRight: 4 }} />
                  <Text style={[styles.pinMetaText, { color: palette.textSecondary }]}>
                    Pinned by {pin.pinnedBy?.displayName || 'Community Guide'}
                  </Text>
                  <Text style={[styles.pinTime, { color: palette.textDisabled }]}>
                    {pin.pinnedAt ? formatTimeRelative(pin.pinnedAt) : ''}
                  </Text>
                </View>

                {/* Sender info */}
                <View style={styles.senderRow}>
                  <Text style={styles.avatarEmoji}>
                    {pin.senderAvatarEmoji || '🌟'}
                  </Text>
                  <Text
                    style={[
                      styles.senderName,
                      { color: pin.isAnonymous ? '#F59E0B' : pin.senderRoleColor || palette.text },
                    ]}
                  >
                    {pin.senderDisplayName}
                  </Text>
                  <Text style={[styles.msgTime, { color: palette.textDisabled }]}>
                    {formatTimeRelative(pin.createdAt)}
                  </Text>
                </View>

                {/* Message Content */}
                <View style={styles.contentBox}>
                  <DiscordMarkdownText
                    content={pin.content}
                    isEdited={pin.isEdited}
                    editedAt={pin.editedAt}
                  />
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  {onUnpin && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: palette.border }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onUnpin(pin._id);
                      }}
                    >
                      <Text style={[styles.actionBtnText, { color: palette.textSecondary }]}>
                        Unpin
                      </Text>
                    </TouchableOpacity>
                  )}

                  {onJumpToMessage && (
                    <TouchableOpacity
                      style={[styles.jumpBtn, { backgroundColor: palette.primary }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onClose();
                        onJumpToMessage(pin._id);
                      }}
                    >
                      <ArrowDown size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.jumpBtnText}>Jump</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  pinCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pinMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pinMetaText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  pinTime: {
    fontSize: 11,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  avatarEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  msgTime: {
    fontSize: 11,
  },
  contentBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  jumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jumpBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

