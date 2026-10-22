/**
 * Custom units — add/delete user-defined units like "bowl", "slice", "spoon".
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput,
  Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

interface ICustomUnit {
  _id: string;
  symbol: string;
  name: string;
  dimension?: string;
  factorToBase?: number;
}

const BUILT_IN_UNITS = [
  'ml', 'L', 'glass', 'cup', 'oz', 'g', 'mg', 'kcal',
  '°C', '°F', 'min', 'h', 'steps', 'km', 'bpm', 'mmHg', 'mg/dL', 'kg', 'lb',
];

export default function UnitsScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useStyles();
  const [customUnits, setCustomUnits] = useState<ICustomUnit[]>([]);
  const [editing, setEditing] = useState<Partial<ICustomUnit> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res: any = await api.get('/units');
    setCustomUnits(res.data?.units ?? res.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.symbol?.trim()) { Alert.alert('Symbol required', 'e.g. "bowl", "slice"'); return; }
    setSaving(true);
    try {
      if (editing._id) {
        await api.patch(`/units/${editing._id}`, editing);
      } else {
        await api.post('/units', editing);
      }
      await load();
      setEditing(null);
    } finally { setSaving(false); }
  };

  const deleteUnit = (unit: ICustomUnit) => {
    Alert.alert(`Delete "${unit.symbol}"?`, 'Past logs that used this unit keep their original value.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/units/${unit._id}`); load(); } },
    ]);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Custom units' }} />

      <FlatList
        data={customUnits}
        keyExtractor={u => u._id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <Text style={styles.hint}>Add your own units (e.g. "bowl", "tablet", "slice"). These are available in number fields alongside the built-in units.</Text>
            <Text style={styles.sectionLabel}>Built-in units</Text>
            <View style={styles.builtInGrid}>
              {BUILT_IN_UNITS.map(u => (
                <View key={u} style={styles.builtInChip}>
                  <Text style={styles.builtInText}>{u}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.sectionLabel}>Your custom units</Text>
          </>
        }
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No custom units yet.</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowSymbol}><Text style={styles.symbolText}>{item.symbol}</Text></View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.name || item.symbol}</Text>
              {item.dimension && <Text style={styles.rowMeta}>{item.dimension}{item.factorToBase != null ? ` · ×${item.factorToBase} base` : ''}</Text>}
            </View>
            <TouchableOpacity onPress={() => setEditing({ ...item })} style={styles.editBtn} accessibilityRole="button" accessibilityLabel="Edit">
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteUnit(item)} style={styles.deleteBtn} accessibilityRole="button" accessibilityLabel="Delete">
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={<View style={{ height: 100 + insets.bottom }} />}
      />

      <TouchableOpacity style={[styles.fab, { bottom: 20 + insets.bottom }]} onPress={() => setEditing({ symbol: '', name: '' })} accessibilityRole="button" accessibilityLabel="Add custom unit">
        <Text style={styles.fabText}>＋ Add unit</Text>
      </TouchableOpacity>

      {editing && (
        <Modal visible animationType="slide" transparent>
          <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={styles.backdrop} onPress={() => setEditing(null)} />
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setEditing(null)}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
                <Text style={styles.sheetTitle}>{editing._id ? 'Edit unit' : 'New unit'}</Text>
                <TouchableOpacity onPress={save} disabled={saving}><Text style={[styles.done, saving && styles.dim]}>Save</Text></TouchableOpacity>
              </View>
              <View style={styles.sheetBody}>
                <Text style={styles.fieldLabel}>Symbol *</Text>
                <TextInput style={styles.input} value={editing.symbol ?? ''} onChangeText={v => setEditing(e => ({ ...e!, symbol: v }))} placeholder="bowl, tablet, slice, packet" placeholderTextColor={palette.textDisabled} autoFocus autoCapitalize="none" />
                <Text style={styles.fieldLabel}>Full name (optional)</Text>
                <TextInput style={styles.input} value={editing.name ?? ''} onChangeText={v => setEditing(e => ({ ...e!, name: v }))} placeholder="e.g. 250 ml bowl" placeholderTextColor={palette.textDisabled} />
                <Text style={styles.fieldLabel}>Dimension (optional)</Text>
                <TextInput style={styles.input} value={editing.dimension ?? ''} onChangeText={v => setEditing(e => ({ ...e!, dimension: v }))} placeholder="volume, mass, count…" placeholderTextColor={palette.textDisabled} />
                <Text style={styles.fieldLabel}>Conversion to base unit (optional)</Text>
                <TextInput style={styles.input} value={editing.factorToBase != null ? String(editing.factorToBase) : ''} onChangeText={v => setEditing(e => ({ ...e!, factorToBase: v !== '' ? Number(v) : undefined }))} keyboardType="numeric" placeholder="e.g. 250 (for a 250 ml bowl)" placeholderTextColor={palette.textDisabled} />
                <Text style={styles.conversionHint}>If 1 bowl = 250 ml, enter 250 here. Leave blank if no conversion is needed.</Text>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  list: { padding: 16, gap: 8 },
  hint: { ...typography.small, color: palette.textSecondary, marginBottom: 8 },
  sectionLabel: { ...typography.label, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  builtInGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  builtInChip: { backgroundColor: palette.surfaceAlt, borderRadius: 8, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 10, paddingVertical: 4 },
  builtInText: { ...typography.small, color: palette.textSecondary },
  empty: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { ...typography.body, color: palette.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  rowSymbol: { backgroundColor: palette.primary + '14', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: palette.primary + '33' },
  symbolText: { ...typography.bodyBold, color: palette.primary },
  rowInfo: { flex: 1 },
  rowName: { ...typography.body, color: palette.text },
  rowMeta: { ...typography.small, color: palette.textSecondary, marginTop: 2 },
  editBtn: { padding: 6 },
  editBtnText: { ...typography.small, color: palette.primary },
  deleteBtn: { padding: 6 },
  deleteBtnText: { ...typography.body, color: palette.textDisabled },
  fab: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: palette.primary, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 14, elevation: 8 },
  fabText: { ...typography.button, color: '#FFFFFF' },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border },
  sheetTitle: { ...typography.bodyBold, color: palette.text },
  cancel: { ...typography.body, color: palette.textSecondary },
  done: { ...typography.bodyBold, color: palette.primary },
  dim: { opacity: 0.4 },
  sheetBody: { padding: 20, gap: 6, paddingBottom: 40 },
  fieldLabel: { ...typography.label, color: palette.textSecondary, marginTop: 10 },
  input: { backgroundColor: palette.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 12, ...typography.body, color: palette.text },
  conversionHint: { ...typography.small, color: palette.textDisabled, marginTop: 4 },
}));
