/**
 * When a medicine is taken: dose times ("8:00 AM", "8:00 PM"), which weekdays, or "as needed".
 * Planned doses drive the Today checklist and let Explore compare skipped-dose days.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import AppDateTimePicker from '../common/AppDateTimePicker';
import { InsetGroup, GroupedRow } from '../ios/InsetGroup';
import { createThemedStyles, useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useIosSurfaces } from '../ios/iosTheme';
import { slotLabel } from '../../hooks/useDoses';

export interface DosePlan {
  prn: boolean;
  doseTimes: Array<{ slot: string; amount?: string }>;
  daysOfWeek: number[];
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const toSlot = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Adds a time once, keeping the list sorted. */
export function addSlot(times: DosePlan['doseTimes'], slot: string): DosePlan['doseTimes'] {
  if (times.some(t => t.slot === slot)) return times;
  return [...times, { slot }].sort((a, b) => a.slot.localeCompare(b.slot));
}

export function DoseTimesEditor({ value, onChange }: { value: DosePlan; onChange: (next: DosePlan) => void }) {
  const styles = useStyles();
  const { palette } = useTheme();
  const s = useIosSurfaces();
  const [picking, setPicking] = useState(false);
  const pickerValue = useMemo(() => { const d = new Date(); d.setHours(8, 0, 0, 0); return d; }, []);
  const everyDay = value.daysOfWeek.length === 0;

  const toggleDay = (i: number) => {
    const set = new Set(everyDay ? [0, 1, 2, 3, 4, 5, 6] : value.daysOfWeek);
    if (set.has(i)) set.delete(i); else set.add(i);
    const days = [...set].sort();
    // All seven (or none) means every day.
    onChange({ ...value, daysOfWeek: days.length === 7 || days.length === 0 ? [] : days });
  };

  return (
    <InsetGroup>
      <GroupedRow
        label="As needed"
        sub={value.prn ? 'Only taken when needed: never counted as skipped' : 'Taken on a schedule'}
        toggle
        toggled={value.prn}
        onToggle={(v) => onChange({ ...value, prn: v })}
      />
      {!value.prn ? (
        <View style={styles.block}>
          <Text style={styles.label}>Dose times</Text>
          <View style={styles.chips}>
            {value.doseTimes.map(t => (
              <View key={t.slot} style={[styles.chip, { backgroundColor: s.fill }]}>
                <Text style={styles.chipText}>{slotLabel(t.slot)}</Text>
                <TouchableOpacity
                  onPress={() => onChange({ ...value, doseTimes: value.doseTimes.filter(x => x.slot !== t.slot) })}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${slotLabel(t.slot)}`}
                  hitSlop={10}
                >
                  <X size={14} color={palette.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => setPicking(true)}
              style={[styles.chip, styles.add]}
              accessibilityRole="button"
              accessibilityLabel="Add a dose time"
            >
              <Plus size={14} color={palette.primaryText} />
              <Text style={[styles.chipText, { color: palette.primaryText }]}>Add time</Text>
            </TouchableOpacity>
          </View>
          {value.doseTimes.length > 0 ? (
            <>
              <Text style={styles.label}>Days</Text>
              <View style={styles.days} accessibilityRole="none">
                {WEEKDAYS.map((d, i) => {
                  const on = everyDay || value.daysOfWeek.includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => toggleDay(i)}
                      style={[styles.day, { backgroundColor: on ? palette.primary : s.fill }]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={WEEKDAY_NAMES[i]}
                    >
                      <Text style={[styles.dayText, on && { color: '#FFFFFF' }]}>{d}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.help}>{everyDay ? 'Every day.' : 'Only on the highlighted days.'} Changes apply from today; past days keep their old plan.</Text>
            </>
          ) : (
            <Text style={styles.help}>Add times to get a daily checklist and see what follows a skipped dose.</Text>
          )}
        </View>
      ) : null}
      <AppDateTimePicker
        visible={picking}
        mode="time"
        value={pickerValue}
        title="Dose time"
        onClose={() => setPicking(false)}
        onChange={(d) => { setPicking(false); onChange({ ...value, doseTimes: addSlot(value.doseTimes, toSlot(d)) }); }}
      />
    </InsetGroup>
  );
}

const useStyles = createThemedStyles(palette => ({
  block: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  label: { ...typography.footnote, color: palette.textSecondary, fontWeight: '600' as const },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  chip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, borderRadius: 14, paddingHorizontal: 12, minHeight: 36 },
  add: { borderWidth: 1, borderColor: palette.border },
  chipText: { ...typography.small, color: palette.text, fontWeight: '600' as const },
  days: { flexDirection: 'row' as const, gap: 6 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center' as const, justifyContent: 'center' as const },
  dayText: { ...typography.small, color: palette.text, fontWeight: '700' as const },
  help: { ...typography.footnote, color: palette.textSecondary },
}));
