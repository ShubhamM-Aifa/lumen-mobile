/**
 * Quick actions list — manage the home-screen one-tap buttons.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Platform,
} from 'react-native';
import { AppleSwitch } from '../../src/components/common/AppleSwitch';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IQuickAction } from '@lumen/shared';
import { useConfigStore } from '../../src/store/configStore';
import { api } from '../../src/api/client';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { QuickActionIcon } from '../../src/components/QuickActionIcon';

const MODE_LABEL: Record<string, string> = {
  counter: 'Counter', timer: 'Timer', toggle: 'Toggle',
};

export default function QuickActionsScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useStyles();
  const { config, fetchConfig, invalidate } = useConfigStore();
  const [reordering, setReordering] = useState(false);

  useEffect(() => { fetchConfig(); }, []);

  const actions = (config?.quickActions ?? []).sort((a, b) => a.order - b.order);
  const visible  = actions.filter(a => a.isVisible);
  const hidden   = actions.filter(a => !a.isVisible);

  const toggleVisible = async (action: IQuickAction) => {
    await api.patch(`/quick-actions/${action._id}`, { isVisible: !action.isVisible });
    invalidate(); await fetchConfig();
  };

  const deletePermanently = (action: IQuickAction) => {
    Alert.alert(
      `Permanently delete "${action.label}"?`,
      'This action cannot be undone. Quick actions with logged history cannot be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              const res: any = await api.delete(`/quick-actions/${action._id}`);
              invalidate(); await fetchConfig();
              Alert.alert('Deleted', res.message || 'Quick action deleted.');
            } catch (err: any) {
              Alert.alert('Cannot Delete', err?.message || 'Error deleting button');
            }
          },
        },
      ],
    );
  };

  const move = async (action: IQuickAction, dir: 'up' | 'down') => {
    const idx = visible.findIndex(a => a._id === action._id);
    const ids = visible.map(a => a._id);
    if (dir === 'up' && idx > 0) [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    else if (dir === 'down' && idx < visible.length - 1) [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    else return;
    setReordering(true);
    try { await api.patch('/quick-actions/reorder', { ids }); invalidate(); await fetchConfig(); }
    finally { setReordering(false); }
  };

  const renderRow = ({ item, index }: { item: IQuickAction; index: number }) => (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.rowMain}
        onPress={() => router.push(`/customize/quick-action/${item._id}`)}
        accessibilityRole="button"
      >
        <View style={[styles.iconBadge, { backgroundColor: item.color + '22', borderColor: item.color + '55' }]}>
          <QuickActionIcon
            icon={item.icon}
            templateKey={item.templateKey}
            label={item.label}
            color={item.color}
            size={18}
          />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{item.label}</Text>
          <Text style={styles.rowMeta}>
            {MODE_LABEL[item.mode] ?? item.mode}
            {item.dailyGoal ? ` · Goal ${item.dailyGoal}` : ''}
            {item.unit ? ` · ${item.unit}` : ''}
          </Text>
        </View>
        <AppleSwitch
          value={item.isVisible}
          onValueChange={() => toggleVisible(item)}
          activeColor={palette.primary || '#34C759'}
          accessibilityLabel={`${item.label} visible on home screen`}
        />
      </TouchableOpacity>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.arrowBtn, index === 0 && styles.dim]} onPress={() => move(item, 'up')} disabled={index === 0 || !item.isVisible || reordering} accessibilityLabel="Move up"><Text style={styles.arrow}>↑</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.arrowBtn, index === visible.length - 1 && styles.dim]} onPress={() => move(item, 'down')} disabled={index === visible.length - 1 || !item.isVisible || reordering} accessibilityLabel="Move down"><Text style={styles.arrow}>↓</Text></TouchableOpacity>
        <TouchableOpacity style={styles.editBtn} onPress={() => router.push(`/customize/quick-action/${item._id}`)} accessibilityLabel="Edit"><Text style={styles.editBtnText}>Edit ›</Text></TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Quick-tap buttons' }} />

      <FlatList
        data={visible}
        keyExtractor={a => a._id}
        contentContainerStyle={[styles.list, { paddingBottom: 100 + (Platform.OS === 'android' ? Math.max(insets.bottom, 48) : insets.bottom) }]}
        ListHeaderComponent={<Text style={styles.hint}>Toggle the switch to show/hide on your home screen.</Text>}
        ListFooterComponent={
          hidden.length > 0 ? (
            <View style={styles.hiddenSection}>
              <Text style={styles.sectionLabel}>Archived / Hidden ({hidden.length})</Text>
              {hidden.map(a => (
                <View key={a._id} style={styles.hiddenRow}>
                  <TouchableOpacity style={styles.hiddenRowMain} onPress={() => router.push(`/customize/quick-action/${a._id}`)}>
                    <Text style={styles.hiddenIcon}>{a.icon}</Text>
                    <Text style={styles.hiddenLabel} numberOfLines={1}>{a.label}</Text>
                  </TouchableOpacity>
                  <AppleSwitch
                    value={false}
                    onValueChange={() => toggleVisible(a)}
                    activeColor={palette.primary || '#34C759'}
                    accessibilityLabel={`Unhide ${a.label}`}
                  />
                  <TouchableOpacity
                    style={styles.deleteIconBtn}
                    onPress={() => deletePermanently(a)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${a.label}`}
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
        style={[styles.fab, { bottom: 20 + (Platform.OS === 'android' ? Math.max(insets.bottom, 48) : insets.bottom) }]}
        onPress={() => router.push('/customize/quick-action/new')}
        accessibilityRole="button"
        accessibilityLabel="New quick action"
      >
        <Text style={styles.fabText}>＋ New button</Text>
      </TouchableOpacity>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  list: { padding: 16, paddingBottom: 100, gap: 8 },
  hint: { ...typography.small, color: palette.textSecondary, marginBottom: 8 },
  row: { backgroundColor: palette.surface, borderRadius: 14, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' },
  rowMain: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  iconBadge: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  rowText: { flex: 1 },
  rowLabel: { ...typography.bodyBold, color: palette.text },
  rowMeta: { ...typography.small, color: palette.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surfaceAlt },
  arrowBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRightWidth: 1, borderRightColor: palette.border },
  dim: { opacity: 0.3 },
  arrow: { ...typography.bodyBold, color: palette.primaryText },
  editBtn: { paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' },
  editBtnText: { ...typography.small, color: palette.primaryText },
  hiddenSection: { marginTop: 24, gap: 6 },
  sectionLabel: { ...typography.label, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 4 },
  hiddenRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  hiddenRowMain: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  hiddenIcon: { fontSize: 20 },
  hiddenLabel: { ...typography.body, color: palette.textSecondary, flex: 1 },
  deleteIconBtn: {
    backgroundColor: palette.error + '14', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: palette.error + '40',
  },
  deleteIconText: { fontSize: 14 },
  fab: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: palette.primary, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 14, shadowColor: palette.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  fabText: { ...typography.button, color: '#FFFFFF' },
}));
