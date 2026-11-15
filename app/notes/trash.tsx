import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  RotateCcw,
  Trash2,
  AlertTriangle,
  FileText,
} from 'lucide-react-native';
import { useNoteStore, TrashedNoteSummary } from '../../src/store/noteStore';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { safeGoBack } from '../../src/utils/navigation';

export default function TrashScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useStyles();

  const {
    trash,
    fetchTrash,
    restoreFromTrash,
    permanentlyDelete,
    isLoading,
  } = useNoteStore();

  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const handleRestore = async (id: string, title: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoadingIds((prev) => new Set(prev).add(id));
    try {
      await restoreFromTrash(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', `Could not restore "${title}".`);
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handlePermanentDelete = (id: string, title: string) => {
    Alert.alert(
      'Delete Permanently',
      `Are you sure you want to permanently delete "${title || 'Untitled'}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setLoadingIds((prev) => new Set(prev).add(id));
            try {
              await permanentlyDelete(id);
            } catch {
              Alert.alert('Error', `Could not permanently delete note.`);
            } finally {
              setLoadingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      {/* Top Navbar */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => safeGoBack('/notes')}
          accessibilityRole="button"
          accessibilityLabel="Back to notes"
        >
          <ArrowLeft size={22} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.navbarTitle, { color: palette.text }]}>Trash</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* 30-Day Auto Purge Notice */}
      <View style={[styles.noticeBanner, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
        <AlertTriangle size={15} color={palette.textSecondary} />
        <Text style={[styles.noticeText, { color: palette.textSecondary }]}>
          Items in Trash are automatically deleted forever after 30 days.
        </Text>
      </View>

      {/* Trash Items List */}
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {trash.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWell, { backgroundColor: palette.surfaceAlt }]}>
              <Trash2 size={36} color={palette.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>Trash is Empty</Text>
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
              Pages and databases you delete will appear here before being permanently purged.
            </Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {trash.map((item) => {
              const isItemBusy = loadingIds.has(item._id);

              return (
                <View
                  key={item._id}
                  style={[
                    styles.itemCard,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                  ]}
                >
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemEmoji}>{item.icon || '📄'}</Text>
                    <View style={styles.itemTextWrap}>
                      <Text
                        style={[styles.itemTitle, { color: palette.text }]}
                        numberOfLines={1}
                      >
                        {item.title || 'Untitled'}
                      </Text>
                      {item.deletedAt && (
                        <Text style={[styles.deletedTime, { color: palette.textSecondary }]}>
                          Trashed {formatDate(item.deletedAt)}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.itemActions}>
                    {isItemBusy ? (
                      <ActivityIndicator size="small" color={palette.primary} />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: palette.surfaceAlt }]}
                          onPress={() => handleRestore(item._id, item.title)}
                          accessibilityRole="button"
                          accessibilityLabel="Restore page"
                        >
                          <RotateCcw size={15} color={palette.primary} />
                          <Text style={[styles.actionBtnText, { color: palette.primary }]}>
                            Restore
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: palette.error + '18' }]}
                          onPress={() => handlePermanentDelete(item._id, item.title)}
                          accessibilityRole="button"
                          accessibilityLabel="Delete permanently"
                        >
                          <Trash2 size={15} color={palette.errorText} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((palette) => ({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navbarTitle: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  noticeText: {
    fontSize: 12,
    flexShrink: 1,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 30,
  },
  emptyIconWell: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    ...typography.h2,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  itemsList: {
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemEmoji: {
    fontSize: 22,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  deletedTime: {
    fontSize: 11,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
}));

