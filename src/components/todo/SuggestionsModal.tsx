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
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
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
  const styles = useStyles();
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
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { color: palette.textSecondary }]}>
              {items.length}
            </Text>
          </View>
        </View>

        <View style={styles.groupCard}>
        {items.map((item, itemIndex) => {
          // Check if current store task is already in My Day
          const current = tasks.find((t) => t._id === item._id) || item;
          const isInMyDay = current.inMyDay;

          return (
            <View
              key={item._id}
              style={[styles.itemCard, itemIndex < items.length - 1 && styles.separated]}
            >
              <View style={styles.itemInfo}>
                <Text
                  style={[
                    styles.itemTitle,
                    {
                      color: isInMyDay ? palette.textSecondary : palette.text,
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
                      ? palette.tint + '33'
                      : palette.primary,
                  },
                ]}
                onPress={() => handleAddToMyDay(item)}
                accessibilityRole="button"
                accessibilityLabel={isInMyDay ? `${item.title} is in My Day` : `Add ${item.title} to My Day`}
              >
                {isInMyDay ? (
                  <Check size={16} color={palette.primaryText} strokeWidth={2.5} />
                ) : (
                  <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            </View>
          );
        })}
        </View>
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
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.topBar}>
            <View style={styles.titleRow}>
              <Lightbulb size={22} color={palette.warning} />
              <Text style={[styles.title, { color: palette.text }]}>Suggestions</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close suggestions">
              <X size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Review tasks you might want to add to your clean daily slate.
          </Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={palette.tint} />
            </View>
          ) : !hasAnySuggestions ? (
            <View style={styles.emptyBox}>
              <Text style={styles.sparkle}>✨</Text>
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
                <AlertCircle size={16} color={palette.error} />,
                palette.errorText
              )}
              {renderSuggestionList(
                'Due Today',
                data?.dueToday || [],
                <Calendar size={16} color={palette.tint} />,
                palette.infoText
              )}
              {renderSuggestionList(
                'Important',
                data?.important || [],
                <Star size={16} color={palette.warning} fill={palette.warning} />,
                palette.warningText
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

const useStyles = createThemedStyles(palette => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '85%',
    paddingBottom: 24,
    backgroundColor: palette.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 8,
    paddingTop: 12,
    paddingBottom: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...typography.title2, color: palette.text },
  subtitle: { ...typography.subhead, color: palette.textSecondary, paddingHorizontal: 20, marginBottom: 14 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scrollArea: { paddingHorizontal: 16 },
  loadingBox: { paddingVertical: 50, alignItems: 'center' },
  emptyBox: { paddingVertical: 50, alignItems: 'center', paddingHorizontal: 20 },
  sparkle: { fontSize: 36 },
  emptyTitle: { ...typography.title2, color: palette.text, marginTop: 12 },
  emptySub: { ...typography.subhead, color: palette.textSecondary, textAlign: 'center', marginTop: 4 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 },
  sectionTitle: { ...typography.subheadBold },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
    backgroundColor: palette.surfaceAlt,
  },
  badgeText: { ...typography.footnote, fontWeight: '600' },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 52,
    backgroundColor: palette.surface,
  },
  groupCard: { backgroundColor: palette.surface, borderRadius: 26, overflow: 'hidden' },
  separated: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  itemInfo: { flex: 1, marginRight: 10 },
  itemTitle: { ...typography.bodyLarge },
  itemSub: { ...typography.footnote, marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
}));
