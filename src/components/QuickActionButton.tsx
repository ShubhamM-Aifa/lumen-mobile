/**
 * QuickActionButton
 * One tap = instant log with haptic feedback + undo toast.
 * Long-press = opens the detail sheet.
 *
 * iOS-style tile: white card, 34pt coloured icon tile, title and a muted status line.
 */
import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  Animated,
  DimensionValue,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Target } from 'lucide-react-native';
import { createThemedStyles, useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { useQuickLogStore } from '../store/quickLogStore';
import { useAuthStore } from '../store/authStore';
import { isWithinDayBoundary } from '../utils/dayBoundary';
import { IQuickAction } from '@lumen/shared';
import { QuickActionIcon } from './QuickActionIcon';
import { ProgressRing } from './ios/ProgressRing';

interface Props {
  action: IQuickAction;
  onLongPress?: () => void;
  onPressOverride?: () => void;
  width?: DimensionValue;
}

export function QuickActionButton({ action, onLongPress, onPressOverride, width }: Props): React.ReactElement {
  const styles = useStyles();
  const { palette } = useTheme();
  const { user } = useAuthStore();
  const boundaryHour = user?.preferences?.dayBoundaryHour ?? 4;
  const { todayTaps, tap } = useQuickLogStore();
  const tapData = todayTaps[action._id];
  const isTapValidForToday = tapData?.lastAt ? isWithinDayBoundary(tapData.lastAt, boundaryHour) : false;
  const count = isTapValidForToday ? (tapData?.count ?? 0) : 0;
  const lastAt = isTapValidForToday && tapData?.lastAt
    ? new Date(tapData.lastAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  // Apple UI style goal progress
  const hasGoal = typeof action.dailyGoal === 'number' && action.dailyGoal > 0;
  const target = hasGoal
    ? (action.defaultValue && action.defaultValue > 1 && action.dailyGoal! >= action.defaultValue
        ? Math.max(1, Math.round(action.dailyGoal! / action.defaultValue))
        : Math.max(1, Math.round(action.dailyGoal!)))
    : null;
  const progress = hasGoal && target ? count / target : 0;
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const isGoalMet = hasGoal && target ? count >= target : false;
  const percent = Math.round(clampedProgress * 100);

  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.96, friction: 7, tension: 200, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(async () => {
    const willReachGoal = hasGoal && target ? count + 1 >= target && !isGoalMet : false;
    if (willReachGoal) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (onPressOverride) {
      onPressOverride();
      return;
    }

    await tap(action._id, undefined, boundaryHour);
  }, [hasGoal, target, count, isGoalMet, action._id, tap, onPressOverride, boundaryHour]);

  const status = hasGoal && target
    ? isGoalMet
      ? `${count}/${target} · Goal met`
      : count > 0
        ? `${count}/${target}${lastAt ? ` · ${lastAt}` : ''}`
        : `0/${target} · Tap to log`
    : count > 0
      ? `${count} today${lastAt ? ` · ${lastAt}` : ''}`
      : 'Tap to log';

  const accessibilityLabel = hasGoal && target
    ? `${action.label}, goal ${count} of ${target}, ${percent} percent complete${isGoalMet ? ', goal reached' : ''}`
    : `${action.label}, ${count === 0 ? 'not logged yet today' : `logged ${count} ${count === 1 ? 'time' : 'times'} today`}`;

  return (
    <Animated.View style={[styles.wrapper, width !== undefined ? { width } : null, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[styles.button, isGoalMet && styles.buttonGoalMet]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={onLongPress}
        delayLongPress={500}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        activeOpacity={0.9}
      >
        <View style={styles.topRow}>
          <View style={[styles.tile, { backgroundColor: action.color }]}>
            <QuickActionIcon
              icon={action.icon}
              templateKey={action.templateKey}
              label={action.label}
              color="#FFFFFF"
              size={19}
            />
          </View>
          {hasGoal && target ? (
            <ProgressRing
              size={26}
              strokeWidth={2.8}
              progress={clampedProgress}
              color={isGoalMet ? palette.success : action.color}
              trackColor={action.color ? `${action.color}22` : palette.surfaceAlt}
            >
              {isGoalMet ? (
                <Check size={12} color={palette.success} strokeWidth={3} />
              ) : count > 0 ? (
                <Text style={[styles.ringCountText, { color: action.color }]}>
                  {count > 99 ? '99+' : count}
                </Text>
              ) : (
                <Target size={11} color={palette.textSecondary} strokeWidth={2} opacity={0.6} />
              )}
            </ProgressRing>
          ) : null}
        </View>
        <View style={styles.text}>
          <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.3}>{action.label}</Text>
          <Text
            style={[styles.status, isGoalMet && styles.statusGoalMet]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
          >
            {status}
          </Text>
          {hasGoal && target ? (
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${percent}%`,
                    backgroundColor: isGoalMet ? palette.success : action.color,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const useStyles = createThemedStyles(palette => ({
  wrapper: {
    width: '31.3%',
  },
  button: {
    width: '100%',
    minHeight: 104,
    borderRadius: 22,
    backgroundColor: palette.surface,
    padding: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  buttonGoalMet: {
    borderColor: `${palette.success}50`,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  tile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCountText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  text: { gap: 1, alignSelf: 'stretch' },
  label: { ...typography.subheadBold, color: palette.text },
  status: { ...typography.footnote, color: palette.textSecondary },
  statusGoalMet: { color: palette.successText, fontWeight: '600' },
  progressBarTrack: {
    height: 3.5,
    borderRadius: 2,
    backgroundColor: palette.surfaceAlt,
    width: '100%',
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
}));
