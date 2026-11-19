/**
 * For a medicine reminder: which medicine it is for, so the notification's Taken / Skip buttons
 * mark that medicine's dose. Shown only for Medication reminders.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Med { _id: string; name: string; dose?: string; unit?: string; active?: boolean }

export function useMedicationList() {
  return useQuery({
    queryKey: ['medications'],
    queryFn: async () => {
      const res = await api.get<Med[] | { medications: Med[] }>('/medications');
      return Array.isArray(res) ? res : res?.medications ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function MedicineLinkPicker({ value, onChange }: { value?: string; onChange: (id: string | undefined) => void }) {
  const styles = useStyles();
  const { data: meds = [] } = useMedicationList();
  const shown = meds.filter(m => m.active !== false || m._id === value);

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Which medicine?</Text>
      <Text style={styles.help}>Taken / Skip on the reminder then marks this medicine's dose for that time.</Text>
      {shown.length === 0 ? (
        <Text style={styles.help}>Add the medicine in Customize › Medicines first.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {[{ _id: '', name: 'None' } as Med, ...shown].map(m => {
            const on = (m._id || undefined) === value;
            return (
              <TouchableOpacity
                key={m._id || 'none'}
                onPress={() => onChange(m._id || undefined)}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={m._id ? `Link to ${m.name}` : 'Not linked to a medicine'}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{m.name}{m.dose ? ` ${m.dose}${m.unit ? ` ${m.unit}` : ''}` : ''}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  section: { gap: 6, marginBottom: 20 },
  label: { ...typography.label, color: palette.text },
  help: { ...typography.footnote, color: palette.textSecondary },
  row: { gap: 8, paddingVertical: 4 },
  chip: { borderRadius: 16, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' as const, backgroundColor: palette.surfaceAlt },
  chipOn: { backgroundColor: palette.primary },
  chipText: { ...typography.small, color: palette.text, fontWeight: '600' as const },
  chipTextOn: { color: '#FFFFFF' },
}));
