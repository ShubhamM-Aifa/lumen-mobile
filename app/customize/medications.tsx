/**
 * Medications Screen — Apple InsetGroup style
 * Route: /customize/medications
 * Allows adding, editing, deactivating, and managing medications.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { ChevronLeft, Plus, Pill, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { safeGoBack } from '../../src/utils/navigation';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { ScreenTopBar, HeaderTextButton } from '../../src/components/ios/ScreenTopBar';
import { InsetGroup, GroupedRow } from '../../src/components/ios/InsetGroup';
import { AppleSwitch } from '../../src/components/common/AppleSwitch';
import { api } from '../../src/api/client';

export interface IMedication {
  _id: string;
  name: string;
  dose?: string;
  unit?: string;
  schedule?: string;
  active: boolean;
}

export default function MedicationsScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const [meds, setMeds] = useState<IMedication[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<IMedication> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res: any = await api.get('/medications');
      setMeds(res.data?.medications ?? res.data ?? []);
    } catch {
      // Silently handle offline/error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    Haptics.selectionAsync();
    setEditing({ active: true, name: '', dose: '', unit: 'mg', schedule: '' });
  };

  const openEdit = (med: IMedication) => {
    Haptics.selectionAsync();
    setEditing({ ...med });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) {
      Alert.alert('Name Required', 'Please enter a medication name.');
      return;
    }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (editing._id) {
        await api.patch(`/medications/${editing._id}`, editing);
      } else {
        await api.post('/medications', editing);
      }
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(null);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Unable to save medication.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMed = (med: IMedication) => {
    Alert.alert(`Delete "${med.name}"?`, 'Or mark it inactive to preserve your tracking history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Inactive',
        onPress: async () => {
          await api.patch(`/medications/${med._id}`, { active: false });
          load();
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.delete(`/medications/${med._id}`);
          load();
        },
      },
    ]);
  };

  const active = meds.filter((m) => m.active);
  const inactive = meds.filter((m) => !m.active);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LargeTitleHeader
          title="Medications"
          subtitle="Track what you take so Lumen can include it in logs and patterns."
          leading={
            <GlassCircleButton
              accessibilityLabel="Go back"
              onPress={() => safeGoBack('/(tabs)/customize')}
            >
              <ChevronLeft size={22} color={palette.text} strokeWidth={2.4} />
            </GlassCircleButton>
          }
          actions={
            <GlassCircleButton accessibilityLabel="Add medication" onPress={openAdd}>
              <Plus size={20} color={palette.text} strokeWidth={2.2} />
            </GlassCircleButton>
          }
        />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : (
          <View style={styles.contentWrap}>
            {/* Active Medications */}
            <InsetGroup title="Active">
              {active.length > 0 ? (
                active.map((med) => {
                  const meta = [med.dose, med.unit, med.schedule].filter(Boolean).join(' · ');
                  return (
                    <GroupedRow
                      key={med._id}
                      icon={Pill}
                      tile="#AF52DE"
                      label={med.name}
                      sub={meta || 'Active'}
                      chevron
                      onPress={() => openEdit(med)}
                    />
                  );
                })
              ) : (
                <GroupedRow
                  icon={Pill}
                  tile="#8E8E93"
                  label="No active medications"
                  sub="Tap + above to add a medication"
                  disabled
                />
              )}
            </InsetGroup>

            {/* Inactive Medications */}
            {inactive.length > 0 && (
              <InsetGroup title={`Inactive (${inactive.length})`}>
                {inactive.map((med) => (
                  <GroupedRow
                    key={med._id}
                    icon={Pill}
                    tile="#8E8E93"
                    label={med.name}
                    sub="Inactive"
                    value="Restore"
                    valueColor={palette.primary}
                    chevron
                    onPress={() => openEdit(med)}
                  />
                ))}
              </InsetGroup>
            )}
          </View>
        )}
      </ScrollView>

      {/* Edit / Add Medication Apple Sheet Modal */}
      {editing && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setEditing(null)}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable style={styles.backdrop} onPress={() => setEditing(null)} />
            <View style={[styles.sheetCard, { backgroundColor: palette.background }]}>
              <ScreenTopBar
                title={editing._id ? 'Edit Medication' : 'Add Medication'}
                backLabel="Cancel"
                backIcon="close"
                onBack={() => setEditing(null)}
                sheet
                right={
                  <HeaderTextButton
                    label="Save"
                    prominent
                    onPress={save}
                    loading={saving}
                    disabled={saving}
                  />
                }
              />

              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <InsetGroup>
                  <View style={styles.sheetFieldRow}>
                    <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Name</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: palette.text }]}
                      value={editing.name ?? ''}
                      onChangeText={(v) => setEditing((e) => ({ ...e!, name: v }))}
                      placeholder="e.g. Hydroxychloroquine, Vitamin D"
                      placeholderTextColor={palette.placeholder}
                      autoFocus={!editing._id}
                    />
                  </View>
                  <View style={styles.sheetFieldRow}>
                    <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Dose</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: palette.text }]}
                      value={editing.dose ?? ''}
                      onChangeText={(v) => setEditing((e) => ({ ...e!, dose: v }))}
                      placeholder="e.g. 200"
                      placeholderTextColor={palette.placeholder}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.sheetFieldRow}>
                    <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Unit</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: palette.text }]}
                      value={editing.unit ?? ''}
                      onChangeText={(v) => setEditing((e) => ({ ...e!, unit: v }))}
                      placeholder="e.g. mg, mcg, IU"
                      placeholderTextColor={palette.placeholder}
                    />
                  </View>
                  <View style={styles.sheetFieldRow}>
                    <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Schedule</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: palette.text }]}
                      value={editing.schedule ?? ''}
                      onChangeText={(v) => setEditing((e) => ({ ...e!, schedule: v }))}
                      placeholder="e.g. Once daily with food"
                      placeholderTextColor={palette.placeholder}
                    />
                  </View>
                </InsetGroup>

                <InsetGroup>
                  <GroupedRow
                    label="Active"
                    sub="Included in logs, reminders & insights"
                    toggle
                    toggled={editing.active ?? true}
                    onToggle={(v) => setEditing((e) => ({ ...e!, active: v }))}
                  />
                </InsetGroup>

                {editing._id && (
                  <InsetGroup>
                    <GroupedRow
                      label="Delete Medication"
                      destructive
                      onPress={() => {
                        const m = editing as IMedication;
                        setEditing(null);
                        deleteMed(m);
                      }}
                    />
                  </InsetGroup>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((palette) => ({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    paddingBottom: 40,
  },
  contentWrap: {
    gap: 20,
    marginTop: 12,
  },
  loadingWrap: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    paddingBottom: 24,
    overflow: 'hidden',
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingTop: 16,
    gap: 16,
  },
  sheetFieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  fieldLabel: {
    ...typography.caption1,
    fontWeight: '500',
  },
  fieldInput: {
    ...typography.body,
    padding: 0,
    fontSize: 17,
  },
}));
