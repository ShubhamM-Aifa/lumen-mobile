import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  icon?: React.ReactNode;
  /** Lift the button above the keyboard by hiding the bottom inset. */
  keyboardVisible?: boolean;
}

/** Full-width pill pinned to the bottom of a form, floating over the scrolling content. */
export function FloatingCta({ label, onPress, loading, disabled, accessibilityLabel, icon, keyboardVisible }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const bottom = keyboardVisible ? 8 : Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + 4;
  return (
    <View style={[styles.wrap, { paddingBottom: bottom }]} pointerEvents="box-none">
      <TouchableOpacity
        style={[styles.btn, (disabled || loading) && styles.dim]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      >
        {loading ? <ActivityIndicator color="#FFFFFF" /> : (
          <>
            {icon}
            <Text style={styles.text} maxFontSizeMultiplier={1.3}>{label}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

/** Scroll content must end this far above the bottom so the last field clears the button. */
export const FLOATING_CTA_CLEARANCE = 110;

const useStyles = createThemedStyles(palette => ({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8 },
  btn: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  text: { ...typography.headline, color: '#FFFFFF' },
  dim: { opacity: 0.6 },
}));
