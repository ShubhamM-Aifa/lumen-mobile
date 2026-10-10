/**
 * QuickActionButton
 * One tap = instant log with haptic feedback + undo toast.
 * Long-press = opens the detail sheet.
 */
import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Animated,
  DimensionValue,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, createThemedStyles } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { useQuickLogStore } from '../store/quickLogStore';
import { IQuickAction } from '@lumen/shared';
import { QuickActionIcon } from './QuickActionIcon';

interface Props {
  action: IQuickAction;
  onLongPress?: () => void;
  onPressOverride?: () => void;
  width?: DimensionValue;
}

export function QuickActionButton({ action, onLongPress, onPressOverride, width }: Props): React.ReactElement {
  const { palette } = useTheme();
  const styles = useStyles();
  const { todayTaps, tap } = useQuickLogStore();
  const tapData = todayTaps[action._id];
  const count = tapData?.count ?? 0;
  const lastAt = tapData?.lastAt
    ? new Date(tapData.lastAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  // Physical press spring animation
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const badgeScaleAnim = React.useRef(new Animated.Value(1)).current;
  const prevCount = React.useRef(count);

  // Pop the badge whenever count changes
  React.useEffect(() => {
    if (count !== prevCount.current && count > 0) {
      prevCount.current = count;
      Animated.sequence([
        Animated.spring(badgeScaleAnim, {
          toValue: 1.35,
          friction: 4,
          tension: 240,
          useNativeDriver: true,
        }),
        Animated.spring(badgeScaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [count, badgeScaleAnim]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.90,
      friction: 6,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 110,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (onPressOverride) {
      onPressOverride();
      return;
    }

    await tap(action._id);
  }, [action._id, tap, onPressOverride]);

  return (
    <Animated.View style={[styles.wrapper, width !== undefined ? { width } : null, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: count > 0
              ? (palette.surfaceAlt === '#F5F0EB' ? action.color + '0E' : action.color + '1A')
              : palette.surface,
            borderColor: count > 0 ? action.color + '55' : palette.border,
          },
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={onLongPress}
        delayLongPress={500}
        accessibilityLabel={`${action.label}, tapped ${count} times today`}
        accessibilityRole="button"
        activeOpacity={0.92}
      >
        {/* Count badge with pop animation */}
        {count > 0 && (
          <Animated.View
            style={[
              styles.badge,
              {
                backgroundColor: action.color,
                transform: [{ scale: badgeScaleAnim }],
              },
            ]}
          >
            <Text style={styles.badgeText}>{count}</Text>
          </Animated.View>
        )}

        {/* Icon framed in a circular orb */}
        <View
          style={[
            styles.iconWell,
            {
              backgroundColor: action.color + (count > 0 ? '25' : '15'),
              borderColor: action.color + (count > 0 ? '45' : '26'),
            },
          ]}
        >
          <QuickActionIcon
            icon={action.icon}
            templateKey={action.templateKey}
            label={action.label}
            color={action.color}
            size={22}
          />
        </View>

        {/* Label */}
        <Text style={styles.label} numberOfLines={2}>{action.label}</Text>

        {/* Status indicator: subtle subtext showing count, time or 'Tap to log' */}
        {count > 0 ? (
          <Text style={[styles.statusText, { color: action.color }]} numberOfLines={1}>
            {count > 1 ? `${count} today` : (lastAt ? `at ${lastAt}` : 'Logged')}
          </Text>
        ) : (
          <Text style={styles.statusEmpty} numberOfLines={1}>Tap to log</Text>
        )}

        {/* Daily goal progress bar */}
        {action.dailyGoal && count > 0 && (
          <View style={[styles.goalBar, { backgroundColor: action.color + '22' }]}>
            <View
              style={[
                styles.goalFill,
                {
                  backgroundColor: action.color,
                  width: `${Math.min(100, (count / action.dailyGoal) * 100)}%` as `${number}%`,
                },
              ]}
            />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const useStyles = createThemedStyles(palette => ({
  wrapper: {
    width: '31.3%',
    alignItems: 'center',
  },
  button: {
    width: '100%',
    aspectRatio: 0.92,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    position: 'relative',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1.5,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: palette.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    zIndex: 2,
  },
  badgeText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 12,
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    borderWidth: 1.5,
  },
  icon: {
    fontSize: 22,
    lineHeight: 28,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 15,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
    textAlign: 'center',
  },
  statusEmpty: {
    ...typography.caption,
    fontWeight: '500',
    fontSize: 10,
    lineHeight: 13,
    color: palette.textDisabled,
    marginTop: 2,
    textAlign: 'center',
  },
  goalBar: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  goalFill: {
    height: 3,
    borderRadius: 1.5,
  },
}));
