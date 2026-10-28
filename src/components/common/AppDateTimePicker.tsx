/**
 * AppDateTimePicker — Cross-platform Date & Time Picker
 * - iOS: native spinner modal bottom-sheet with Done button
 * - Android: native Material dialogs (via @react-native-community/datetimepicker)
 * - Web: clean, Apple-Health styled interactive modal with hero time display,
 *        intuitive up/down steppers, quick presets, and calendar date selection.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import {
  Clock,
  Calendar as CalendarIcon,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Sparkles,
} from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

export interface AppDateTimePickerProps {
  visible: boolean;
  onClose: () => void;
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  mode?: 'datetime' | 'date' | 'time';
  title?: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function toHtmlDate(d: Date): string {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}-${m}-${day}`;
}

export function AppDateTimePicker({
  visible,
  onClose,
  value,
  onChange,
  maximumDate = new Date(),
  minimumDate,
  mode = 'datetime',
  title = 'When did this happen?',
}: AppDateTimePickerProps) {
  const { palette } = useTheme();
  const styles = useStyles();

  // Local working copy for the modal
  const [tempDate, setTempDate] = useState<Date>(value);

  useEffect(() => {
    if (visible) {
      setTempDate(value);
    }
  }, [visible, value]);

  const handleNativeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      onClose();
      if (event.type === 'set' && selectedDate) {
        onChange(selectedDate);
      }
    } else if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const isTimeMode = mode === 'time';

  const handleConfirm = () => {
    let finalDate = tempDate;
    if (!isTimeMode && maximumDate && finalDate.getTime() > maximumDate.getTime()) {
      finalDate = maximumDate;
    }
    if (!isTimeMode && minimumDate && finalDate.getTime() < minimumDate.getTime()) {
      finalDate = minimumDate;
    }
    onChange(finalDate);
    onClose();
  };

  // Adjusters
  const adjustDay = (deltaDays: number) => {
    const next = new Date(tempDate);
    next.setDate(next.getDate() + deltaDays);
    if (maximumDate && next.getTime() > maximumDate.getTime()) {
      setTempDate(maximumDate);
    } else if (minimumDate && next.getTime() < minimumDate.getTime()) {
      setTempDate(minimumDate);
    } else {
      setTempDate(next);
    }
  };

  const adjustHour = (delta: number) => {
    const next = new Date(tempDate);
    let newH = next.getHours() + delta;
    if (newH < 0) newH = 23;
    if (newH > 23) newH = 0;
    next.setHours(newH);

    if (!isTimeMode && maximumDate && next.getTime() > maximumDate.getTime()) {
      setTempDate(maximumDate);
    } else {
      setTempDate(next);
    }
  };

  const adjustMinute = (delta: number) => {
    const next = new Date(tempDate);
    let mins = next.getMinutes() + delta;
    if (mins < 0) {
      mins = 60 + mins;
      next.setHours(next.getHours() - 1);
    } else if (mins >= 60) {
      mins = mins - 60;
      next.setHours(next.getHours() + 1);
    }
    next.setMinutes(mins);

    if (!isTimeMode && maximumDate && next.getTime() > maximumDate.getTime()) {
      setTempDate(maximumDate);
    } else {
      setTempDate(next);
    }
  };

  const toggleAmPm = () => {
    const next = new Date(tempDate);
    const curH = next.getHours();
    if (curH >= 12) {
      next.setHours(curH - 12);
    } else {
      next.setHours(curH + 12);
    }
    if (!isTimeMode && maximumDate && next.getTime() > maximumDate.getTime()) {
      setTempDate(maximumDate);
    } else {
      setTempDate(next);
    }
  };

  const applyPresetMinutesAgo = (minutes: number) => {
    const target = new Date(Date.now() - minutes * 60 * 1000);
    setTempDate(target);
  };

  const setHourTime = (hour24: number, minute: number = 0) => {
    const next = new Date(tempDate);
    next.setHours(hour24, minute, 0, 0);
    if (!isTimeMode && maximumDate && next.getTime() > maximumDate.getTime()) {
      setTempDate(maximumDate);
    } else {
      setTempDate(next);
    }
  };

  // Date format calculations
  const isToday = useMemo(() => {
    return new Date().toDateString() === tempDate.toDateString();
  }, [tempDate]);

  const isYesterday = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return y.toDateString() === tempDate.toDateString();
  }, [tempDate]);

  const isDaysAgo = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() - days);
    return target.toDateString() === tempDate.toDateString();
  };

  const applyDaysAgo = (days: number) => {
    if (days === 0) {
      setTempDate(new Date());
      return;
    }
    const next = new Date();
    next.setDate(next.getDate() - days);
    if (maximumDate && next.getTime() > maximumDate.getTime()) {
      setTempDate(maximumDate);
    } else if (minimumDate && next.getTime() < minimumDate.getTime()) {
      setTempDate(minimumDate);
    } else {
      setTempDate(next);
    }
  };

  const isMaxDateReached = useMemo(() => {
    if (!maximumDate) return false;
    const maxDay = new Date(maximumDate);
    maxDay.setHours(23, 59, 59, 999);
    return tempDate.getTime() >= maxDay.getTime();
  }, [maximumDate, tempDate]);

  const isMinDateReached = useMemo(() => {
    if (!minimumDate) return false;
    const minDay = new Date(minimumDate);
    minDay.setHours(0, 0, 0, 0);
    return tempDate.getTime() <= minDay.getTime();
  }, [minimumDate, tempDate]);

  if (!visible) return null;

  // 1. Android Native Dialog
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="default"
        maximumDate={isTimeMode ? undefined : maximumDate}
        minimumDate={isTimeMode ? undefined : minimumDate}
        onChange={handleNativeChange}
      />
    );
  }

  // 2. iOS Native Sheet Modal
  if (Platform.OS === 'ios') {
    return (
      <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.iosSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{title}</Text>
              <TouchableOpacity onPress={handleConfirm} style={styles.doneBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode={mode}
              display="spinner"
              maximumDate={isTimeMode ? undefined : maximumDate}
              minimumDate={isTimeMode ? undefined : minimumDate}
              onChange={handleNativeChange}
              textColor={palette.text}
            />
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // 3. Web & Cross-Platform Refined Modal
  const curHours = tempDate.getHours();
  const curHours12 = curHours === 0 ? 12 : curHours > 12 ? curHours - 12 : curHours;
  const isPM = curHours >= 12;
  const curMinutes = tempDate.getMinutes();

  const dayLabel = isToday
    ? 'Today'
    : isYesterday
    ? 'Yesterday'
    : tempDate.toLocaleDateString(undefined, { weekday: 'short' });

  const dateSubLabel = tempDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.webSheet} onPress={e => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconCircle}>
                {mode === 'date' ? (
                  <CalendarIcon size={18} color={palette.primaryText} strokeWidth={2.4} />
                ) : (
                  <Clock size={18} color={palette.primaryText} strokeWidth={2.4} />
                )}
              </View>
              <Text style={styles.headerTitle}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Hero Date & Time Box */}
          <View style={styles.heroBox}>
            {/* Date Row */}
            {mode !== 'time' && (
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={[styles.dateChevronBtn, isMinDateReached && styles.btnDisabled]}
                  onPress={() => adjustDay(-1)}
                  disabled={isMinDateReached}
                  accessibilityLabel="Previous day"
                >
                  <ChevronLeft size={18} color={isMinDateReached ? palette.textDisabled : palette.text} />
                </TouchableOpacity>

                <View style={styles.dateCenter}>
                  <CalendarIcon size={16} color={palette.primaryText} strokeWidth={2.2} />
                  <Text style={styles.dateText}>
                    <Text style={{ fontWeight: '700' }}>{dayLabel}</Text>, {dateSubLabel}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.dateChevronBtn, isMaxDateReached && styles.btnDisabled]}
                  onPress={() => adjustDay(1)}
                  disabled={isMaxDateReached}
                  accessibilityLabel="Next day"
                >
                  <ChevronRight size={18} color={isMaxDateReached ? palette.textDisabled : palette.text} />
                </TouchableOpacity>
              </View>
            )}

            {mode === 'datetime' && <View style={styles.heroDivider} />}

            {/* Time Digital Clock Row */}
            {mode !== 'date' && (
              <View style={styles.timeRow}>
                {/* Hours Up / Digit / Down */}
                <View style={styles.timeColumn}>
                  <TouchableOpacity style={styles.timeStepperBtn} onPress={() => adjustHour(1)}>
                    <ChevronUp size={16} color={palette.text} />
                  </TouchableOpacity>
                  <View style={styles.timePill}>
                    <Text style={styles.timePillText}>{curHours12.toString().padStart(2, '0')}</Text>
                  </View>
                  <TouchableOpacity style={styles.timeStepperBtn} onPress={() => adjustHour(-1)}>
                    <ChevronDown size={16} color={palette.text} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.timeColon}>:</Text>

                {/* Minutes Up / Digit / Down */}
                <View style={styles.timeColumn}>
                  <TouchableOpacity style={styles.timeStepperBtn} onPress={() => adjustMinute(5)}>
                    <ChevronUp size={16} color={palette.text} />
                  </TouchableOpacity>
                  <View style={styles.timePill}>
                    <Text style={styles.timePillText}>{pad(curMinutes)}</Text>
                  </View>
                  <TouchableOpacity style={styles.timeStepperBtn} onPress={() => adjustMinute(-5)}>
                    <ChevronDown size={16} color={palette.text} />
                  </TouchableOpacity>
                </View>

                {/* AM / PM Segmented Switch */}
                <View style={styles.amPmSwitch}>
                  <TouchableOpacity
                    style={[styles.amPmSegment, !isPM && styles.amPmSegmentActive]}
                    onPress={() => { if (isPM) toggleAmPm(); }}
                  >
                    <Text style={[styles.amPmText, !isPM && styles.amPmTextActive]}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.amPmSegment, isPM && styles.amPmSegmentActive]}
                    onPress={() => { if (!isPM) toggleAmPm(); }}
                  >
                    <Text style={[styles.amPmText, isPM && styles.amPmTextActive]}>PM</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Quick Presets */}
          <View style={styles.presetsSection}>
            <Text style={styles.sectionLabel}>Quick Presets</Text>
            {mode === 'date' ? (
              <View style={styles.presetsGrid}>
                <TouchableOpacity
                  style={[styles.presetCard, isToday && styles.presetCardActive]}
                  onPress={() => applyDaysAgo(0)}
                  accessibilityRole="button"
                  accessibilityLabel="Today"
                >
                  <Sparkles size={13} color={palette.primaryText} />
                  <Text style={[styles.presetText, isToday && styles.presetTextActive]}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.presetCard, isYesterday && styles.presetCardActive]}
                  onPress={() => applyDaysAgo(1)}
                  accessibilityRole="button"
                  accessibilityLabel="Yesterday"
                >
                  <Text style={[styles.presetText, isYesterday && styles.presetTextActive]}>Yesterday</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.presetCard, isDaysAgo(2) && styles.presetCardActive]}
                  onPress={() => applyDaysAgo(2)}
                  accessibilityRole="button"
                  accessibilityLabel="2 days ago"
                >
                  <Text style={[styles.presetText, isDaysAgo(2) && styles.presetTextActive]}>2 days ago</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.presetCard, isDaysAgo(3) && styles.presetCardActive]}
                  onPress={() => applyDaysAgo(3)}
                  accessibilityRole="button"
                  accessibilityLabel="3 days ago"
                >
                  <Text style={[styles.presetText, isDaysAgo(3) && styles.presetTextActive]}>3 days ago</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.presetCard, isDaysAgo(7) && styles.presetCardActive]}
                  onPress={() => applyDaysAgo(7)}
                  accessibilityRole="button"
                  accessibilityLabel="1 week ago"
                >
                  <Text style={[styles.presetText, isDaysAgo(7) && styles.presetTextActive]}>1 week ago</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.presetsGrid}>
                <TouchableOpacity
                  style={[styles.presetCard, isToday && curMinutes === new Date().getMinutes() && styles.presetCardActive]}
                  onPress={() => setTempDate(new Date())}
                >
                  <Sparkles size={13} color={palette.primaryText} />
                  <Text style={styles.presetText}>Now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetCard} onPress={() => applyPresetMinutesAgo(15)}>
                  <Text style={styles.presetText}>-15 min</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetCard} onPress={() => applyPresetMinutesAgo(60)}>
                  <Text style={styles.presetText}>-1 hour</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetCard} onPress={() => setHourTime(8, 0)}>
                  <Text style={styles.presetText}>8:00 AM</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetCard} onPress={() => setHourTime(12, 0)}>
                  <Text style={styles.presetText}>12:00 PM</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetCard} onPress={() => setHourTime(20, 0)}>
                  <Text style={styles.presetText}>8:00 PM</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Browser Native Date Picker for Web (Jump to Specific Date) */}
          {Platform.OS === 'web' && mode !== 'time' && (
            <View style={styles.calendarRow}>
              <Text style={styles.calendarLabel}>Jump to date:</Text>
              {React.createElement('input', {
                type: 'date',
                value: toHtmlDate(tempDate),
                max: maximumDate ? toHtmlDate(maximumDate) : undefined,
                min: minimumDate ? toHtmlDate(minimumDate) : undefined,
                onChange: (e: any) => {
                  if (e.target.value) {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    if (y && m && d) {
                      const next = new Date(tempDate);
                      next.setFullYear(y, m - 1, d);
                      if (maximumDate && next.getTime() > maximumDate.getTime()) {
                        setTempDate(maximumDate);
                      } else {
                        setTempDate(next);
                      }
                    }
                  }
                },
                style: {
                  padding: '5px 10px',
                  borderRadius: 8,
                  border: `1px solid ${palette.border}`,
                  backgroundColor: palette.surface,
                  color: palette.text,
                  fontSize: 12.5,
                  fontWeight: '600',
                  outline: 'none',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                },
              })}
            </View>
          )}

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
              <Check size={16} color="#FFFFFF" strokeWidth={2.6} style={{ marginRight: 6 }} />
              <Text style={styles.confirmBtnText}>{mode === 'date' ? 'Set Date' : 'Set Time'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = createThemedStyles(palette => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  iosSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: palette.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  webSheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.primary + '16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.bodyBold,
    fontSize: 16,
    color: palette.text,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  doneBtnText: {
    ...typography.bodyBold,
    color: palette.primaryText,
  },

  // Hero Card
  heroBox: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateChevronBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  dateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    ...typography.body,
    fontSize: 14.5,
    color: palette.text,
  },
  heroDivider: {
    height: 1,
    backgroundColor: palette.border,
    opacity: 0.7,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  timeColumn: {
    alignItems: 'center',
    gap: 3,
  },
  timeStepperBtn: {
    width: 44,
    height: 22,
    borderRadius: 6,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePill: {
    width: 46,
    height: 40,
    borderRadius: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePillText: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
  },
  timeColon: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.textSecondary,
    marginBottom: 2,
  },
  amPmSwitch: {
    flexDirection: 'column',
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 3,
    gap: 3,
    marginLeft: 6,
  },
  amPmSegment: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    alignItems: 'center',
  },
  amPmSegmentActive: {
    backgroundColor: palette.primary,
  },
  amPmText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: palette.textSecondary,
  },
  amPmTextActive: {
    color: '#FFFFFF',
  },

  // Presets
  presetsSection: {
    gap: 8,
  },
  sectionLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetCard: {
    flexGrow: 1,
    width: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  presetCardActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primary + '12',
  },
  presetText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
  },
  presetTextActive: {
    color: palette.primaryText,
    fontWeight: '700',
  },

  // Jump to date row
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  calendarLabel: {
    ...typography.caption,
    fontSize: 12,
    color: palette.textSecondary,
    fontWeight: '600',
  },

  // Action Footer
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: palette.textSecondary,
  },
  confirmBtn: {
    flex: 1.2,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
}));

export default AppDateTimePicker;
