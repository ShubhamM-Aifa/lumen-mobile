import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ClipboardList, Check, ArrowDownToLine, Eye } from 'lucide-react-native';
import { router } from 'expo-router';
import { ILogTemplateEmbedPayload } from '../../shared/types';
import { useCommunityStore } from '../../store/communityStore';
import { useConfigStore } from '../../store/configStore';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface LogTemplateEmbedCardProps {
  embed: ILogTemplateEmbedPayload;
  messageId?: string;
  senderId?: string;
  isAuthor?: boolean;
}

export const LogTemplateEmbedCard: React.FC<LogTemplateEmbedCardProps> = ({
  embed,
  messageId,
  senderId,
  isAuthor,
}) => {
  const { palette } = useTheme();
  const { user } = useAuthStore();
  const { config } = useConfigStore();
  const { cloneLogTemplateToPersonal } = useCommunityStore();
  const [isInstalledLocal, setIsInstalledLocal] = useState(false);

  // Check if current user is author of template share
  const isSender = Boolean(isAuthor) || (Boolean(user?._id) && Boolean(senderId) && user?._id === senderId);

  // Check if template is already present in user's config categories
  const existingCategory = config?.categories?.find(
    (c: any) =>
      (embed.templateId && (c._id === embed.templateId || c.id === embed.templateId)) ||
      (c.name &&
        embed.title &&
        c.name.trim().toLowerCase() === embed.title.replace(' Logging Template', '').trim().toLowerCase())
  );

  const isInstalled = Boolean(existingCategory) || isInstalledLocal;

  const handleOpenTemplate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/log' as any);
  };

  const handleInstall = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await cloneLogTemplateToPersonal(embed, messageId);
    setIsInstalledLocal(true);
    Alert.alert(
      'Template Installed!',
      `"${embed.title}" tracking configuration has been saved. You can log it anytime in Today or Log tabs.`
    );
  };

  const categoriesCount = embed.categories?.length || 0;
  const quickActionsCount = embed.quickActions?.length || 0;

  return (
    <View style={[styles.card, { backgroundColor: palette.surface }]}>
      {/* Banner */}
      <View style={styles.banner}>
        <LinearGradient
          colors={['#3B0764', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.badge}>
          <ClipboardList size={11} color="#C084FC" />
          <Text style={styles.badgeText}>LUMEN TRACKING TEMPLATE</Text>
        </View>
      </View>

      {/* Body Area */}
      <TouchableOpacity
        style={styles.body}
        activeOpacity={isSender || isInstalled ? 0.75 : 1}
        onPress={isSender || isInstalled ? handleOpenTemplate : undefined}
      >
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
          {embed.title}
        </Text>

        {/* Condition Tags */}
        {(embed.conditionTags || []).length > 0 && (
          <View style={styles.tagsRow}>
            {embed.conditionTags.map((t, idx) => (
              <View key={idx} style={[styles.tag, { backgroundColor: 'rgba(192, 132, 252, 0.15)' }]}>
                <Text style={[styles.tagText, { color: '#C084FC' }]}>#{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Metrics Overview */}
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: palette.textSecondary }]}>
            📊 {categoriesCount} Symptom Categories • ⚡ {quickActionsCount} Quick-Tap Actions
          </Text>
        </View>

        {/* Context-Aware Action Button */}
        {isSender ? (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#A855F7' },
            ]}
            onPress={handleOpenTemplate}
            activeOpacity={0.7}
          >
            <Eye size={14} color="#A855F7" strokeWidth={2.5} />
            <Text style={[styles.actionBtnText, { color: '#A855F7' }]}>View Template</Text>
          </TouchableOpacity>
        ) : isInstalled ? (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: '#22C55E' },
            ]}
            onPress={handleOpenTemplate}
            activeOpacity={0.7}
          >
            <Check size={14} color="#22C55E" strokeWidth={2.5} />
            <Text style={[styles.actionBtnText, { color: '#22C55E' }]}>Installed • View in Log</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#A855F7' },
            ]}
            onPress={handleInstall}
            activeOpacity={0.7}
          >
            <ArrowDownToLine size={14} color="#A855F7" strokeWidth={2.5} />
            <Text style={[styles.actionBtnText, { color: '#A855F7' }]}>Install Tracking Template</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    marginVertical: 6,
    width: '100%',
  },
  banner: {
    height: 38,
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C084FC',
    letterSpacing: 0.5,
  },
  body: {
    padding: 12,
  },
  title: {
    ...typography.h3,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaRow: {
    marginBottom: 10,
  },
  metaText: {
    fontSize: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
