import React, { useEffect, useRef } from 'react';
import {
  View,
  Pressable,
  Animated,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';

export interface AppleSwitchProps {
  /** Current state of the switch */
  value?: boolean;
  /** Callback invoked when the switch value changes */
  onValueChange?: (value: boolean) => void;
  /** Whether the switch is interactive */
  disabled?: boolean;
  /** Custom active track color (defaults to Apple Green #34C759 or custom tint) */
  activeColor?: string;
  /** Custom inactive track color */
  inactiveColor?: string;
  /** Custom thumb knob color (defaults to #FFFFFF) */
  thumbColor?: string;
  /** React Native Switch compatibility: trackColor object */
  trackColor?: {
    false?: string | null;
    true?: string | null;
  };
  /** Sizing variant: 'regular' (standard 51x31 iOS) or 'small' (42x25) */
  size?: 'regular' | 'small';
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Test identifier */
  testID?: string;
  /** Custom outer container style */
  style?: StyleProp<ViewStyle>;
}

export const AppleSwitch: React.FC<AppleSwitchProps> = ({
  value = false,
  onValueChange,
  disabled = false,
  activeColor,
  inactiveColor,
  thumbColor = '#FFFFFF',
  trackColor,
  size = 'regular',
  accessibilityLabel,
  testID,
  style,
}) => {
  const { palette, colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  // Metrics based on size variant
  const isSmall = size === 'small';
  const trackWidth = isSmall ? 42 : 51;
  const trackHeight = isSmall ? 25 : 31;
  const trackRadius = trackHeight / 2;
  const inset = 2;
  const thumbSize = trackHeight - inset * 2; // 21 or 27
  const thumbRadius = thumbSize / 2;
  const travelDistance = trackWidth - thumbSize - inset * 2; // 17 or 20

  // Animated values
  const toggleAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const pressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(toggleAnim, {
      toValue: value ? 1 : 0,
      damping: 18,
      mass: 0.9,
      stiffness: 240,
      useNativeDriver: true,
    }).start();
  }, [value, toggleAnim]);

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(pressAnim, {
      toValue: 1,
      damping: 15,
      mass: 0.5,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 0,
      damping: 15,
      mass: 0.5,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleToggle = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onValueChange?.(!value);
  };

  // Interpolated thumb translation & Apple-style press squish
  const translateX = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, travelDistance],
  });

  const scaleX = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  // Track colors
  const activeBg = trackColor?.true || activeColor || '#34C759';
  const inactiveBg =
    trackColor?.false ||
    inactiveColor ||
    (isDark ? '#39393D' : '#E9E9EA');

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={handleToggle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.container,
        {
          width: trackWidth,
          height: trackHeight,
          borderRadius: trackRadius,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {/* Inactive Track Layer */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: inactiveBg,
            borderRadius: trackRadius,
          },
        ]}
      />

      {/* Active Track Layer (Smooth opacity crossfade on UI thread) */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: activeBg,
            borderRadius: trackRadius,
            opacity: toggleAnim,
          },
        ]}
      />

      {/* Apple Physical Thumb Knob with Soft Dual Shadow */}
      <Animated.View
        style={[
          styles.thumb,
          {
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbRadius,
            top: inset,
            left: inset,
            backgroundColor: thumbColor,
            transform: [{ translateX }, { scaleX }],
          },
        ]}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2.5 },
        shadowOpacity: 0.18,
        shadowRadius: 3.5,
      },
      android: {
        elevation: 3.5,
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
    }),
  },
});
