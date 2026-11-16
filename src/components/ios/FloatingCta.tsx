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
  /** Set to true to float absolutely over the content. Defaults to false (solid bottom bar). */
  floating?: boolean;
}

/** Bottom CTA button pinned to the bottom of a form. */
export function FloatingCta({ label, onPress, loading, disabled, accessibilityLabel, icon, keyboardVisible, floating = false }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const bottom = keyboardVisible ? 8 : Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + 4;
  return (
    <View style={[styles.wrap, floating && styles.floatingWrap, { paddingBottom: bottom }]} pointerEvents={floating ? 'box-none' : 'auto'}>
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

/** Scroll content bottom clearance for the CTA button. */
export const FLOATING_CTA_CLEARANCE = 24;

const useStyles = createThemedStyles(palette => ({
  wrap: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: palette.background },
  floatingWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },
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
