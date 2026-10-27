import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, X } from 'lucide-react-native';
import { createThemedStyles, useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { GlassCircleButton } from './GlassCircleButton';

interface Props {
  title?: string;
  onBack: () => void;
  backLabel?: string;
  /** 'close' shows an X (sheets), 'back' shows a chevron. */
  backIcon?: 'back' | 'close';
  right?: React.ReactNode;
  /** Sheets drawn below the status bar do not need the safe-area top inset. */
  sheet?: boolean;
}

/** Top row of a pushed or modal form: round glass button, centred title, optional right control. */
export function ScreenTopBar({ title, onBack, backLabel = 'Back', backIcon = 'back', right, sheet }: Props) {
  const styles = useStyles();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: (sheet ? 0 : insets.top) + 8 }]}>
      <GlassCircleButton accessibilityLabel={backLabel} onPress={onBack}>
        {backIcon === 'close'
          ? <X size={20} color={palette.text} strokeWidth={2.4} />
          : <ChevronLeft size={22} color={palette.text} strokeWidth={2.4} />}
      </GlassCircleButton>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
        {title ?? ''}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

interface HeaderButtonProps {
  label: string;
  onPress: () => void;
  /** Filled primary pill (Save) instead of a plain text button. */
  prominent?: boolean;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** Text control for the right side of ScreenTopBar, e.g. Save or Skip. */
export function HeaderTextButton({ label, onPress, prominent, loading, disabled, accessibilityLabel }: HeaderButtonProps) {
  const styles = useStyles();
  return (
    <TouchableOpacity
      style={[styles.btn, prominent ? styles.btnProminent : styles.btnPlain, (disabled || loading) && styles.dim]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
    >
      {loading
        ? <ActivityIndicator size="small" color={prominent ? '#FFFFFF' : undefined} />
        : <Text style={[styles.btnText, prominent && styles.btnTextProminent]} maxFontSizeMultiplier={1.3}>{label}</Text>}
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles(palette => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  title: { ...typography.headline, color: palette.text, flex: 1, textAlign: 'center' },
  right: { minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  btn: { minHeight: 44, minWidth: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  btnPlain: { paddingHorizontal: 4 },
  btnProminent: { backgroundColor: palette.primary },
  btnText: { ...typography.headline, color: palette.primaryText },
  btnTextProminent: { color: '#FFFFFF' },
  dim: { opacity: 0.6 },
}));
