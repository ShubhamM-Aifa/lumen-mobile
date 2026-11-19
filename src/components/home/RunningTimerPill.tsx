/**
 * Shown on Today while a timer quick tap is running: what is being timed, for how long, and
 * Stop (logs the minutes) / Cancel (logs nothing).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Timer } from 'lucide-react-native';
import { createThemedStyles, useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useQuickTimerStore, elapsedSeconds } from '../../store/quickTimerStore';

export function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export function RunningTimerPill({ boundaryHour }: { boundaryHour?: number }) {
  const styles = useStyles();
  const { palette } = useTheme();
  const running = useQuickTimerStore(s => s.running);
  const stop = useQuickTimerStore(s => s.stop);
  const cancel = useQuickTimerStore(s => s.cancel);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(id);
  }, [running]);
  if (!running) return null;
  const elapsed = formatElapsed(elapsedSeconds(running));

  return (
    <View style={styles.pill} accessibilityRole="summary" accessibilityLabel={`${running.label} timer running, ${elapsed}`}>
      <Timer size={18} color={palette.primaryText} />
      <Text style={styles.text} numberOfLines={1}>{running.label} · {elapsed}</Text>
      <TouchableOpacity
        onPress={() => Alert.alert('Cancel timer?', 'Nothing will be logged.', [
          { text: 'Keep running', style: 'cancel' },
          { text: 'Cancel timer', style: 'destructive', onPress: cancel },
        ])}
        accessibilityRole="button"
        accessibilityLabel={`Cancel ${running.label} timer`}
        hitSlop={8}
        style={styles.ghost}
      >
        <Text style={styles.ghostText}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => { stop(boundaryHour).catch(() => {}); }}
        accessibilityRole="button"
        accessibilityLabel={`Stop ${running.label} timer and log ${elapsed}`}
        hitSlop={8}
        style={styles.stop}
      >
        <Text style={styles.stopText}>Stop</Text>
      </TouchableOpacity>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  pill: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
    backgroundColor: palette.surface, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: palette.border,
  },
  text: { ...typography.body, color: palette.text, flex: 1, fontWeight: '600' as const },
  ghost: { paddingHorizontal: 8, paddingVertical: 6 },
  ghostText: { ...typography.small, color: palette.textSecondary },
  stop: { backgroundColor: palette.primary, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  stopText: { ...typography.small, color: '#FFFFFF', fontWeight: '700' as const },
}));
