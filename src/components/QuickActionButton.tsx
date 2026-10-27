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
import { createThemedStyles } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { useQuickLogStore } from '../store/quickLogStore';
import { useAuthStore } from '../store/authStore';
import { isWithinDayBoundary } from '../utils/dayBoundary';
import { IQuickAction } from '@lumen/shared';
import { QuickActionIcon } from './QuickActionIcon';

interface Props {
  action: IQuickAction;
  onLongPress?: () => void;
  onPressOverride?: () => void;
  width?: DimensionValue;
}

export function QuickActionButton({ action, onLongPress, onPressOverride, width }: Props): React.ReactElement {
  const styles = useStyles();
  const { user } = useAuthStore();
  const boundaryHour = user?.preferences?.dayBoundaryHour ?? 4;
  const { todayTaps, tap } = useQuickLogStore();
  const tapData = todayTaps[action._id];
  const isTapValidForToday = tapData?.lastAt ? isWithinDayBoundary(tapData.lastAt, boundaryHour) : false;
  const count = isTapValidForToday ? (tapData?.count ?? 0) : 0;
  const lastAt = isTapValidForToday && tapData?.lastAt
    ? new Date(tapData.lastAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.96, friction: 7, tension: 200, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (onPressOverride) {
      onPressOverride();
      return;
    }

    await tap(action._id, undefined, boundaryHour);
  }, [action._id, tap, onPressOverride, boundaryHour]);

  const status = count > 0 ? `${count} today${lastAt ? ` · ${lastAt}` : ''}` : 'Tap to log';

  return (
    <Animated.View style={[styles.wrapper, width !== undefined ? { width } : null, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={onLongPress}
        delayLongPress={500}
        accessibilityLabel={`${action.label}, ${count === 0 ? 'not logged yet today' : `logged ${count} ${count === 1 ? 'time' : 'times'} today`}`}
        accessibilityRole="button"
        activeOpacity={0.9}
      >
        <View style={[styles.tile, { backgroundColor: action.color }]}>
          <QuickActionIcon
            icon={action.icon}
            templateKey={action.templateKey}
            label={action.label}
            color="#FFFFFF"
            size={19}
          />
        </View>
        <View style={styles.text}>
          <Text style={styles.label} numberOfLines={2} maxFontSizeMultiplier={1.3}>{action.label}</Text>
          <Text style={styles.status} numberOfLines={1} maxFontSizeMultiplier={1.2}>{status}</Text>
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
  },
  tile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { gap: 1, alignSelf: 'stretch' },
  label: { ...typography.subheadBold, color: palette.text },
  status: { ...typography.footnote, color: palette.textSecondary },
}));
