import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CheckSquare, Check, ArrowDownToLine, ListTodo, Eye } from 'lucide-react-native';
import { router } from 'expo-router';
import { ITodoEmbedPayload } from '../../shared/types';
import { useCommunityStore } from '../../store/communityStore';
import { useTaskStore } from '../../store/taskStore';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface TodoEmbedCardProps {
  embed: ITodoEmbedPayload;
  messageId?: string;
  senderId?: string;
  isAuthor?: boolean;
}

export const TodoEmbedCard: React.FC<TodoEmbedCardProps> = ({
  embed,
  messageId,
  senderId,
  isAuthor,
}) => {
  const { palette } = useTheme();
  const { user } = useAuthStore();
  const { lists, setActiveFilter } = useTaskStore();
  const { cloneTodoToPersonal } = useCommunityStore();

  const [savedListId, setSavedListId] = useState<string | null>(null);

  // Check if current user is author of routine share
  const isSender = Boolean(isAuthor) || (Boolean(user?._id) && Boolean(senderId) && user?._id === senderId);

  // Check if routine already exists in user's lists
  const existingList = lists.find(
    (l) =>
      (embed.listId && l._id === embed.listId) ||
      (l.name && embed.listName && l.name.trim().toLowerCase() === embed.listName.trim().toLowerCase())
  );

  const isSaved = Boolean(existingList) || Boolean(savedListId);

  const handleOpenRoutine = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const targetListId = savedListId || existingList?._id || embed.listId;
    if (targetListId) {
      setActiveFilter(targetListId);
      router.push({ pathname: '/todo', params: { listId: targetListId } } as any);
    } else {
      router.push('/todo' as any);
    }
  };

  const handleClone = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const list = await cloneTodoToPersonal(embed, messageId);
    if (list?._id) {
      setSavedListId(list._id);
    }
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
      <TouchableOpacity
        style={styles.body}
        activeOpacity={isSender || isSaved ? 0.75 : 1}
        onPress={isSender || isSaved ? handleOpenRoutine : undefined}
      >
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

        {/* Context-Aware Action Button */}
        {isSender ? (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' },
            ]}
            onPress={handleOpenRoutine}
            activeOpacity={0.7}
          >
            <Eye size={14} color="#10B981" strokeWidth={2.5} />
            <Text style={[styles.actionBtnText, { color: '#10B981' }]}>View Routine</Text>
          </TouchableOpacity>
        ) : isSaved ? (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: '#22C55E' },
            ]}
            onPress={handleOpenRoutine}
            activeOpacity={0.7}
          >
            <Check size={14} color="#22C55E" strokeWidth={2.5} />
            <Text style={[styles.actionBtnText, { color: '#22C55E' }]}>Imported • View Routine</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' },
            ]}
            onPress={handleClone}
            activeOpacity={0.7}
          >
            <ArrowDownToLine size={14} color="#10B981" strokeWidth={2.5} />
            <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Import to To-Do Hub</Text>
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
