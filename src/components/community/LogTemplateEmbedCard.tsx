import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ClipboardList, Check, ArrowDownToLine } from 'lucide-react-native';
import { ILogTemplateEmbedPayload } from '../../shared/types';
import { useCommunityStore } from '../../store/communityStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface LogTemplateEmbedCardProps {
  embed: ILogTemplateEmbedPayload;
  messageId?: string;
}

export const LogTemplateEmbedCard: React.FC<LogTemplateEmbedCardProps> = ({
  embed,
  messageId,
}) => {
  const { palette } = useTheme();
  const { cloneLogTemplateToPersonal } = useCommunityStore();
  const [installed, setInstalled] = useState(false);

  const handleInstall = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await cloneLogTemplateToPersonal(embed, messageId);
    setInstalled(true);
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
      <View style={styles.body}>
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

        {/* 1-Tap Action Button */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            installed
              ? { backgroundColor: 'rgba(34, 197, 94, 0.2)', borderColor: '#22C55E' }
              : { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#A855F7' },
          ]}
          onPress={handleInstall}
          disabled={installed}
          activeOpacity={0.7}
        >
          {installed ? (
            <>
              <Check size={14} color="#22C55E" strokeWidth={2.5} />
              <Text style={[styles.actionBtnText, { color: '#22C55E' }]}>Installed</Text>
            </>
          ) : (
            <>
              <ArrowDownToLine size={14} color="#A855F7" strokeWidth={2.5} />
              <Text style={[styles.actionBtnText, { color: '#A855F7' }]}>Install Tracking Template</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
