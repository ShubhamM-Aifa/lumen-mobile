/**
 * Medications list — add, edit, deactivate medications.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal,
  Pressable, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

interface IMedication {
  _id: string;
  name: string;
  dose?: string;
  unit?: string;
  schedule?: string;
  active: boolean;
}

export default function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useStyles();
  const [meds, setMeds] = useState<IMedication[]>([]);
  const [editing, setEditing] = useState<Partial<IMedication> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res: any = await api.get('/medications');
    setMeds(res.data?.medications ?? res.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) { Alert.alert('Name required'); return; }
    setSaving(true);
    try {
      if (editing._id) {
        await api.patch(`/medications/${editing._id}`, editing);
      } else {
        await api.post('/medications', editing);
      }
      await load();
      setEditing(null);
    } finally { setSaving(false); }
  };

  const deleteMed = (med: IMedication) => {
    Alert.alert(`Delete "${med.name}"?`, 'Or deactivate it to keep your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', onPress: async () => { await api.patch(`/medications/${med._id}`, { active: false }); load(); } },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/medications/${med._id}`); load(); } },
    ]);
  };

  const active = meds.filter(m => m.active);
  const inactive = meds.filter(m => !m.active);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Medications' }} />

      <FlatList
        data={active}
        keyExtractor={m => m._id}
        contentContainerStyle={[styles.list, { paddingBottom: 100 + insets.bottom }]}
        ListHeaderComponent={<Text style={styles.hint}>Track what you take so Lumen can include it in your logs and insights.</Text>}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No medications yet.</Text></View>}
        ListFooterComponent={inactive.length > 0 ? (
          <View style={styles.inactiveSection}>
            <Text style={styles.sectionLabel}>Inactive ({inactive.length})</Text>
            {inactive.map(m => (
              <TouchableOpacity key={m._id} style={styles.inactiveRow} onPress={() => setEditing({ ...m })}>
                <Text style={styles.inactiveName}>{m.name}</Text>
                <Text style={styles.inactiveBadge}>Inactive</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => setEditing({ ...item })} accessibilityRole="button">
            <View style={styles.rowLeft}>
              <Text style={styles.rowName}>💊 {item.name}</Text>
              {(item.dose || item.unit || item.schedule) && (
                <Text style={styles.rowMeta}>
                  {[item.dose, item.unit, item.schedule].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={[styles.fab, { bottom: 20 + insets.bottom }]} onPress={() => setEditing({ active: true, name: '' })} accessibilityRole="button" accessibilityLabel="Add medication">
        <Text style={styles.fabText}>＋ Add medication</Text>
      </TouchableOpacity>

      {editing && (
        <Modal visible animationType="slide" transparent>
          <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={styles.backdrop} onPress={() => setEditing(null)} />
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setEditing(null)}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
                <Text style={styles.sheetTitle}>{editing._id ? 'Edit' : 'Add'} medication</Text>
                <TouchableOpacity onPress={save} disabled={saving}><Text style={[styles.done, saving && styles.dim]}>Save</Text></TouchableOpacity>
              </View>
              <View style={styles.sheetBody}>
                <Text style={styles.fieldLabel}>Name *</Text>
                <TextInput style={styles.input} value={editing.name ?? ''} onChangeText={v => setEditing(e => ({ ...e!, name: v }))} placeholder="e.g. Hydroxychloroquine, Vitamin D" placeholderTextColor={palette.textDisabled} autoFocus />
                <Text style={styles.fieldLabel}>Dose</Text>
                <TextInput style={styles.input} value={editing.dose ?? ''} onChangeText={v => setEditing(e => ({ ...e!, dose: v }))} placeholder="200" placeholderTextColor={palette.textDisabled} keyboardType="numeric" />
                <Text style={styles.fieldLabel}>Unit</Text>
                <TextInput style={styles.input} value={editing.unit ?? ''} onChangeText={v => setEditing(e => ({ ...e!, unit: v }))} placeholder="mg, mcg, IU" placeholderTextColor={palette.textDisabled} />
                <Text style={styles.fieldLabel}>Schedule</Text>
                <TextInput style={styles.input} value={editing.schedule ?? ''} onChangeText={v => setEditing(e => ({ ...e!, schedule: v }))} placeholder="e.g. Once daily with food" placeholderTextColor={palette.textDisabled} />
                <View style={styles.toggleRow}>
                  <Text style={styles.fieldLabel}>Active</Text>
                  <Switch value={editing.active ?? true} onValueChange={v => setEditing(e => ({ ...e!, active: v }))} trackColor={{ false: palette.border, true: palette.primary + '88' }} thumbColor={editing.active ? palette.primary : palette.textDisabled} />
                </View>
                {editing._id && (
                  <TouchableOpacity style={styles.deleteRow} onPress={() => { setEditing(null); deleteMed(editing as IMedication); }}>
                    <Text style={styles.deleteText}>Delete medication</Text>
                  </TouchableOpacity>
                )}
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
  list: { padding: 16, paddingBottom: 100, gap: 8 },
  hint: { ...typography.small, color: palette.textSecondary, marginBottom: 8 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { ...typography.body, color: palette.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 14, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 14 },
  rowLeft: { flex: 1 },
  rowName: { ...typography.bodyBold, color: palette.text },
  rowMeta: { ...typography.small, color: palette.textSecondary, marginTop: 2 },
  chevron: { ...typography.h4, color: palette.textDisabled },
  inactiveSection: { marginTop: 24, gap: 6 },
  sectionLabel: { ...typography.label, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 4 },
  inactiveRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 10, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 12, opacity: 0.7 },
  inactiveName: { ...typography.body, color: palette.textSecondary, flex: 1 },
  inactiveBadge: { ...typography.caption, color: palette.textDisabled, backgroundColor: palette.surfaceAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
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
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  deleteRow: { marginTop: 24, borderRadius: 12, borderWidth: 1, borderColor: palette.error + '55', padding: 12, alignItems: 'center' },
  deleteText: { ...typography.bodyBold, color: palette.error },
}));
