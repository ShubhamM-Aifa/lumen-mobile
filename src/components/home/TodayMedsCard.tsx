/**
 * Today's medicines: one row per planned dose with Taken / Skipped. Tapping the chosen state
 * again clears it ("not marked"). Hidden when no medicine has dose times. A dose that is not
 * marked is never counted as skipped.
 */
import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { createThemedStyles, useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useIosSurfaces } from '../ios/iosTheme';
import { useClearDose, useDoses, useMarkDose, slotLabel, type DoseItem, type DoseSlot } from '../../hooks/useDoses';

export function TodayMedsCard({ day, embedded = false }: { day?: string; embedded?: boolean } = {}) {
  const styles = useStyles();
  const { palette } = useTheme();
  const s = useIosSurfaces();
  const { data } = useDoses(day);
  const mark = useMarkDose();
  const clear = useClearDose();

  const items = (data?.items ?? []).filter(i => i.slots.length > 0);
  if (!data || items.length === 0) {
    return embedded ? <Text style={styles.note}>No planned doses on this day. Add dose times to a medicine in Customize › Medicines.</Text> : null;
  }

  const total = items.reduce((n, i) => n + i.slots.length, 0);
  const done = items.reduce((n, i) => n + i.slots.filter(x => x.state === 'taken' || x.state === 'skipped').length, 0);

  const choose = (item: DoseItem, slot: DoseSlot, status: 'taken' | 'skipped') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const current = slot.state === 'taken' || slot.state === 'skipped' ? slot.state : null;
    if (current === status && slot.doseId) {
      clear.mutate({ medicationId: item.medicationId, doseId: slot.doseId });
      return;
    }
    mark.mutate(
      { medicationId: item.medicationId, dayKey: data.day, slot: slot.slot, status, source: 'checklist' },
      { onError: (err) => Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.') },
    );
  };

  return (
    <View style={[styles.card, embedded && styles.cardEmbedded]}>
      {!embedded ? (
        <View style={styles.head}>
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>Today's medicines</Text>
          <TouchableOpacity onPress={() => router.push('/medications/doses' as never)} accessibilityRole="button" accessibilityLabel="Fill in past days" hitSlop={8}>
            <Text style={styles.link}>Past days</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <Text style={styles.note}>{done} of {total} marked. Not marked is fine; it is never counted as skipped.</Text>
      {items.map(item => item.slots.map(slot => {
        const name = `${item.name}${item.dose ? ` · ${item.dose}${item.unit ? ` ${item.unit}` : ''}` : ''}`;
        const time = slotLabel(slot.slot);
        return (
          <View key={`${item.medicationId}-${slot.slot}`} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.sub}>
                {time}{item.dose ? ` · ${item.dose}${item.unit ? ` ${item.unit}` : ''}` : ''}{slot.amount ? ` · ${slot.amount}` : ''}{slot.state === 'upcoming' ? ' · later today' : ''}
              </Text>
            </View>
            {(['taken', 'skipped'] as const).map(st => {
              const on = slot.state === st;
              return (
                <TouchableOpacity
                  key={st}
                  onPress={() => choose(item, slot, st)}
                  style={[styles.btn, { backgroundColor: on ? `${st === 'taken' ? palette.success : palette.warning}2E` : s.fill }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${name} at ${time}: ${st === 'taken' ? 'Taken' : 'Skipped'}${on ? ', selected. Tap again to clear.' : ''}`}
                >
                  <Text style={[styles.btnText, on && { color: st === 'taken' ? palette.successText : palette.warningText }]}>
                    {on ? '✓ ' : ''}{st === 'taken' ? 'Taken' : 'Skipped'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }))}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: { marginHorizontal: 16, backgroundColor: palette.surface, borderRadius: 26, padding: 16, gap: 10 },
  cardEmbedded: { marginHorizontal: 0 },
  head: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  title: { ...typography.headline, color: palette.text },
  link: { ...typography.footnote, color: palette.primaryText, fontWeight: '600' as const },
  note: { ...typography.footnote, color: palette.textSecondary },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minHeight: 48 },
  rowText: { flex: 1 },
  name: { ...typography.body, color: palette.text, fontWeight: '600' as const },
  sub: { ...typography.footnote, color: palette.textSecondary },
  btn: { minHeight: 40, minWidth: 76, borderRadius: 12, paddingHorizontal: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  btnText: { ...typography.small, color: palette.text, fontWeight: '600' as const },
}));
