import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, Plus, Lightbulb, Check, AlertCircle, Calendar, Star } from 'lucide-react-native';
import { ITask } from '../../shared/types';
import { useTaskStore, TaskSuggestions } from '../../store/taskStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface SuggestionsModalProps {
  visible: boolean;
  onClose: () => void;
  boundaryHour?: number;
}

export const SuggestionsModal: React.FC<SuggestionsModalProps> = ({
  visible,
  onClose,
  boundaryHour = 4,
}) => {
  const { palette } = useTheme();
  const { fetchSuggestions, toggleTaskMyDay, tasks } = useTaskStore();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TaskSuggestions | null>(null);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      fetchSuggestions(boundaryHour).then((res) => {
        setData(res);
        setLoading(false);
      });
    }
  }, [visible, boundaryHour]);

  const handleAddToMyDay = (task: ITask) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toggleTaskMyDay(task._id, boundaryHour);
  };

  const renderSuggestionList = (
    title: string,
    items: ITask[],
    icon: React.ReactNode,
    iconColor: string
  ) => {
    if (!items || items.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          {icon}
          <Text style={[styles.sectionTitle, { color: iconColor }]}>{title}</Text>
          <View style={[styles.badge, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
            <Text style={[styles.badgeText, { color: palette.textSecondary }]}>
              {items.length}
            </Text>
          </View>
        </View>

        {items.map((item) => {
          // Check if current store task is already in My Day
          const current = tasks.find((t) => t._id === item._id) || item;
          const isInMyDay = current.inMyDay;

          return (
            <View
              key={item._id}
              style={[styles.itemCard, { backgroundColor: 'rgba(255, 255, 255, 0.04)' }]}
            >
              <View style={styles.itemInfo}>
                <Text
                  style={[
                    styles.itemTitle,
                    {
                      color: isInMyDay ? palette.textDisabled : palette.text,
                      textDecorationLine: isInMyDay ? 'line-through' : 'none',
                    },
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                {item.dueDate && (
                  <Text style={[styles.itemSub, { color: palette.textSecondary }]}>
                    Due {item.dueDate}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.addBtn,
                  {
                    backgroundColor: isInMyDay
                      ? 'rgba(56, 189, 248, 0.2)'
                      : palette.primary,
                  },
                ]}
                onPress={() => handleAddToMyDay(item)}
                accessibilityRole="button"
                accessibilityLabel="Add to My Day"
              >
                {isInMyDay ? (
                  <Check size={16} color="#38BDF8" strokeWidth={2.5} />
                ) : (
                  <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  const hasAnySuggestions =
    data &&
    ((data.overdue && data.overdue.length > 0) ||
      (data.dueToday && data.dueToday.length > 0) ||
      (data.important && data.important.length > 0) ||
      (data.recent && data.recent.length > 0));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={styles.topBar}>
            <View style={styles.titleRow}>
              <Lightbulb size={22} color="#FBBF24" />
              <Text style={[styles.title, { color: palette.text }]}>Suggestions</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Review tasks you might want to add to your clean daily slate.
          </Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={palette.primary} />
            </View>
          ) : !hasAnySuggestions ? (
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 32 }}>✨</Text>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>All Caught Up!</Text>
              <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
                No overdue or suggested tasks found. Enjoy your day!
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
              {renderSuggestionList(
                'Overdue',
                data?.overdue || [],
                <AlertCircle size={16} color="#EF4444" />,
                '#EF4444'
              )}
              {renderSuggestionList(
                'Due Today',
                data?.dueToday || [],
                <Calendar size={16} color="#38BDF8" />,
                '#38BDF8'
              )}
              {renderSuggestionList(
                'Important',
                data?.important || [],
                <Star size={16} color="#F59E0B" fill="#F59E0B" />,
                '#F59E0B'
              )}
              {renderSuggestionList(
                'Recently Added',
                data?.recent || [],
                <Plus size={16} color={palette.textSecondary} />,
                palette.textSecondary
              )}
              <View style={{ height: 24 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...typography.h3,
    fontSize: 20,
  },
  subtitle: {
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  closeBtn: {
    padding: 4,
  },
  scrollArea: {
    paddingHorizontal: 20,
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  emptyBox: {
    paddingVertical: 50,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
