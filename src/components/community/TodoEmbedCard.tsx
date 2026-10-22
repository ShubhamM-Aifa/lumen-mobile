import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CheckSquare, Check, ArrowDownToLine, ListTodo } from 'lucide-react-native';
import { ITodoEmbedPayload } from '../../shared/types';
import { useCommunityStore } from '../../store/communityStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface TodoEmbedCardProps {
  embed: ITodoEmbedPayload;
  messageId?: string;
}

export const TodoEmbedCard: React.FC<TodoEmbedCardProps> = ({
  embed,
  messageId,
}) => {
  const { palette } = useTheme();
  const { cloneTodoToPersonal } = useCommunityStore();
  const [imported, setImported] = useState(false);

  const handleClone = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await cloneTodoToPersonal(embed, messageId);
    setImported(true);
    Alert.alert(
      'To-Do List Imported!',
      `"${embed.listName}" and its ${embed.tasks.length} tasks have been added to your To-Do Hub.`
    );
  };

  const energyColors = {
    gentle: { label: '🟢 Gentle Pacing', color: '#22C55E' },
    moderate: { label: '🟡 Moderate', color: '#EAB308' },
    demanding: { label: '🔴 High Energy', color: '#EF4444' },
  };

  const energyInfo = embed.energyCost ? energyColors[embed.energyCost] : null;

  return (
    <View style={[styles.card, { backgroundColor: palette.surface }]}>
      {/* Banner */}
      <View style={styles.banner}>
        <LinearGradient
          colors={['#064E3B', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.badge}>
          <ListTodo size={11} color="#34D399" />
          <Text style={styles.badgeText}>LUMEN TO-DO ROUTINE</Text>
        </View>
      </View>

      {/* Body Area */}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {embed.listName}
          </Text>
          {energyInfo && (
            <View style={styles.energyBadge}>
              <Text style={[styles.energyText, { color: energyInfo.color }]}>
                {energyInfo.label}
              </Text>
            </View>
          )}
        </View>

        {/* Tasks Preview */}
        <View style={styles.tasksPreview}>
          {(embed.tasks || []).slice(0, 3).map((t, idx) => (
            <View key={idx} style={styles.taskPreviewRow}>
              <CheckSquare size={13} color={palette.textSecondary} />
              <Text style={[styles.taskTitle, { color: palette.text }]} numberOfLines={1}>
                {t.title}
              </Text>
              {(t.steps || []).length > 0 && (
                <Text style={[styles.stepCount, { color: palette.textSecondary }]}>
                  ({t.steps.length} steps)
                </Text>
              )}
            </View>
          ))}
          {(embed.tasks || []).length > 3 && (
            <Text style={[styles.moreText, { color: palette.textSecondary }]}>
              +{(embed.tasks || []).length - 3} more tasks
            </Text>
          )}
        </View>

        {/* 1-Tap Import Action Button */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            imported
              ? { backgroundColor: 'rgba(34, 197, 94, 0.2)', borderColor: '#22C55E' }
              : { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' },
          ]}
          onPress={handleClone}
          disabled={imported}
          activeOpacity={0.7}
        >
          {imported ? (
            <>
              <Check size={14} color="#22C55E" strokeWidth={2.5} />
              <Text style={[styles.actionBtnText, { color: '#22C55E' }]}>Imported to To-Do</Text>
            </>
          ) : (
            <>
              <ArrowDownToLine size={14} color="#10B981" strokeWidth={2.5} />
              <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Import to To-Do Hub</Text>
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
    borderColor: 'rgba(16, 185, 129, 0.3)',
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
    color: '#34D399',
    letterSpacing: 0.5,
  },
  body: {
    padding: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  title: {
    ...typography.h3,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  energyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  energyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tasksPreview: {
    marginBottom: 10,
    gap: 5,
  },
  taskPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskTitle: {
    fontSize: 13,
    flex: 1,
  },
  stepCount: {
    fontSize: 11,
  },
  moreText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
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
