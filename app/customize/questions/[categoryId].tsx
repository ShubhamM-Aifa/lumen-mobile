/**
 * Questions list for a category.
 * Tap to edit, ↑↓ to reorder, "＋ New question" at bottom.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IQuestion } from '@lumen/shared';
import { useConfigStore } from '../../../src/store/configStore';
import { api } from '../../../src/api/client';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';

const FREQ_LABEL: Record<string, string> = {
  anytime: 'Any time', once_per_day: 'Once/day',
  per_meal: 'Per meal', morning: 'Morning', evening: 'Evening',
};

export default function QuestionsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { config, fetchConfig, invalidate } = useConfigStore();
  const [reordering, setReordering] = useState(false);

  useEffect(() => { fetchConfig(); }, []);

  const category = config?.categories.find(c => c._id === categoryId);
  const questions = (config?.questions ?? [])
    .filter(q => q.categoryId === categoryId)
    .sort((a, b) => a.order - b.order);

  const active   = questions.filter(q => q.isActive);
  const archived = questions.filter(q => !q.isActive);

  const moveUp = async (q: IQuestion) => {
    const idx = active.findIndex(x => x._id === q._id);
    if (idx <= 0) return;
    const ids = active.map(x => x._id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    setReordering(true);
    try { await api.patch('/questions/reorder', { ids }); invalidate(); await fetchConfig(); }
    finally { setReordering(false); }
  };

  const moveDown = async (q: IQuestion) => {
    const idx = active.findIndex(x => x._id === q._id);
    if (idx < 0 || idx >= active.length - 1) return;
    const ids = active.map(x => x._id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    setReordering(true);
    try { await api.patch('/questions/reorder', { ids }); invalidate(); await fetchConfig(); }
    finally { setReordering(false); }
  };

  const archive = (q: IQuestion) => {
    Alert.alert(
      `Archive "${q.title}"?`,
      'Existing logs are preserved. You can restore it later at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive', style: 'destructive',
          onPress: async () => {
            await api.post(`/questions/${q._id}/archive`, {});
            invalidate(); await fetchConfig();
          },
        },
      ],
    );
  };

  const unarchive = async (q: IQuestion) => {
    try {
      await api.post(`/questions/${q._id}/unarchive`, {});
      invalidate(); await fetchConfig();
    } catch (err: any) {
      Alert.alert('Restore failed', err?.message || 'Unknown error');
    }
  };

  const deletePermanently = (q: IQuestion) => {
    Alert.alert(
      `Permanently delete "${q.title}"?`,
      'This action cannot be undone. Questions with logged data cannot be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              const res: any = await api.delete(`/questions/${q._id}`);
              invalidate(); await fetchConfig();
              Alert.alert('Deleted', res.message || 'Question deleted.');
            } catch (err: any) {
              Alert.alert('Cannot Delete', err?.message || 'Error deleting question');
            }
          },
        },
      ],
    );
  };

  const renderRow = ({ item, index }: { item: IQuestion; index: number }) => (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.rowMain}
        onPress={() => router.push(`/customize/question/${item._id}?categoryId=${categoryId}`)}
        accessibilityRole="button"
      >
        {item.icon ? <Text style={styles.icon}>{item.icon}</Text> : null}
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={styles.rowMeta}>
            {item.selectionType === 'multiple' ? 'Multi' : 'Single'} · {FREQ_LABEL[item.frequency]}
            {item.required ? ' · Required' : ''}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.arrowBtn, index === 0 && styles.disabled]} onPress={() => moveUp(item)} disabled={index === 0 || reordering} accessibilityLabel="Move up">
          <Text style={styles.arrow}>↑</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.arrowBtn, index === active.length - 1 && styles.disabled]} onPress={() => moveDown(item)} disabled={index === active.length - 1 || reordering} accessibilityLabel="Move down">
          <Text style={styles.arrow}>↓</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreBtn} onPress={() => archive(item)} accessibilityLabel="Archive">
          <Text style={styles.moreText}>⋯</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: category?.name ?? 'Questions' }} />

      <FlatList
        data={active}
        keyExtractor={q => q._id}
        contentContainerStyle={[styles.list, { paddingBottom: 100 + insets.bottom }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No questions yet.</Text>
            <Text style={styles.emptyHint}>Tap "＋ New question" to add your first.</Text>
          </View>
        }
        ListFooterComponent={
          archived.length > 0 ? (
            <View style={styles.archivedSection}>
              <Text style={styles.sectionLabel}>Archived ({archived.length})</Text>
              {archived.map(q => (
                <View key={q._id} style={styles.archivedRow}>
                  <TouchableOpacity
                    style={styles.archivedRowMain}
                    onPress={() => router.push(`/customize/question/${q._id}?categoryId=${categoryId}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit archived question ${q.title}`}
                  >
                    <Text style={styles.archivedTitle} numberOfLines={1}>{q.title}</Text>
                    <Text style={styles.archivedBadge}>Archived</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.restoreBtn}
                    onPress={() => unarchive(q)}
                    accessibilityRole="button"
                    accessibilityLabel={`Restore ${q.title}`}
                  >
                    <Text style={styles.restoreBtnText}>↺ Restore</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteIconBtn}
                    onPress={() => deletePermanently(q)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${q.title}`}
                  >
                    <Text style={styles.deleteIconText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null
        }
        renderItem={renderRow}
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: 20 + insets.bottom }]}
        onPress={() => router.push(`/customize/question/new?categoryId=${categoryId}`)}
        accessibilityRole="button"
        accessibilityLabel="New question"
      >
        <Text style={styles.fabText}>＋ New question</Text>
      </TouchableOpacity>
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  list: { padding: 16, paddingBottom: 100, gap: 8 },
  row: { backgroundColor: palette.surface, borderRadius: 14, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' },
  rowMain: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  icon: { fontSize: 20 },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyBold, color: palette.text },
  rowMeta: { ...typography.small, color: palette.textSecondary, marginTop: 2 },
  chevron: { ...typography.h4, color: palette.textDisabled },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surfaceAlt },
  arrowBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRightWidth: 1, borderRightColor: palette.border },
  disabled: { opacity: 0.3 },
  arrow: { ...typography.bodyBold, color: palette.primary },
  moreBtn: { paddingVertical: 8, paddingHorizontal: 20, alignItems: 'center' },
  moreText: { ...typography.h4, color: palette.textSecondary },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyText: { ...typography.body, color: palette.textSecondary },
  emptyHint: { ...typography.small, color: palette.textDisabled },
  archivedSection: { marginTop: 24, gap: 6 },
  sectionLabel: { ...typography.label, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 4 },
  archivedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: palette.surface, borderRadius: 10,
    borderWidth: 1, borderColor: palette.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  archivedRowMain: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  archivedTitle: { ...typography.body, color: palette.textSecondary, flex: 1 },
  archivedBadge: { ...typography.caption, color: palette.textDisabled, backgroundColor: palette.surfaceAlt, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  restoreBtn: {
    backgroundColor: palette.secondary + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: palette.secondary + '50',
  },
  restoreBtnText: { ...typography.smallBold, color: palette.secondary },
  deleteIconBtn: {
    backgroundColor: palette.error + '14', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: palette.error + '40',
  },
  deleteIconText: { fontSize: 14 },
  fab: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: palette.primary, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 14, shadowColor: palette.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  fabText: { ...typography.button, color: palette.white },
}));
