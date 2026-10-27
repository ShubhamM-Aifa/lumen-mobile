/**
 * DurationPicker — h/m entry stepper + an optional start/stop timer mode.
 * value and onChange work in total seconds.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Pressable,
} from 'react-native';
import { FieldDefinition } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  field: FieldDefinition;
  value: number;  // seconds
  onChange: (seconds: number) => void;
}

function pad(n: number) { return String(Math.floor(n)).padStart(2, '0'); }

function fmtDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${pad(h)}h ${pad(m)}m` : `${pad(m)}m ${pad(sec)}s`;
}

export function DurationPicker({ field, value, onChange }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const [mode, setMode] = useState<'manual' | 'timer'>('manual');
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const tickRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const hours   = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  const changeH = (delta: number) =>
    onChange(Math.max(0, value + delta * 3600));
  const changeM = (delta: number) =>
    onChange(Math.max(0, value + delta * 60));

  const startTimer = () => {
    startRef.current = Date.now() - elapsed * 1000;
    setRunning(true);
    tickRef.current = setInterval(() => {
      const e = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(e);
    }, 500);
  };

  const stopTimer = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    setRunning(false);
    onChange(elapsed);
  };

  const resetTimer = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    setRunning(false);
    setElapsed(0);
    onChange(0);
  };

  return (
    <View style={styles.wrapper}>
      {/* Mode tabs */}
      <View style={styles.tabs}>
        {(['manual', 'timer'] as const).map(m => (
          <Pressable
            key={m}
            style={[styles.tab, mode === m && styles.tabActive]}
            onPress={() => { resetTimer(); setMode(m); }}
            accessibilityRole="tab"
            accessibilityLabel={m === 'manual' ? 'Enter duration' : 'Start/stop timer'}
          >
            <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
              {m === 'manual' ? 'Enter' : 'Timer'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'manual' ? (
        <View style={styles.manualRow}>
          {/* Hours */}
          <View style={styles.unit}>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => changeH(1)} accessibilityLabel="Add 1 hour">
              <Text style={styles.arrow}>▲</Text>
            </TouchableOpacity>
            <Text style={styles.digits}>{pad(hours)}</Text>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => changeH(-1)} disabled={hours <= 0} accessibilityLabel="Remove 1 hour">
              <Text style={[styles.arrow, hours <= 0 && styles.disabled]}>▼</Text>
            </TouchableOpacity>
            <Text style={styles.unitLabel}>h</Text>
          </View>

          <Text style={styles.colon}>:</Text>

          {/* Minutes */}
          <View style={styles.unit}>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => changeM(1)} accessibilityLabel="Add 1 minute">
              <Text style={styles.arrow}>▲</Text>
            </TouchableOpacity>
            <Text style={styles.digits}>{pad(minutes)}</Text>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => changeM(-1)} disabled={value < 60} accessibilityLabel="Remove 1 minute">
              <Text style={[styles.arrow, value < 60 && styles.disabled]}>▼</Text>
            </TouchableOpacity>
            <Text style={styles.unitLabel}>m</Text>
          </View>
        </View>
      ) : (
        <View style={styles.timerSection}>
          <Text style={styles.timerDisplay}>{fmtDuration(running ? elapsed : value || elapsed)}</Text>
          <View style={styles.timerBtns}>
            {!running ? (
              <TouchableOpacity style={[styles.timerBtn, styles.startBtn]} onPress={startTimer} accessibilityRole="button" accessibilityLabel="Start timer">
                <Text style={styles.timerBtnText}>{elapsed > 0 ? 'Resume' : 'Start'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.timerBtn, styles.stopBtn]} onPress={stopTimer} accessibilityRole="button" accessibilityLabel="Stop timer">
                <Text style={styles.timerBtnText}>Stop</Text>
              </TouchableOpacity>
            )}
            {elapsed > 0 && !running && (
              <TouchableOpacity style={[styles.timerBtn, styles.resetBtn]} onPress={resetTimer} accessibilityRole="button" accessibilityLabel="Reset timer">
                <Text style={[styles.timerBtnText, { color: palette.textSecondary }]}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {field.helpText ? <Text style={styles.hint}>{field.helpText}</Text> : null}
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  wrapper: { gap: 12 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceAlt,
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10,
  },
  tabActive: { backgroundColor: palette.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { ...typography.smallBold, color: palette.textSecondary },
  tabTextActive: { color: palette.primaryText },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  unit: { alignItems: 'center', width: 80 },
  digits: { ...typography.h1, color: palette.text, textAlign: 'center' },
  unitLabel: { ...typography.small, color: palette.textSecondary, marginTop: 2 },
  colon: { ...typography.h2, color: palette.textDisabled, marginBottom: 16 },
  arrowBtn: { padding: 8, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  arrow: { ...typography.bodyBold, color: palette.primaryText },
  disabled: { color: palette.border },
  timerSection: { alignItems: 'center', gap: 16, paddingVertical: 8 },
  timerDisplay: { ...typography.h1, fontSize: 40, color: palette.text, fontVariant: ['tabular-nums'] },
  timerBtns: { flexDirection: 'row', gap: 12 },
  timerBtn: {
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24,
    minWidth: 100, alignItems: 'center',
  },
  startBtn: { backgroundColor: palette.primary },
  stopBtn:  { backgroundColor: palette.error },
  resetBtn: { backgroundColor: palette.surfaceAlt, borderWidth: 1, borderColor: palette.border },
  timerBtnText: { ...typography.button, color: palette.white },
  hint: { ...typography.small, color: palette.textSecondary },
}));
