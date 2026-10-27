import React from 'react';
import { TouchableOpacity, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useIosSurfaces } from './iosTheme';

interface Props {
  onPress?: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  badge?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** 44pt translucent round control, used in the top-right of large-title screens. */
export function GlassCircleButton({ onPress, accessibilityLabel, children, badge, style }: Props) {
  const s = useIosSurfaces();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.btn, { backgroundColor: s.ctrl }, style]}
    >
      {children}
      {badge ? <View style={styles.badge} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
